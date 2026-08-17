/**
 * Project the live Cordis Loader tree into the LoaderEntryView shape the
 * browser consumes. Skips structural group rows (entries whose `options`
 * declare `group`), exposes the same fields the inventory Remote uses
 * (entryId, configId, moduleName, enabled, fiber phase), plus the
 * protected-id verdict the master needs to render the right controls.
 *
 * The function is pure — given a snapshot of Loader entries plus the
 * protected-id set, it returns the views. The host service re-fetches
 * Loader entries on every list call so the projection is always current.
 */

import type { FiberPhase, LoaderEntryView } from './types.ts'

/** Cordis Fiber state enum mirror — keeps the master independent of cordis internals. */
const FIBER_STATE = {
  PENDING: 0,
  LOADING: 1,
  ACTIVE: 2,
  FAILED: 3,
  DISPOSED: 4,
  UNLOADING: 5,
} as const

const FIBER_PHASE: Record<number, FiberPhase> = {
  [FIBER_STATE.PENDING]: 'pending',
  [FIBER_STATE.LOADING]: 'loading',
  [FIBER_STATE.ACTIVE]: 'active',
  [FIBER_STATE.FAILED]: 'failed',
  [FIBER_STATE.DISPOSED]: null,
  [FIBER_STATE.UNLOADING]: 'unloading',
}

/** Shape we expect a Cordis Loader entry to expose. */
export interface LoaderEntryLike {
  id: string
  options: {
    id?: unknown
    name?: unknown
    group?: unknown
    disabled?: unknown
  }
  disabled?: unknown
  fiber?: {
    state?: number
    error?: unknown
  }
}

/**
 * Walk the Loader entries and project the non-group rows into the
 * browser-facing shape.
 */
export function projectLoaderEntries(entries: Iterable<LoaderEntryLike>, protectedIds: ReadonlySet<string>): LoaderEntryView[] {
  const out: LoaderEntryView[] = []
  for (const entry of entries) {
    if (entry.options.group === true) continue
    const entryId = entry.id
    const configId = typeof entry.options.id === 'string' ? entry.options.id : entryId
    const moduleName = typeof entry.options.name === 'string' ? entry.options.name : ''
    const enabled = entry.disabled !== true && entry.options.disabled !== true
    const fiberState = entry.fiber?.state
    const phase = typeof fiberState === 'number' ? (FIBER_PHASE[fiberState] ?? null) : null
    const protectedById = protectedIds.has(configId) || protectedIds.has(entryId)
    const error = entry.fiber?.error !== undefined ? String(entry.fiber.error) : null
    out.push({
      entryId,
      configId,
      moduleName,
      enabled,
      phase,
      protected: protectedById,
      protectionReason: protectedById
        ? 'This entry is required by profile reload or the Web management surface.'
        : null,
      error,
      quarantined: false,
    })
  }
  return out
}

/** Group loader entries by their package root (`@scope/name` or `name`). */
export function groupEntriesByPackage(entries: readonly LoaderEntryView[]): Map<string, LoaderEntryView[]> {
  const map = new Map<string, LoaderEntryView[]>()
  for (const entry of entries) {
    const key = packageRoot(entry.moduleName || entry.configId || entry.entryId)
    const list = map.get(key) ?? []
    list.push(entry)
    map.set(key, list)
  }
  return map
}

/**
 * Reduce a module specifier to its package root. `@scope/foo/bar` →
 * `@scope/foo`; `name/sub` → `name`; `cordis:foo` stays unchanged (Cordis
 * runtime uses virtual specifiers that we never treat as a user package).
 */
export function packageRoot(moduleName: string): string {
  if (moduleName.startsWith('cordis:')) return moduleName
  const parts = moduleName.split('/')
  if (moduleName.startsWith('@')) {
    return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : moduleName
  }
  return parts[0] ?? moduleName
}