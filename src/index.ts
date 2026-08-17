/**
 * Host half of the plugin master: registers the PluginMasterGateway as a
 * Cordis Service so the browser settings tab can call it via Typert. The
 * service itself lives in `./host/plugin-master-gateway.ts`; this entry is
 * the loader patch row the harness installer mounts.
 */

import './host/augment.ts'

import type { Context } from '@deepseek-ai/cordis'

import { PluginMasterGateway } from './host/plugin-master-gateway.ts'

export const name = 'dsh-plugin-master'
export const inject = ['loader']

export interface PluginMasterConfig {
  protectedEntries?: string[]
  settleTimeoutMs?: number
  uninstallTimeoutMs?: number
  /** Development mode (default true): quarantine failing user plugins at boot. */
  devMode?: boolean
}

export async function apply(ctx: Context, config: PluginMasterConfig = {}): Promise<void> {
  const gateway = new PluginMasterGateway(ctx, config)
  ctx.pluginMaster = gateway
  if (gateway.devMode) {
    // The loader activates sibling entries in parallel and only throws
    // after the whole tree settles, so the master's apply can outlast
    // them: quarantine what already failed, wait for the rest to settle
    // (late failures included), then quarantine again. Entries quarantined
    // this way have their failed fiber cleared by `entry.update`, so the
    // boot audit no longer sees them and the UI starts anyway.
    await gateway.runQuarantine(ctx)
    await gateway.waitForTreeSettled(ctx)
    await gateway.runQuarantine(ctx)
  }
}

export { PluginMasterGateway }