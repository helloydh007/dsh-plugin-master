/**
 * Type-level augmentation that pulls in the Cordis module augmentation
 * from `@deepseek-ai/dsh-api-remotes/client`, which adds `remote` to the
 * Context interface. Uses `import type` so no runtime import is emitted.
 */

import type {} from '@deepseek-ai/dsh-api-remotes/client'

export {}