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
  /** Development mode (default true): enables the quarantine tooling in the UI. */
  devMode?: boolean
}

export async function apply(ctx: Context, config: PluginMasterConfig = {}): Promise<void> {
  const gateway = new PluginMasterGateway(ctx, config)
  ctx.pluginMaster = gateway
}

export { PluginMasterGateway }