/**
 * Type-level augmentation that pulls in the slot contracts from the
 * settings package and declares the plugin master locale namespace.
 *
 * The `import type` form triggers the SDK package's `declare module`
 * augmentations at compile time WITHOUT emitting a runtime import. A
 * plain side-effect `import '@deepseek-ai/dsh-client-ui-settings/client'`
 * would leave a `require("@deepseek-ai/dsh-client-ui-settings/client")`
 * in the browser bundle, and that specifier is NOT in the shell's
 * platform module seed table — the factory would throw at load time.
 */

import type {} from '@deepseek-ai/dsh-client-ui-settings/client'

import type { LocaleKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    'plugin-master': LocaleKey
  }
}

export {}