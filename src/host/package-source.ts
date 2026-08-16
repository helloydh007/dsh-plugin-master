/**
 * Walk the profile's `node_modules` tree and collect every installed
 * dependency alongside the manifest fields that the master UI cares about
 * (name, version, description, homepage, repository URL, keywords, install
 * kind, install spec, declared `dsh.bundle`). The result is consumed by
 * `classify.ts` and `manifest.ts`; nothing here decides system-vs-user.
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

import type { InstallKind } from './types.ts'

export interface RawManifest {
  name: string
  version: string | null
  description: string | null
  homepage: string | null
  repository: string | null
  author: string | null
  keywords: string[]
  installKind: InstallKind
  installSpec: string | null
  bundle: boolean
}

export interface ScannedPackage {
  /** The directory holding the package, used for symlink resolution checks. */
  directory: string
  /** Resolved top-level package directory (symlinks resolved). */
  realDirectory: string
  manifest: RawManifest
  installKind: InstallKind
  installSpec: string | null
}

const SCOPED_PREFIX = '@'

/**
 * Read one package.json and project only the fields this plugin uses.
 */
function readManifest(directory: string, installKind: InstallKind, installSpec: string | null): RawManifest | null {
  const file = join(directory, 'package.json')
  if (!existsSync(file)) return null
  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>
  } catch {
    return null
  }
  const name = typeof parsed.name === 'string' ? parsed.name : null
  if (name === null) return null
  const version = typeof parsed.version === 'string' ? parsed.version : null
  const description = typeof parsed.description === 'string' ? parsed.description : null
  const homepage = typeof parsed.homepage === 'string' ? parsed.homepage : null
  const author = readAuthor(parsed.author)
  const keywords = readKeywords(parsed.keywords)
  const repository = readRepository(parsed.repository)
  const bundle = readBundleFlag(parsed.dsh)
  return {
    name,
    version,
    description,
    homepage,
    repository,
    author,
    keywords,
    installKind,
    installSpec,
    bundle,
  }
}

function readAuthor(value: unknown): string | null {
  if (typeof value === 'string') return value
  if (typeof value === 'object' && value !== null) {
    const obj = value as Record<string, unknown>
    if (typeof obj.name === 'string') return obj.name
  }
  return null
}

function readKeywords(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
}

function readRepository(value: unknown): string | null {
  if (typeof value === 'string') return value
  if (typeof value === 'object' && value !== null) {
    const obj = value as Record<string, unknown>
    if (typeof obj.url === 'string') return obj.url
  }
  return null
}

function readBundleFlag(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false
  const bundle = (value as Record<string, unknown>).bundle
  if (typeof bundle !== 'object' || bundle === null) return false
  return typeof (bundle as Record<string, unknown>).patch === 'string'
}

/**
 * Inspect one `dependencies` entry and decide its install kind from the
 * spec string. pnpm stores the original spec verbatim in `package.json`,
 * so we recover the user's intent (link, file, git, tarball, registry)
 * without parsing the lockfile.
 */
export function classifyInstallSpec(spec: string): { kind: InstallKind; normalized: string } {
  if (spec.startsWith('link:')) return { kind: 'link', normalized: spec }
  if (spec.startsWith('file:')) return { kind: 'file', normalized: spec }
  if (spec.startsWith('git+') || spec.startsWith('github:') || /\.git(#|$)/.test(spec)) {
    return { kind: 'git', normalized: spec }
  }
  if (spec.startsWith('workspace:')) return { kind: 'workspace', normalized: spec }
  if (spec.endsWith('.tgz') || spec.endsWith('.tar.gz')) return { kind: 'tarball', normalized: spec }
  return { kind: 'registry', normalized: spec }
}

/**
 * Resolve the on-disk directory for one top-level dependency. Handles
 * scoped subfolders (`@scope/name`) and resolves symlinks so the master
 * can detect link-vs-installed correctly.
 */
export function resolvePackageDirectory(nodeModules: string, dependency: string): string | null {
  const scoped = dependency.startsWith(SCOPED_PREFIX)
  if (scoped) {
    const slash = dependency.indexOf('/')
    if (slash < 0) return null
    const scope = dependency.slice(0, slash)
    const name = dependency.slice(slash + 1)
    return join(nodeModules, scope, name)
  }
  return join(nodeModules, dependency)
}

/**
 * Iterate the `dependencies` of a profile's package.json, returning one
 * ScannedPackage per declared dependency whose manifest is readable. The
 * returned list is in dependency-declaration order; the caller can sort or
 * group later. Unreadable manifests are skipped (returns no entry) — the
 * caller can surface the missing dependency separately if needed.
 */
export function scanInstalledPackages(profileDir: string, profileManifest: Record<string, unknown>): ScannedPackage[] {
  const nodeModules = join(profileDir, 'node_modules')
  const dependencies = readDependencies(profileManifest)
  const out: ScannedPackage[] = []
  for (const [name, spec] of Object.entries(dependencies)) {
    const directory = resolvePackageDirectory(nodeModules, name)
    if (directory === null || !existsSync(directory)) continue
    let realDirectory = directory
    try {
      realDirectory = statSync(directory).isDirectory() ? directory : directory
    } catch {
      continue
    }
    const manifest = readManifest(realDirectory, spec.kind, spec.normalized)
    if (manifest === null) continue
    out.push({
      directory,
      realDirectory,
      manifest,
      installKind: spec.kind,
      installSpec: spec.normalized,
    })
  }
  return out
}

function readDependencies(manifest: Record<string, unknown>): Record<string, { kind: InstallKind; normalized: string }> {
  const out: Record<string, { kind: InstallKind; normalized: string }> = {}
  const deps = manifest.dependencies
  if (typeof deps === 'object' && deps !== null) {
    for (const [name, spec] of Object.entries(deps as Record<string, unknown>)) {
      if (typeof spec !== 'string') continue
      out[name] = classifyInstallSpec(spec)
    }
  }
  return out
}

/**
 * List the top-level entries under `node_modules` for diagnostic use; not
 * used in the hot path of `scanInstalledPackages`, but exposed so the host
 * service can report any present-but-undeclared packages in its snapshot
 * for the "Untracked" affordance.
 */
export function listNodeModuleEntries(nodeModules: string): string[] {
  if (!existsSync(nodeModules)) return []
  let entries: string[]
  try {
    entries = readdirSync(nodeModules)
  } catch {
    return []
  }
  const out: string[] = []
  for (const entry of entries) {
    if (entry.startsWith('.')) continue
    if (entry.startsWith(SCOPED_PREFIX)) {
      const scopeDir = join(nodeModules, entry)
      let scoped: string[]
      try {
        scoped = readdirSync(scopeDir)
      } catch {
        continue
      }
      for (const inner of scoped) out.push(`${entry}/${inner}`)
      continue
    }
    out.push(entry)
  }
  return out
}