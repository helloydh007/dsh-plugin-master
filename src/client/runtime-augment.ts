/**
 * Type-level augmentation that pulls in the Cordis module augmentation
 * from `@deepseek-ai/dsh-client-runtime/client`, which adds `slots` (and
 * the runtime-owned standard kit props) to the slot framework's type
 * tables. Uses `import type` so no runtime import is emitted.
 */

import type {} from '@deepseek-ai/dsh-client-runtime/client'

export {}