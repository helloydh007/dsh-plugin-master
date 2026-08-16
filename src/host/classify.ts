/**
 * Decide whether one installed package is system-shipped (ships with the
 * DeepSeek Harness installation itself) or user-installed (anything the
 * operator added via `dsh plugin add`, a local link, or a tarball).
 *
 * The ONLY reliable system signal is membership in the Harness install
 * root's `node_modules/@deepseek-ai/` directory. Everything else that
 * might look like "system" is NOT a valid signal, and each false signal
 * was removed after it mis-classified real user installs:
 *
 *   - profile `bundles` list — it also contains every user plugin added
 *     with `dsh plugin add`, so it cannot separate system from user.
 *   - the `@deepseek-ai/` scope prefix — users can install packages that
 *     impersonate the scope (e.g. a theme published as
 *     `@deepseek-ai/dsh-client-ui-*`); scope alone is not authority.
 *
 * A package that owns a protected Loader entry is NOT re-classified as a
 * system package either: it stays in its group, and the protection is
 * reported through `canUninstall`/`uninstallBlockedReason` instead.
 *
 * The verdict emits a human-readable `reasons` array so the UI can show
 * the user *why* a package is classified as system if it is surprising.
 */

import type { PackageView } from './types.ts'
import type { ScannedPackage } from './package-source.ts'

export interface ClassifyInput {
  scanned: ScannedPackage
  /** Packages that ship with the Harness install root (authoritative). */
  harnessBundles: string[]
}

export interface ClassifyOutput {
  source: 'system' | 'user'
  isSystem: boolean
  isUser: boolean
  reasons: string[]
}

/**
 * Decide one package's source. Only the authoritative harness list is
 * consulted; profile bundles and scope prefixes are deliberately NOT
 * treated as system signals (see the module doc for why).
 */
export function classifyPackage(input: ClassifyInput): ClassifyOutput {
  const { scanned, harnessBundles } = input
  const reasons: string[] = []
  let isSystem = false

  if (harnessBundles.includes(scanned.manifest.name)) {
    isSystem = true
    reasons.push(`Ships with the Harness installation (${scanned.manifest.name}).`)
  }

  if (!isSystem && scanned.installKind === 'link') {
    // Link-installed packages are typical of dev workflows; they stay in
    // the user group regardless of scope.
    reasons.push(`Linked from a local checkout (${scanned.manifest.installSpec ?? 'unknown path'}).`)
  }

  if (reasons.length === 0) {
    reasons.push('User-installed dependency.')
  }

  return {
    source: isSystem ? 'system' : 'user',
    isSystem,
    isUser: !isSystem,
    reasons,
  }
}

/**
 * Apply the verdict to a partial PackageView. Pure function — no IO, no
 * side effects — so the host service can re-classify on every list call
 * without worrying about caching stale verdicts.
 */
export function applyClassification(
  partial: Omit<PackageView, 'isSystem' | 'isUser' | 'reasons'>,
  verdict: ClassifyOutput,
): PackageView {
  return {
    ...partial,
    isSystem: verdict.isSystem,
    isUser: verdict.isUser,
    reasons: verdict.reasons,
  }
}

/** Re-export for callers that consume the verdict shape. */
export type { PackageView }