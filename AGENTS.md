# dsh-plugin-master

Web plugin master for DeepSeek Harness. Host half exposes a Typert-bound
`pluginMaster` Remote; browser half renders a settings tab under
**Settings → Plugins**. The official `ui-settings-plugin-inventory` is
disabled by the bundle patch.

## Source layout

```
src/
├── index.ts                     # host entry — registers PluginMasterGateway
├── invariant.ts                 # compile-time bilingual key parity check
├── remote.ts                    # Typert wire schemas + client/host artifacts
├── host/
│   ├── types.ts                 # wire shapes shared with the client
│   ├── package-source.ts        # node_modules walk + dependency-spec parsing
│   ├── classify.ts              # system vs user verdict
│   ├── search.ts                # token + subsequence fuzzy search
│   ├── profile-context.ts       # resolve profile dir + manifest from baseUrl
│   ├── enable-disable.ts        # cordis.patch.yml writer (owned-row markers)
│   ├── uninstall.ts             # spawnSync("dsh", ["plugin","--profile",..., "remove",...])
│   ├── protected-ids.ts         # default protected-id set + extend hook
│   ├── loader-integration.ts    # project loader entries to LoaderEntryView
│   ├── plugin-master-gateway.ts # TypertRemoteService with @Remote methods
│   └── augment.ts               # declare pluginMaster on Cordis Context
├── client/
│   ├── index.ts                 # apply() — locale + slot registration + CSS inject
│   ├── locales.ts               # zh + en dictionaries (parity-checked)
│   ├── slots-augment.ts         # declare 'plugin-master' locale namespace
│   ├── remote-augment.ts        # declare pluginMaster Remote namespace
│   ├── locale-augment.ts        # type-only import: locale Context augmentation
│   ├── runtime-augment.ts       # type-only import: runtime slots augmentation
│   ├── remote-context-augment.ts# type-only import: remote Context augmentation
│   ├── styles.ts                # plugin CSS as a plain string (pm-* classes)
│   └── components/
│       ├── PluginMasterTab.tsx  # the settings tab
│       ├── EntryRow.tsx         # one loader entry row
│       └── UninstallDialog.tsx  # uninstall confirmation modal
scripts/
└── build-host.mjs               # esbuild + tsc pipeline for the host half
```

## Build

`pnpm build` runs in three phases:

1. `tsc` (declarations only) — emits `lib/types/index.d.ts` and the rest of
   the type files.
2. `scripts/build-host.mjs` — calls `esbuild` to bundle the host half
   with full stage-3 decorator support. Rolldown/oxc (the engines tsdown
   uses) do not yet emit the `__esDecorate` helper that
   `@deepseek-ai/dsh-typert-protocol`'s `@Remote` decorator requires at
   runtime, so the host goes through esbuild instead. esbuild's SWC-based
   TS transform produces a working stage-3 helper.
3. `tsdown` (client config) — bundles the browser half into
   `lib/client.cjs`, wrapped in `window.__ModuleLoader__.load({...})` so
   the dsh module loader picks it up. The `module`/`exports` declarations
   live in the `banner` (not `intro`, which tsdown does not reliably
   emit); without them the factory's first
   `Object.defineProperty(exports, ...)` throws "exports is not defined"
   in the browser.

Styles are shipped as a plain CSS string (`src/client/styles.ts`) with
stable `pm-*` class names and injected via a `<style data-plugin-css>`
tag inside `apply()`. CSS Modules are intentionally avoided: tsdown's
module-CSS pipeline hands the bundle a class-name map as the default
export (not the CSS text), so injecting its string form yields
`"[object Object]"` and the plugin renders unstyled.

Browser bundle externals are restricted to the shell's platform module
seed table: `react`, `react/jsx-runtime`, and
`@deepseek-ai/dsh-client-ui-primitives`. SDK type augmentations must use
`import type {} from '@deepseek-ai/.../client'` — a plain side-effect
import emits a `require()` for a specifier that is NOT in the seed
table, and the factory throws at load time in the browser.

`lib/invariant.mjs` and `lib/index.mjs` are emitted by step 2; the type
files are emitted by step 1; the client bundle and source map are
emitted by step 3.

## Behavioral contracts

- The host has no in-memory cache. Every `list()` call re-reads the
  Loader tree, the profile manifest, and walks `node_modules`. This is
  intentional and keeps the master strictly correct against edits made
  by other surfaces.
- **System classification is authoritative, not heuristic.** A package is
  system only when it resolves inside the real (symlink-resolved) Harness
  install root's `node_modules/@deepseek-ai/` scope. The profile `bundles`
  list and the `@deepseek-ai/` scope prefix are NOT system signals — both
  contain user installs (bundles lists every `dsh plugin add`; the scope
  can be impersonated by user packages like a theme). Never reintroduce
  those signals.
- The plugin master itself is a user install but cannot uninstall itself
  (`uninstallBlockedReason: 'self'`); system packages use `'system'`. The
  UI maps both to localized text via `uninstallBlockedKey`.
- Patch writes (`setEntryEnabled`, `setPackageEnabled`) go through an
  internal async queue (`mutationTail`). Two concurrent toggles never
  clobber each other on disk.
- **Disable guard**: `setPackageEnabled(false)` refuses to disable a
  package whose client services another enabled package still injects
  (scanned from the built `exports["./client"]` bundles by
  `src/host/client-deps.ts`).
- **Mutation feedback**: every `setEntryEnabled`/`setPackageEnabled`/
  `uninstall` receipt flows through `applyReceipt`. Items with
  `failed`/`restart-required` status open a modal `ReceiptDialog`
  (centered, unmissable) listing each entry and its reason; the same
  message also renders inside the clicked card (`pm-cardError`). A
  top-of-page-only hint is never sufficient — with many plugins it is
  invisible.
- `cordis.patch.yml` writes only touch rows whose `commentBefore`
  contains `"Managed by dsh-plugin-master."`. User-authored rows are
  never modified.
- Uninstall shells out to `dsh plugin --profile <name> remove <pkg>`,
  which pnpm-resolves the dependency and reconciles `dsh.profile.bundles`
  automatically. We never edit `package.json` or delete from `node_modules`
  by hand.
- The default protected-id set covers Loader plumbing, host runner,
  settings shell, client runtime, server (api gateway + webserver), and
  the master itself. Operators extend the set via the host config
  `protectedEntries`.

## Translation parity

`src/invariant.ts` typechecks that every key in `zh` exists in `en` and
vice versa. Adding a key to one side without the other breaks `pnpm
typecheck`.