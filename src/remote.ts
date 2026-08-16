/**
 * Typert wire contract for the plugin master: zod v4 schemas for every
 * host Remote payload, the client contribution (`TYPERT_REMOTE`) the
 * browser half mounts via `ctx.remote.$mount`, and the host artifact
 * (`TYPERT`) served through the package's `./typert` export so the
 * typert-loader can expose the pluginMaster invocations to the gateway.
 *
 * The shapes must stay in lock-step with `./host/types.ts` — the client
 * half imports the same type definitions from there for its annotations,
 * and this module is the single source of the runtime wire schemas.
 */

import { z } from 'zod'

const fiberPhase = z.union([
  z.literal(null),
  z.literal('pending'),
  z.literal('loading'),
  z.literal('active'),
  z.literal('failed'),
  z.literal('unloading'),
])

const installKind = z.union([
  z.literal('registry'),
  z.literal('link'),
  z.literal('file'),
  z.literal('git'),
  z.literal('tarball'),
  z.literal('workspace'),
  z.literal('unknown'),
])

const mutationStatus = z.union([
  z.literal('changed'),
  z.literal('unchanged'),
  z.literal('skipped'),
  z.literal('restart-required'),
  z.literal('failed'),
])

const loaderEntry = z.object({
  entryId: z.string(),
  configId: z.string(),
  moduleName: z.string(),
  enabled: z.boolean(),
  phase: fiberPhase,
  protected: z.boolean(),
  protectionReason: z.string().nullable(),
  error: z.string().nullable(),
}).readonly()

const packageView = z.object({
  packageName: z.string(),
  version: z.string().nullable(),
  description: z.string().nullable(),
  homepage: z.string().nullable(),
  repository: z.string().nullable(),
  author: z.string().nullable(),
  keywords: z.array(z.string()).readonly(),
  installKind,
  installSpec: z.string().nullable(),
  bundle: z.boolean(),
  declared: z.boolean(),
  isSystem: z.boolean(),
  isUser: z.boolean(),
  enabled: z.boolean(),
  canUninstall: z.boolean(),
  canDisable: z.boolean(),
  uninstallBlockedReason: z.union([
    z.literal('system'),
    z.literal('self'),
    z.literal(null),
  ]),
  loaderEntries: z.array(loaderEntry).readonly(),
  reasons: z.array(z.string()).readonly(),
}).readonly()

const packageSnapshot = z.object({
  profile: z.string(),
  bundles: z.array(z.string()).readonly(),
  systemCount: z.number(),
  userCount: z.number(),
  packages: z.array(packageView).readonly(),
  errors: z.array(z.string()).readonly(),
}).readonly()

const mutationItem = z.object({
  entryId: z.string(),
  status: mutationStatus,
  message: z.string().nullable(),
}).readonly()

const mutationReceipt = z.object({
  succeeded: z.boolean(),
  items: z.array(mutationItem).readonly(),
  snapshot: packageSnapshot,
}).readonly()

const searchOptions = z.object({
  query: z.string(),
  limit: z.number().optional(),
}).readonly()

const searchResult = z.object({
  query: z.string(),
  matchedPackages: z.array(packageView).readonly(),
  totalMatches: z.number(),
  truncated: z.boolean(),
}).readonly()

const strict = (typeSymbol: string, schema: z.ZodType) => ({
  mode: 'strict' as const,
  typeSymbol,
  schema,
})

const parameter = (name: string, schema: z.ZodType) => ({
  name,
  wire: name,
  source: 'json' as const,
  codec: strict(`dsh-plugin-master/types#${name}`, schema),
})

const descriptor = (method: string, parameters: ReturnType<typeof parameter>[], result: z.ZodType, type: string) => ({
  id: `dsh-plugin-master#pluginMaster/${method}`,
  service: 'pluginMaster',
  namespace: 'pluginMaster',
  method,
  invocation: { kind: 'direct' as const },
  parameters,
  result: strict(`dsh-plugin-master/types#${type}`, result),
})

const descriptors = [
  descriptor('list', [], packageSnapshot, 'PackageSnapshot'),
  descriptor('search', [parameter('options', searchOptions)], searchResult, 'SearchResult'),
  descriptor('setEntryEnabled', [parameter('entryId', z.string()), parameter('enabled', z.boolean())], mutationReceipt, 'MutationReceipt'),
  descriptor('setPackageEnabled', [parameter('packageName', z.string()), parameter('enabled', z.boolean())], mutationReceipt, 'MutationReceipt'),
  descriptor('uninstall', [parameter('packageName', z.string())], mutationReceipt, 'MutationReceipt'),
]

/** Client half contribution: mounted via `ctx.remote.$mount(TYPERT_REMOTE)`. */
const TYPERT_REMOTE = {
  package: 'dsh-plugin-master',
  descriptors,
}

/** Host half artifact: loaded by the typert-loader from `exports["./typert"]`. */
const TYPERT = {
  package: 'dsh-plugin-master',
  face: 'host' as const,
  schemas: [] as unknown[],
  invocations: descriptors,
  model: {
    services: [] as unknown[],
    events: [] as unknown[],
    objects: [] as unknown[],
  },
}

export { TYPERT, TYPERT_REMOTE, TYPERT_REMOTE as default }
