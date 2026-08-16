/**
 * Type-level augmentation that pulls in the Cordis module augmentation
 * from `@deepseek-ai/dsh-client-locale/client`, which adds `locale` to
 * the Context interface. Uses `import type` so no runtime import is
 * emitted (see slots-augment.ts for why runtime imports are forbidden).
 */

import type {} from '@deepseek-ai/dsh-client-locale/client'

export {}