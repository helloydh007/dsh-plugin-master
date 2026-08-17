/**
 * Development-mode quarantine for failing user plugins.
 *
 * DeepSeek Harness boots fail-loud: `assertEntriesActivated` (in
 * `dsh-app-boot`) rejects the whole tree when an *enabled* entry did not
 * activate, which is exactly what happens when a plugin you are developing
 * throws during `apply`. The harness then refuses to start, so you cannot
 * even open the UI to fix it.
 *
 * Development mode closes that loop. While it is on, the plugin master
 * scans the loader tree during its own `apply`, finds enabled *user*
 * entries whose fiber failed (or never became active), and calls
 * `entry.update({ disabled: true })`. Per the loader's semantics, a
 * failed entry has no live fiber (`previous?.uid` is absent), so the
 * update flips the in-memory disabled state without restarting or
 * throwing — and `assertEntriesActivated` then skips the entry, letting
 * the harness reach the UI. The isolation is runtime-only (nothing is
 * written to `cordis.patch.yml`), so the next boot retries the plugin;
 * the failure reason is retained by the master and shown in the UI.
 *
 * System packages and protected entries are never quarantined: their
 * failure is a real deployment problem that must stay fail-loud.
 */

import type { Context } from '@deepseek-ai/cordis'

import { packageRoot } from './loader-integration.ts'

/** Cordis FiberState const-enum mirror (see dsh-app-boot's copy). */
const FIBER_PENDING = 0
const FIBER_ACTIVE = 2
const FIBER_FAILED = 3

export interface QuarantineRecord {
  entryId: string
  configId: string
  moduleName: string
  error: string
}

export interface QuarantineOptions {
  /** Loader entry ids that are never quarantined. */
  protectedIds: ReadonlySet<string>
  /** Entry ids of the plugin master itself. */
  selfEntryIds: ReadonlySet<string>
  /** Full package names that ship with the Harness install root. */
  systemPackages: ReadonlySet<string>
}

interface FiberLike {
  state?: number
  error?: unknown
  inject?: Record<string, unknown>
}

interface EntryLike {
  id: string
  disabled?: boolean
  options: {
    id?: unknown
    name?: unknown
    group?: unknown
  }
  fiber?: FiberLike
  update?(options: { disabled?: boolean }, create?: boolean, force?: boolean): Promise<unknown>
}

/** True when the entry's module resolves to a system-shipped package. */
function isSystemEntry(entry: EntryLike, systemPackages: ReadonlySet<string>): boolean {
  if (typeof entry.options.name !== 'string') return false
  return systemPackages.has(packageRoot(entry.options.name))
}

/** Describe why an entry did not activate. */
function failureReason(entry: EntryLike): string {
  const fiber = entry.fiber
  if (fiber?.error !== undefined && fiber.error !== null) {
    return typeof fiber.error === 'string' ? fiber.error : String(fiber.error)
  }
  if (fiber === undefined) {
    return 'Module failed to load (see the error logged above at boot).'
  }
  if (fiber.state === FIBER_PENDING) {
    const missing = Object.keys(fiber.inject ?? {}).filter((service) => fiber.inject?.[service] === undefined)
    return `Pending — waiting for service${missing.length === 1 ? '' : 's'}: ${missing.join(', ') || 'unknown'}.`
  }
  return 'Plugin entry did not activate.'
}

/**
 * Scan the loader tree and quarantine every enabled, non-system, user
 * plugin that failed to activate. Returns the records so the caller can
 * retain them for the UI.
 */
export async function quarantineFailedEntries(
  ctx: Context,
  options: QuarantineOptions,
): Promise<QuarantineRecord[]> {
  const loader = ctx.loader as unknown as { entries(): Iterable<EntryLike> }
  const records: QuarantineRecord[] = []
  for (const entry of loader.entries()) {
    if (entry.options.group === true) continue
    if (entry.disabled === true) continue
    const configId = typeof entry.options.id === 'string' ? entry.options.id : entry.id
    if (options.protectedIds.has(configId) || options.protectedIds.has(entry.id)) continue
    if (options.selfEntryIds.has(entry.id)) continue
    if (isSystemEntry(entry, options.systemPackages)) continue

    const fiber = entry.fiber
    const failed = fiber !== undefined && fiber.state === FIBER_FAILED
    const neverActivated = fiber === undefined
    if (!failed && !neverActivated) continue

    const error = failureReason(entry)
    if (typeof entry.update !== 'function') continue
    try {
      // Failed entries have no live fiber; this flips the in-memory
      // disabled state without restarting or re-throwing.
      await entry.update({ disabled: true })
    } catch {
      continue
    }
    records.push({ entryId: entry.id, configId, moduleName: String(entry.options.name ?? configId), error })
  }
  return records
}

/** Re-export for callers that consume package roots. */
export { FIBER_ACTIVE, FIBER_PENDING, FIBER_FAILED }