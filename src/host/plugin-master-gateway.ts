/**
 * The PluginMasterGateway host service. One Typert-bound Cordis Service
 * that exposes the snapshot + mutation Remotes the browser settings tab
 * calls:
 *   - `list` → PackageSnapshot
 *   - `search` → SearchResult
 *   - `setEntryEnabled` → MutationReceipt
 *   - `setPackageEnabled` → MutationReceipt
 *   - `uninstall` → MutationReceipt
 *
 * Mutation operations are serialized through an internal async tail so two
 * concurrent toggles (the user spam-clicking enable/disable) cannot
 * clobber each other's patch writes.
 *
 * The service has no in-memory cache — every read returns a fresh
 * snapshot built from `loader.entries()` plus the live `node_modules`
 * walk. This costs a few ms per call and keeps the master strictly
 * correct against edits made by other surfaces.
 */

import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import type { Context } from '@deepseek-ai/cordis'
import { findPackageJSON } from 'node:module'
import { existsSync, readdirSync, realpathSync } from 'node:fs'
import { dirname, join } from 'node:path'

import { setEntryEnabled, OWNER_MARKER, readPatchDocument, atomicWrite } from './enable-disable.ts'
import { isMap, isSeq, type YAMLMap } from 'yaml'
import {
  resolveProfile,
  readProfileManifest,
  readProfileBundles,
  type ProfileContext,
} from './profile-context.ts'
import {
  scanInstalledPackages,
  type ScannedPackage,
} from './package-source.ts'
import { applyClassification, classifyPackage } from './classify.ts'
import {
  groupEntriesByPackage,
  packageRoot,
  projectLoaderEntries,
  type LoaderEntryLike,
} from './loader-integration.ts'
import { searchPackages } from './search.ts'
import { buildProtectedIds, defaultProtectedIds } from './protected-ids.ts'
import { runUninstall, verifyRemoved, type UninstallRequest } from './uninstall.ts'
import {
  buildClientDependencyIndex,
  findDependentPackages,
  type ClientDependencyIndex,
} from './client-deps.ts'
import type {
  LoaderEntryView,
  MutationItem,
  MutationReceipt,
  PackageSnapshot,
  PackageView,
  SearchOptions,
  SearchResult,
} from './types.ts'

interface PluginMasterConfig {
  protectedEntries?: string[]
  settleTimeoutMs?: number
  uninstallTimeoutMs?: number
  /**
   * Development mode (default true): when a user plugin fails to
   * activate at boot, quarantine it at runtime so the harness still
   * reaches the UI instead of failing loud. System packages and
   * protected entries are never quarantined.
   */
  devMode?: boolean
}

const SELF_MODULE = 'dsh-plugin-master'

export class PluginMasterGateway extends TypertRemoteService {
  static readonly inject = ['loader']

  private readonly profile: ProfileContext
  private readonly protectedIds: Set<string>
  private readonly settleTimeoutMs: number
  private readonly uninstallTimeoutMs: number
  private mutationTail: Promise<void> = Promise.resolve()
  private readonly selfEntryIds: Set<string> = new Set()
  /** Whether dev-mode quarantine tooling is active (config `devMode`, default true). */
  devMode: boolean

  constructor(ctx: Context, config: PluginMasterConfig = {}) {
    super(ctx, 'pluginMaster')
    const baseUrl = ctx.loader.ctx.baseUrl
    if (typeof baseUrl !== 'string') {
      throw new Error('dsh-plugin-master requires a file-backed Loader root')
    }
    this.profile = resolveProfile(baseUrl)
    this.protectedIds = buildProtectedIds(config.protectedEntries)
    this.settleTimeoutMs = config.settleTimeoutMs ?? 8_000
    this.uninstallTimeoutMs = config.uninstallTimeoutMs ?? 60_000
    this.devMode = config.devMode ?? true
    this.seedSelfEntryIds(ctx)
  }

  /** Whether development-mode quarantine is active. */
  @Remote('getDevMode')
  getDevMode(): boolean {
    return this.devMode
  }

  /**
   * Persist the dev-mode flag into the plugin master's own entry config
   * (`config.devMode`) and flip the live value. The profile HMR watcher
   * re-applies the master with the new config on the next reload.
   */
  @Remote('setDevMode')
  async setDevMode(enabled: boolean): Promise<MutationReceipt> {
    return await this.serialize(async () => {
      const previous = this.devMode
      this.devMode = enabled
      try {
        await this.writeOwnConfig({ devMode: enabled })
      } catch (error) {
        this.devMode = previous
        const snapshot = this.buildSnapshot()
        return this.failureReceipt(snapshot, SELF_MODULE, errorMessage(error))
      }
      const snapshot = this.buildSnapshot()
      return {
        succeeded: true,
        items: [{
          entryId: SELF_MODULE,
          status: 'changed',
          message: null,
        }],
        snapshot,
      }
    })
  }


  /**
   * Find the loader entries belonging to the master plugin and add their
   * ids to the protected set so the UI cannot disable itself or any
   * ancestor that owns it.
   */
  private seedSelfEntryIds(ctx: Context): void {
    const loader = ctx.loader as { entries(): Iterable<LoaderEntryLike> }
    for (const entry of loader.entries()) {
      if (typeof entry.options.name === 'string' && packageRoot(entry.options.name) === SELF_MODULE) {
        this.selfEntryIds.add(entry.id)
        this.protectedIds.add(entry.id)
      }
    }
  }

  /** Read-only snapshot of every installed package. */
  @Remote('list')
  list(): PackageSnapshot {
    return this.buildSnapshot()
  }

  /** Fuzzy search across the installed packages. */
  @Remote('search')
  search(options: SearchOptions): SearchResult {
    const snapshot = this.buildSnapshot()
    const { matched, totalMatches, truncated } = searchPackages(snapshot.packages, options.query, options.limit)
    return {
      query: options.query,
      matchedPackages: matched.map((entry) => entry.package),
      totalMatches,
      truncated,
    }
  }

  /** Toggle one Loader entry's desired enablement and wait for the runtime to settle. */
  @Remote('setEntryEnabled')
  async setEntryEnabled(entryId: string, enabled: boolean): Promise<MutationReceipt> {
    return await this.serialize(async () => {
      const snapshot = this.buildSnapshot()
      const target = this.findEntryInSnapshot(snapshot, entryId)
      if (target === null) {
        return this.failureReceipt(snapshot, entryId, `Unknown entry id "${entryId}".`)
      }
      if (target.protected && enabled === false) {
        return this.skipReceipt(snapshot, entryId, target.protectionReason ?? 'Protected by the profile.')
      }
      if (target.enabled === enabled) {
        return this.unchangedReceipt(snapshot, entryId)
      }
      if (enabled === false) {
        const dependents = this.dependentPackagesBlockingDisable(snapshot, packageRoot(target.moduleName))
        if (dependents !== null) {
          return this.failureReceipt(
            snapshot,
            entryId,
            `Cannot disable: ${dependents.join(', ')} depend${dependents.length === 1 ? 's' : ''} on its client services. Disable ${dependents.length === 1 ? 'that package' : 'those packages'} first.`,
          )
        }
      }
      try {
        await setEntryEnabled(this.profile.patchFile, target.configId, target.moduleName, enabled)
      } catch (error) {
        return this.failureReceipt(snapshot, entryId, errorMessage(error))
      }
      const settled = await this.waitForSettle(entryId, enabled)
      if (!settled) {
        return this.restartRequiredReceipt(snapshot, entryId)
      }
      return this.changedReceipt(snapshot, entryId)
    })
  }

  /** Toggle every loader entry owned by one package in lockstep. */
  @Remote('setPackageEnabled')
  async setPackageEnabled(packageName: string, enabled: boolean): Promise<MutationReceipt> {
    return await this.serialize(async () => {
      const snapshot = this.buildSnapshot()
      const target = snapshot.packages.find((pkg) => pkg.packageName === packageName)
      if (target === undefined) {
        return this.failureReceipt(snapshot, packageName, `Unknown package "${packageName}".`)
      }
      if (enabled === false) {
        const dependents = this.dependentPackagesBlockingDisable(snapshot, packageName)
        if (dependents !== null) {
          return this.failureReceipt(
            snapshot,
            packageName,
            `Cannot disable: ${dependents.join(', ')} depend${dependents.length === 1 ? 's' : ''} on its client services. Disable ${dependents.length === 1 ? 'that package' : 'those packages'} first.`,
          )
        }
      }
      const items: MutationItem[] = []
      let needsRestart = false
      for (const entry of target.loaderEntries) {
        if (entry.protected && enabled === false) {
          items.push({
            entryId: entry.entryId,
            status: 'skipped',
            message: entry.protectionReason ?? 'Protected by the profile.',
          })
          continue
        }
        if (entry.enabled === enabled) {
          items.push({ entryId: entry.entryId, status: 'unchanged', message: null })
          continue
        }
        try {
          await setEntryEnabled(this.profile.patchFile, entry.configId, entry.moduleName, enabled)
        } catch (error) {
          items.push({ entryId: entry.entryId, status: 'failed', message: errorMessage(error) })
          continue
        }
        const settled = await this.waitForSettle(entry.entryId, enabled)
        if (!settled) needsRestart = true
        items.push({
          entryId: entry.entryId,
          status: settled ? 'changed' : 'restart-required',
          message: settled ? null : 'Restart the profile to apply this change.',
        })
      }
      const next = this.buildSnapshot()
      return {
        succeeded: items.every((item) => item.status === 'changed' || item.status === 'unchanged' || item.status === 'skipped'),
        items,
        snapshot: next,
      }
    })
  }

  /** Uninstall one user package via `dsh plugin --profile <name> remove`. */
  @Remote('uninstall')
  async uninstall(packageName: string): Promise<MutationReceipt> {
    return await this.serialize(async () => {
      const snapshot = this.buildSnapshot()
      const target = snapshot.packages.find((pkg) => pkg.packageName === packageName)
      if (target === undefined) {
        return this.failureReceipt(snapshot, packageName, `Unknown package "${packageName}".`)
      }
      if (target.isSystem) {
        return this.failureReceipt(
          snapshot,
          packageName,
          `System packages cannot be uninstalled through the master.`,
        )
      }
      if (!target.canUninstall) {
        return this.failureReceipt(
          snapshot,
          packageName,
          target.uninstallBlockedReason ?? 'Uninstall blocked by the master.',
        )
      }
      const request: UninstallRequest = {
        profileDirectory: this.profile.directory,
        profileName: this.profile.name,
        packageName,
      }
      const outcome = runUninstall(request)
      if (outcome.exitCode !== 0) {
        return this.failureReceipt(
          snapshot,
          packageName,
          `dsh plugin remove exited with ${outcome.exitCode}. ${outcome.stderr || outcome.stdout}`.trim(),
        )
      }
      if (!verifyRemoved(this.profile.directory, packageName)) {
        return this.failureReceipt(
          snapshot,
          packageName,
          `dsh plugin remove reported success but ${packageName} is still present in node_modules.`,
        )
      }
      return {
        succeeded: true,
        items: [{ entryId: packageName, status: 'changed', message: 'Uninstalled.' }],
        snapshot: this.buildSnapshot(),
      }
    })
  }

  // ---- Internal helpers ----

  /**
   * Build a package → enabled lookup from the current snapshot packages.
   * A package counts as enabled when every one of its loader entries is
   * enabled (mirrors the snapshot's `enabled` computation).
   */
  private enabledPackageMap(snapshot: PackageSnapshot): Map<string, boolean> {
    const map = new Map<string, boolean>()
    for (const pkg of snapshot.packages) map.set(pkg.packageName, pkg.enabled)
    return map
  }

  /**
   * Client-half dependency guard. Disabling a package whose client bundle
   * provides services that other ENABLED packages still inject would leave
   * those dependents pending forever at web boot (`waiting for service: ...`).
   * Returns a human-readable list of the blocking dependent packages, or
   * null when the disable is safe. Dependents inside the same package are
   * ignored: a package-level toggle flips all of its entries together.
   */
  private dependentPackagesBlockingDisable(snapshot: PackageSnapshot, packageName: string): string[] | null {
    const nodeModules = join(this.profile.directory, 'node_modules')
    const index = buildClientDependencyIndex(nodeModules, this.loader().entries())
    const enabled = this.enabledPackageMap(snapshot)
    const dependents = findDependentPackages(
      index,
      packageName,
      (consumer) => enabled.get(consumer) === true && consumer !== packageName,
    )
    if (dependents.length === 0) return null
    return dependents
  }

  private buildSnapshot(): PackageSnapshot {
    const loader = this.loader()
    const loaderEntries = projectLoaderEntries(loader.entries(), this.protectedIds)
    const entriesByPackage = groupEntriesByPackage(loaderEntries)

    const profileManifest = readProfileManifest(this.profile)
    const profileBundles = readProfileBundles(profileManifest)
    const harnessBundles = this.harnessBundles()

    const errors: string[] = []
    const packages: PackageView[] = []

    let scanned: ScannedPackage[] = []
    try {
      scanned = scanInstalledPackages(this.profile.directory, profileManifest)
    } catch (error) {
      errors.push(`node_modules scan failed: ${errorMessage(error)}`)
    }

    for (const pkg of scanned) {
      const loaderEntriesForPkg = entriesByPackage.get(pkg.manifest.name) ?? []
      const verdict = classifyPackage({
        scanned: pkg,
        harnessBundles,
      })
      const isSystem = verdict.isSystem
      const isSelf = pkg.manifest.name === SELF_MODULE
      const enabled = loaderEntriesForPkg.length === 0
        ? pkg.manifest.bundle && profileBundles.declared.includes(pkg.manifest.name)
        : loaderEntriesForPkg.every((entry) => entry.enabled)
      const canDisable = !isSystem && loaderEntriesForPkg.some((entry) => !entry.protected)
      // The master can never uninstall itself, even though it is a user
      // install; everything else in the user group is removable.
      const canUninstall = !isSystem && !isSelf
      const uninstallBlockedReason: PackageView['uninstallBlockedReason'] = isSystem
        ? 'system'
        : isSelf
          ? 'self'
          : null
      const view = applyClassification(
        {
          packageName: pkg.manifest.name,
          version: pkg.manifest.version,
          description: pkg.manifest.description,
          homepage: pkg.manifest.homepage,
          repository: pkg.manifest.repository,
          author: pkg.manifest.author,
          keywords: pkg.manifest.keywords,
          installKind: pkg.manifest.installKind,
          installSpec: pkg.manifest.installSpec,
          bundle: pkg.manifest.bundle,
          declared: profileBundles.declared.includes(pkg.manifest.name),
          enabled,
          canDisable,
          canUninstall,
          uninstallBlockedReason,
          loaderEntries: loaderEntriesForPkg,
        },
        verdict,
      )
      packages.push(view)
    }

    packages.sort((a, b) => {
      if (a.isSystem !== b.isSystem) return a.isSystem ? -1 : 1
      return a.packageName.localeCompare(b.packageName)
    })

    const systemCount = packages.filter((pkg) => pkg.isSystem).length
    const userCount = packages.length - systemCount
    return {
      profile: this.profile.name,
      bundles: profileBundles.declared,
      systemCount,
      userCount,
      packages,
      errors,
    }
  }

  /** Adapter for the loader service without leaking the cordis types. */
  private loader(): { entries(): Iterable<LoaderEntryLike> } {
    return this.ctx.loader as unknown as { entries(): Iterable<LoaderEntryLike> }
  }

  /**
   * Pull a list of packages that ship with the Harness installation. The
   * implementation walks `node_modules/@deepseek-ai/*` under the harness
   * install root rather than re-deriving from the patch stack. The master
   * UI uses this to mark any package that already ships as system even if
   * the user explicitly added it to dependencies.
   */
  /**
   * List the packages that actually ship with the Harness installation:
   * the `@deepseek-ai/*` scope under the real (symlink-resolved) install
   * root of `@deepseek-ai/dsh`. This is the authoritative system set.
   *
   * Profile `node_modules` is deliberately NOT used: it mixes real
   * installs with user links (e.g. a theme linked as
   * `@deepseek-ai/dsh-client-ui-*`), so reading it here would mislabel
   * user packages as system.
   */
  private harnessBundles(): string[] {
    try {
      const dshPkg = findPackageJSON('@deepseek-ai/dsh', this.profile.directory)
      if (dshPkg === undefined) return []
      const realDshDir = realpathSync(dirname(dshPkg))
      const systemScope = join(realDshDir, 'node_modules', '@deepseek-ai')
      if (!existsSync(systemScope)) return []
      // The scope directory holds bare names ("dsh-base"); the scan and
      // the classify comparison use full package names, so map them.
      return readdirSync(systemScope).map((name) => `@deepseek-ai/${name}`)
    } catch {
      return []
    }
  }

  private findEntryInSnapshot(snapshot: PackageSnapshot, entryId: string): LoaderEntryView | null {
    for (const pkg of snapshot.packages) {
      for (const entry of pkg.loaderEntries) {
        if (entry.entryId === entryId) return entry
      }
    }
    return null
  }

  /**
   * Persist a config patch on the plugin master's own entry row in the
   * profile patch file. The row is a managed id-targeted override
   * (`- id: plugin-master / config: {...}` — no `name`, which is what
   * distinguishes an override from the insert that creates the entry).
   * The loader merges it into the master entry; HMR re-applies the master
   * with the new config. Prefers an existing managed override row and
   * updates it; otherwise appends one with the owner marker.
   */
  private async writeOwnConfig(patch: Record<string, unknown>): Promise<void> {
    const document = await readPatchDocument(this.profile.patchFile)
    if (!isSeq(document.contents)) {
      throw new Error(`${this.profile.patchFile} must contain a YAML sequence of patches`)
    }
    let row: YAMLMap | null = null
    let unmarkedOverride: YAMLMap | null = null
    for (const item of document.contents.items) {
      if (!isMap(item)) continue
      if (item.get('id') !== SELF_MODULE) continue
      // An override row targets the id without declaring a name; the
      // insert row carries the name and must not be touched.
      if (item.has('name')) continue
      if (typeof item.commentBefore === 'string' && item.commentBefore.includes(OWNER_MARKER)) {
        row = item
        break
      }
      unmarkedOverride ??= item
    }
    if (row === null) row = unmarkedOverride
    if (row === null) {
      const node = document.createNode({ id: SELF_MODULE, config: patch })
      document.contents.add(node)
      const added = document.contents.items.at(-1)
      if (added !== undefined && isMap(added)) added.commentBefore = OWNER_MARKER
    } else {
      const existing = row.get('config')
      const merged = (typeof existing === 'object' && existing !== null)
        ? { ...(existing as Record<string, unknown>), ...patch }
        : { ...patch }
      row.set('config', merged)
      if (typeof row.commentBefore !== 'string' || !row.commentBefore.includes(OWNER_MARKER)) {
        row.commentBefore = OWNER_MARKER
      }
    }
    await atomicWrite(this.profile.patchFile, String(document))
  }

  private failureReceipt(snapshot: PackageSnapshot, refId: string, message: string): MutationReceipt {
    return {
      succeeded: false,
      items: [{ entryId: refId, status: 'failed', message }],
      snapshot,
    }
  }

  private skipReceipt(snapshot: PackageSnapshot, refId: string, reason: string): MutationReceipt {
    return {
      succeeded: true,
      items: [{ entryId: refId, status: 'skipped', message: reason }],
      snapshot,
    }
  }

  private unchangedReceipt(snapshot: PackageSnapshot, refId: string): MutationReceipt {
    return {
      succeeded: true,
      items: [{ entryId: refId, status: 'unchanged', message: null }],
      snapshot,
    }
  }

  private changedReceipt(snapshot: PackageSnapshot, refId: string): MutationReceipt {
    return {
      succeeded: true,
      items: [{ entryId: refId, status: 'changed', message: null }],
      snapshot: this.buildSnapshot(),
    }
  }

  private restartRequiredReceipt(snapshot: PackageSnapshot, refId: string): MutationReceipt {
    return {
      succeeded: false,
      items: [
        {
          entryId: refId,
          status: 'restart-required',
          message: 'Restart the profile to apply this change.',
        },
      ],
      snapshot,
    }
  }

  private async waitForSettle(entryId: string, enabled: boolean): Promise<boolean> {
    const deadline = Date.now() + this.settleTimeoutMs
    while (Date.now() < deadline) {
      const entries = this.loader().entries()
      for (const entry of entries) {
        if (entry.id !== entryId) continue
        const isEnabled = entry.disabled !== true && entry.options.disabled !== true
        if (isEnabled === enabled) return true
        break
      }
      await new Promise((resolve) => setTimeout(resolve, 50))
    }
    return false
  }

  /** Serialize concurrent mutations so on-disk writes never interleave. */
  private async serialize<T>(operation: () => Promise<T>): Promise<T> {
    const previous = this.mutationTail
    let release: () => void = () => {}
    this.mutationTail = new Promise<void>((resolve) => {
      release = resolve
    })
    await previous
    try {
      return await operation()
    } finally {
      release()
    }
  }
}

/** Friendly error string for receipts. */
function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

/** Re-export the default protected ids for the host entry config. */
export { defaultProtectedIds }