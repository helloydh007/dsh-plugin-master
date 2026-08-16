/**
 * Client-half service dependency scanner. The web boot graph (built by
 * `@deepseek-ai/dsh-client-modules`) drops a package's browser bundle the
 * moment its host loader entry is disabled — but only that bundle knows
 * which services it provides and which it injects. The host half of every
 * plugin carries an empty `inject`, so the Cordis Loader cannot see these
 * edges. This module reads the installed packages' built client bundles
 * (`exports["./client"]`) and extracts:
 *
 *   - `inject`   — services the browser half requires (const/exports.inject)
 *   - `provide`  — services the browser half registers (ctx.provide / the
 *                  TypertRemoteService super(ctx, ...) service key)
 *
 * The gateway uses the result to block disabling an entry whose client
 * services other enabled entries still depend on (otherwise the dependents
 * hang in `pending (waiting for service: ...)` and the web boot fails).
 */

import { readFileSync } from 'node:fs'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

import { resolvePackageDirectory } from './package-source.ts'
import type { LoaderEntryLike } from './loader-integration.ts'

export interface ClientDeps {
  /** Services this package's client half requires. */
  inject: string[]
  /** Services this package's client half registers. */
  provides: string[]
}

const INJECT_PATTERN = /(?:exports\.inject|const inject)\s*=\s*(\[[^\]]*\])/
const PROVIDE_PATTERN = /(?:ctx\.)?provide\(\s*"([^"]+)"|super\(\s*ctx,\s*"([^"]+)"\s*\)/g

/** Read the built client bundle path from `exports["./client"]`. */
function clientBundlePath(nodeModules: string, packageName: string): string | null {
  const directory = resolvePackageDirectory(nodeModules, packageName)
  if (directory === null) return null
  const manifestFile = join(directory, 'package.json')
  if (!existsSync(manifestFile)) return null
  let exportsField: unknown
  try {
    exportsField = JSON.parse(readFileSync(manifestFile, 'utf8')).exports
  } catch {
    return null
  }
  if (typeof exportsField !== 'object' || exportsField === null) return null
  const client = (exportsField as Record<string, unknown>)['./client']
  if (typeof client === 'string') return join(directory, client)
  if (typeof client === 'object' && client !== null) {
    const fallback = (client as Record<string, unknown>).default
    if (typeof fallback === 'string') return join(directory, fallback)
  }
  return null
}

/**
 * Scan one package's built client bundle for its service inject/provide
 * lists. Returns null when the package has no readable client bundle (it is
 * host-only, or the bundle is missing) — such packages participate in no
 * client dependency edges.
 */
export function scanClientDeps(nodeModules: string, packageName: string): ClientDeps | null {
  const bundle = clientBundlePath(nodeModules, packageName)
  if (bundle === null || !existsSync(bundle)) return null
  let source: string
  try {
    source = readFileSync(bundle, 'utf8')
  } catch {
    return null
  }
  const inject = extractInject(source)
  const provides = extractProvides(source)
  if (inject.length === 0 && provides.length === 0) return null
  return { inject, provides }
}

function extractInject(source: string): string[] {
  const match = INJECT_PATTERN.exec(source)
  if (match === null || match[1] === undefined) return []
  try {
    const parsed = JSON.parse(match[1].replaceAll("'", '"')) as unknown
    if (Array.isArray(parsed)) return parsed.filter((item): item is string => typeof item === 'string')
  } catch {
    // Fall through to the empty list — a malformed literal carries no
    // dependency we can trust.
  }
  return []
}

function extractProvides(source: string): string[] {
  const out: string[] = []
  PROVIDE_PATTERN.lastIndex = 0
  for (const match of source.matchAll(PROVIDE_PATTERN)) {
    const name = match[1] ?? match[2]
    if (name !== undefined && !out.includes(name)) out.push(name)
  }
  return out
}

/**
 * Map every installed package's client services to the entries that
 * consume them, for the gateway's disable guard.
 */
export interface ClientDependencyIndex {
  /** service name → packages whose client half provides it. */
  providersByService: Map<string, string[]>
  /** package name → services its client half injects. */
  injectByPackage: Map<string, string[]>
}

/**
 * Build the client dependency index over the live loader entries. Every
 * entry maps to its package root (the module-name package), and each
 * distinct package is scanned once.
 */
export function buildClientDependencyIndex(
  nodeModules: string,
  entries: Iterable<LoaderEntryLike>,
): ClientDependencyIndex {
  const providersByService = new Map<string, string[]>()
  const injectByPackage = new Map<string, string[]>()
  const scanned = new Set<string>()
  for (const entry of entries) {
    if (typeof entry.options.name !== 'string') continue
    const packageName = packageRootOf(entry.options.name)
    if (scanned.has(packageName)) continue
    scanned.add(packageName)
    const deps = scanClientDeps(nodeModules, packageName)
    if (deps === null) continue
    if (deps.inject.length > 0) injectByPackage.set(packageName, deps.inject)
    for (const service of deps.provides) {
      const list = providersByService.get(service) ?? []
      list.push(packageName)
      providersByService.set(service, list)
    }
  }
  return { providersByService, injectByPackage }
}

/**
 * Find the enabled packages whose client half injects a service that the
 * given package provides. Used to refuse disabling a provider while its
 * consumers are still enabled — the web boot would otherwise hang.
 */
export function findDependentPackages(
  index: ClientDependencyIndex,
  providerPackage: string,
  isEnabled: (packageName: string) => boolean,
): string[] {
  const deps = index.injectByPackage
  const dependents: string[] = []
  for (const [consumer, services] of deps) {
    if (consumer === providerPackage) continue
    if (!isEnabled(consumer)) continue
    for (const service of services) {
      const providers = index.providersByService.get(service)
      if (providers !== undefined && providers.includes(providerPackage)) {
        dependents.push(consumer)
        break
      }
    }
  }
  return dependents
}

/** Reduce a module specifier to its package root (`@scope/name` or `name`). */
function packageRootOf(moduleName: string): string {
  if (moduleName.startsWith('cordis:')) return moduleName
  const parts = moduleName.split('/')
  if (moduleName.startsWith('@')) {
    return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : moduleName
  }
  return parts[0] ?? moduleName
}
