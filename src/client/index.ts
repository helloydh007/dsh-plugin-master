/**
 * Browser half of the plugin master: registers the plugin master tab in
 * the Web Settings -> Plugins page. The tab receives a small Remote face
 * (list / search / setEnabled / uninstall) through the SDK's `inject`
 * channel and a locale-bound translate function through `t`. The
 * inventory-like stub from the official harness is replaced because the
 * bundle patch disables the official `ui-settings-plugin-inventory` id.
 *
 * The `remote.pluginMaster` namespace is created by this half: `apply`
 * first mounts the pluginMaster `TYPERT_REMOTE` contribution through
 * `ctx.remote.$mount(...)`, then the tab registers inside a nested
 * `ctx.inject(['remote.pluginMaster'], ...)` scope. The entry-level
 * `inject` must NOT list `remote.pluginMaster` — doing so would make the
 * loader wait for a service that only this `apply` creates (a permanent
 * pending state).
 */

import './slots-augment.ts'
import './remote-augment.ts'
import './locale-augment.ts'
import './runtime-augment.ts'
import './remote-context-augment.ts'

import type { Context } from '@deepseek-ai/cordis'

import type { PackageSnapshot, PackageView, MutationReceipt, SearchOptions } from '../host/types.ts'
import { TYPERT_REMOTE } from '../remote.ts'
import { locales } from './locales.ts'
import { pluginMasterCss } from './styles.ts'
import { PluginMasterTab } from './components/PluginMasterTab.tsx'

const NS = 'plugin-master'
const TAB_ID = 'master'
const PLUGIN_ID = 'dsh-plugin-master'

interface PluginMasterTabInjectFace {
  list: () => Promise<PackageSnapshot>
  search: (options: SearchOptions) => Promise<{ matchedPackages: PackageView[]; totalMatches: number; truncated: boolean }>
  setEntryEnabled: (entryId: string, enabled: boolean) => Promise<MutationReceipt>
  setPackageEnabled: (packageName: string, enabled: boolean) => Promise<MutationReceipt>
  uninstall: (packageName: string) => Promise<MutationReceipt>
}

interface RemoteEnvelope<T> {
  ok: boolean
  value?: T
  error?: { code: string; message: string; details?: unknown }
}

async function unwrap<T>(envelope: RemoteEnvelope<T>): Promise<T> {
  if (envelope.ok && envelope.value !== undefined) return envelope.value
  const err = envelope.error ?? { code: 'unknown', message: 'unknown error' }
  throw new Error(`${err.code}: ${err.message}`)
}

/**
 * Inject the plugin's stylesheet once. The CSS is shipped as a plain
 * string (`styles.ts`); a `<style data-plugin-css>` tag carries it so the
 * loader can remove plugin-owned styles on unload.
 */
function injectStylesheet(css: string): void {
  if (typeof document === 'undefined') return
  const tagId = `${PLUGIN_ID}/styles`
  if (document.querySelector(`style[data-plugin-css="${tagId}"]`) !== null) return
  const tag = document.createElement('style')
  tag.dataset.plugin = PLUGIN_ID
  tag.dataset.pluginCss = tagId
  tag.textContent = css
  document.head.appendChild(tag)
}

export const inject = ['slots', 'locale', 'remote']

export async function apply(ctx: Context): Promise<() => Promise<void>> {
  injectStylesheet(pluginMasterCss)

  // Mount the pluginMaster remote contribution FIRST — this is what makes
  // `ctx.remote.pluginMaster` exist in the browser.
  const disposeRemote = await ctx.remote.$mount(TYPERT_REMOTE)

  const disposeLocale = ctx.locale.register(NS, { zh: locales.zh, en: locales.en })

  const feature = ctx.inject(['remote.pluginMaster'], (scope) => {
    const t = scope.locale.bind(NS)

    const face: PluginMasterTabInjectFace = {
      list: async () => unwrap(await scope.remote.pluginMaster.list()),
      search: async (options: SearchOptions) => unwrap(await scope.remote.pluginMaster.search(options)),
      setEntryEnabled: async (entryId: string, enabled: boolean) =>
        unwrap(await scope.remote.pluginMaster.setEntryEnabled(entryId, enabled)),
      setPackageEnabled: async (packageName: string, enabled: boolean) =>
        unwrap(await scope.remote.pluginMaster.setPackageEnabled(packageName, enabled)),
      uninstall: async (packageName: string) => unwrap(await scope.remote.pluginMaster.uninstall(packageName)),
    }

    const injected: () => PluginMasterTabInjectFace = () => face

    const options = {
      name: 'settings.plugins.tab' as const,
      id: TAB_ID,
      order: 5,
      label: () => t('tab'),
      locale: NS as 'plugin-master',
      inject: injected,
    }

    scope.slots.inject('settings.plugins.tab', () =>
      scope.slots.register(options, PluginMasterTab),
    )
  })

  return async () => {
    await feature.dispose()
    disposeLocale()
    await disposeRemote()
  }
}

export { PluginMasterTab }
