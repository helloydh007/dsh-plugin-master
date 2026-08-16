/**
 * IDs that the master UI must never disable or uninstall, because doing
 * so would crash the running tree, the Web management surface, or the
 * plugin master itself. The default set is composed with the operator's
 * `protectedEntries` configuration so deployments can add deployment-
 * specific ids (auth providers, custom gateways) without touching the
 * package source.
 */

const DEFAULT_PROTECTED_IDS: ReadonlySet<string> = new Set([
  // Cordis + Loader plumbing
  'include',
  'modules',
  'timer',
  'hmr',
  // Host runner
  'cordis-host-runner',
  'runtime',
  // Settings / Web shell
  'ui-settings',
  'ui-settings-general',
  'ui-settings-plugins',
  // Client runtime
  'client-runtime',
  'client-modules',
  'client-locale',
  'client-hmr',
  // Server
  'api-gateway',
  'api-remotes',
  'webserver',
  // Master itself + its declared machinery
  'plugin-master',
])

export function defaultProtectedIds(): ReadonlySet<string> {
  return DEFAULT_PROTECTED_IDS
}

/**
 * Build the effective protected-id set from defaults + the plugin's
 * config-time `protectedEntries` list. The result is mutable so the host
 * service can add ad-hoc entries (the master's own loader id, profile
 * HMR) at construction time without having to copy the set on every
 * lookup.
 */
export function buildProtectedIds(extra: readonly string[] = []): Set<string> {
  const merged = new Set(DEFAULT_PROTECTED_IDS)
  for (const id of extra) merged.add(id)
  return merged
}

/**
 * Whether the plugin master's own entry (or an ancestor that owns it)
 * counts as protected. The host adds the master's own id plus its parent
 * chain so the page cannot disable itself by toggling the bundle that
 * provides it.
 */
export function masterEntryIsProtected(masterEntryIds: readonly string[]): Set<string> {
  return new Set(masterEntryIds)
}