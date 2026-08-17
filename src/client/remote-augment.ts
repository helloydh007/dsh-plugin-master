/**
 * Module augmentation that exposes the pluginMaster Remote namespace on
 * the Typert Client Remote surface. Without this declaration, accessing
 * `ctx.remote.pluginMaster.*` from the browser would be a type error even
 * though the gateway exposes those methods at runtime.
 */

import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'

import type {
  MutationReceipt,
  PackageSnapshot,
  PackageView,
  SearchOptions,
} from '../host/types.ts'

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface TypertRemoteMap {
    'pluginMaster/list': () => Promise<RemoteResult<PackageSnapshot>>
    'pluginMaster/search': (options: SearchOptions) => Promise<RemoteResult<{ matchedPackages: PackageView[]; totalMatches: number; truncated: boolean }>>
    'pluginMaster/setEntryEnabled': (entryId: string, enabled: boolean) => Promise<RemoteResult<MutationReceipt>>
    'pluginMaster/setPackageEnabled': (packageName: string, enabled: boolean) => Promise<RemoteResult<MutationReceipt>>
    'pluginMaster/uninstall': (packageName: string) => Promise<RemoteResult<MutationReceipt>>
    'pluginMaster/getDevMode': () => Promise<RemoteResult<boolean>>
    'pluginMaster/setDevMode': (enabled: boolean) => Promise<RemoteResult<MutationReceipt>>
  }

  interface TypertRemoteNamespaceMap {
    pluginMaster: {
      list: () => Promise<RemoteResult<PackageSnapshot>>
      search: (options: SearchOptions) => Promise<RemoteResult<{ matchedPackages: PackageView[]; totalMatches: number; truncated: boolean }>>
      setEntryEnabled: (entryId: string, enabled: boolean) => Promise<RemoteResult<MutationReceipt>>
      setPackageEnabled: (packageName: string, enabled: boolean) => Promise<RemoteResult<MutationReceipt>>
      uninstall: (packageName: string) => Promise<RemoteResult<MutationReceipt>>
      getDevMode: () => Promise<RemoteResult<boolean>>
      setDevMode: (enabled: boolean) => Promise<RemoteResult<MutationReceipt>>
    }
  }
}

export {}