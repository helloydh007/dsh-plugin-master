/**
 * Shared data types for the plugin master host service. These shapes are the
 * wire contract between the host service and the browser settings tab; the
 * client side imports the equivalent type definitions from the same source
 * through a thin re-export so the host and client stay in lock-step.
 */

export type FiberPhase =
  | 'pending'
  | 'loading'
  | 'active'
  | 'failed'
  | 'unloading'
  | null

export type InstallKind =
  | 'registry'
  | 'link'
  | 'file'
  | 'git'
  | 'tarball'
  | 'workspace'
  | 'unknown'

export type SourceKind = 'system' | 'user'

export type MutationStatus =
  | 'changed'
  | 'unchanged'
  | 'skipped'
  | 'restart-required'
  | 'failed'

/** One Cordis Loader entry that lives inside a package. */
export interface LoaderEntryView {
  entryId: string
  configId: string
  moduleName: string
  enabled: boolean
  phase: FiberPhase
  protected: boolean
  protectionReason: string | null
  error: string | null
}

/** Search hit descriptor returned alongside a matched package. */
export interface SearchHit {
  field: 'name' | 'description' | 'repository' | 'entryId' | 'moduleName' | 'configId'
  value: string
  score: number
}

/** One installed package, with all metadata and its loader entries attached. */
export interface PackageView {
  packageName: string
  version: string | null
  description: string | null
  homepage: string | null
  repository: string | null
  author: string | null
  keywords: string[]
  installKind: InstallKind
  installSpec: string | null
  bundle: boolean
  declared: boolean
  isSystem: boolean
  isUser: boolean
  enabled: boolean
  canUninstall: boolean
  canDisable: boolean
  /**
   * Machine-readable reason the package cannot be uninstalled, when
   * `canUninstall` is false: `'system'` (ships with Harness) or `'self'`
   * (the plugin master itself). The UI maps these to localized text.
   */
  uninstallBlockedReason: 'system' | 'self' | null
  loaderEntries: LoaderEntryView[]
  reasons: string[]
}

/** Full list snapshot returned by `list()`. */
export interface PackageSnapshot {
  profile: string
  bundles: string[]
  systemCount: number
  userCount: number
  packages: PackageView[]
  errors: string[]
}

/** One mutation outcome. */
export interface MutationItem {
  entryId: string
  status: MutationStatus
  message: string | null
}

/** Mutation receipt returned from `setEnabled` and `uninstall`. */
export interface MutationReceipt {
  succeeded: boolean
  items: MutationItem[]
  snapshot: PackageSnapshot
}

/** Search query options. */
export interface SearchOptions {
  query: string
  limit?: number
}

/** Search result. */
export interface SearchResult {
  query: string
  matchedPackages: PackageView[]
  totalMatches: number
  truncated: boolean
}