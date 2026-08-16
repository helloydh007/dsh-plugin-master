/**
 * Compile-time invariant: the zh locale dictionary and the en locale
 * dictionary declare the same keys. If someone adds a Chinese key but
 * forgets the English copy (or vice versa), this module fails to compile.
 */

import { en, zh } from './client/locales.ts'

type Zh = typeof zh
type AssertSameKeys = En extends keyof Zh ? (Zh extends Record<En[number], unknown> ? true : false) : false
type En = keyof typeof en

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _assertKeys: AssertSameKeys = true

export const INVARIANT = { zh, en } as const