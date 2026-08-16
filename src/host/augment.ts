/**
 * Type-level augmentation that exposes the loader service and the
 * pluginMaster gateway on the Cordis `Context` type. The `import type`
 * form triggers the loader package's `declare module` augmentation at
 * compile time WITHOUT emitting a runtime import — a plain side-effect
 * import would add a runtime `import "@deepseek-ai/cordis-plugin-loader"`
 * to the host bundle for no reason.
 */

import type {} from '@deepseek-ai/cordis-plugin-loader'

import type { PluginMasterGateway } from './plugin-master-gateway.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    pluginMaster: PluginMasterGateway
  }
}

export {}