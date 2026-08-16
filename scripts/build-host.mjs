/**
 * Build the host half: type-strip with tsc, then bundle the JS with
 * esbuild. Rolldown/oxc (the engines tsdown uses) do not yet emit the
 * TC39 stage 3 `__esDecorate` helper that
 * `@deepseek-ai/dsh-typert-protocol`'s `@Remote` decorator requires at
 * runtime, so we run esbuild directly. esbuild's SWC-based TS transform
 * produces a working stage-3 helper, and tsc still owns the type files
 * so consumers get accurate `.d.mts`.
 */

import { build } from 'esbuild'
import { copyFileSync, rmSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

const HOST_ENTRY = 'src/index.ts'
const INVARIANT_ENTRY = 'src/invariant.ts'
const REMOTE_ENTRY = 'src/remote.ts'

function buildEntry(entry, outFile, format) {
  return build({
    entryPoints: [entry],
    outfile: outFile,
    bundle: true,
    format,
    platform: 'node',
    target: 'node22',
    sourcemap: true,
    external: ['@deepseek-ai/*', 'cordis', 'cosmokit', 'yaml', 'node:*'],
    logLevel: 'info',
  })
}

console.log('[types] running tsc for declarations...')
const tsc = spawnSync('node_modules/.bin/tsc', ['-p', 'tsconfig.json', '--emitDeclarationOnly', '--declaration', '--outDir', 'lib/types'], { stdio: 'inherit' })
if (tsc.status !== 0) process.exit(tsc.status ?? 1)

console.log('[host] cleaning previous JS bundles...')
rmSync('lib/index.mjs', { force: true })
rmSync('lib/invariant.mjs', { force: true })

console.log('[host] bundling index.ts...')
await buildEntry(HOST_ENTRY, 'lib/types/index.mjs', 'esm')
copyFileSync('lib/types/index.mjs', 'lib/index.mjs')
console.log('[host] lib/index.mjs')

console.log('[host] bundling invariant.ts...')
await buildEntry(INVARIANT_ENTRY, 'lib/types/invariant.mjs', 'esm')
copyFileSync('lib/types/invariant.mjs', 'lib/invariant.mjs')
console.log('[invariant] lib/invariant.mjs')

console.log('[remote] bundling remote.ts...')
await buildEntry(REMOTE_ENTRY, 'lib/types/remote.mjs', 'esm')
copyFileSync('lib/types/remote.mjs', 'lib/remote.js')
console.log('[remote] lib/remote.js')

console.log('[host] done.')