import { defineConfig } from 'tsdown'

const PLUGIN_ID = 'dsh-plugin-master'

export default defineConfig({
  name: `${PLUGIN_ID}/client`,
  entry: {
    client: 'src/client/index.ts',
  },
  format: 'cjs',
  outDir: 'lib',
  dts: false,
  sourcemap: true,
  clean: false,
  platform: 'browser',
  target: 'es2022',
  treeshake: true,
  // zod/yaml must be inlined: the loader's require table only answers
  // @deepseek-ai/*, react, react-dom (kept external below).
  external: ['@deepseek-ai/*', 'react', 'react-dom', 'react/jsx-runtime'],
  noExternal: (id: string) => (
    id.startsWith('@deepseek-ai/') || id === 'react' || id === 'react-dom' || id === 'react/jsx-runtime'
      ? undefined
      : true
  ),
  // The dsh module loader calls `window.__ModuleLoader__.load({ id, factory })`
  // with a `require` function. Inside the factory, CJS-style `module`/`exports`
  // must exist for the bundled code to assign to, so the banner declares them
  // before the first bundled statement runs. `intro` is not reliably emitted by
  // tsdown, so the declarations live here in the banner.
  banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(PLUGIN_ID)}, factory: (require) => {
var module = { exports: {} }; var exports = module.exports;`,
  footer: 'return module.exports; } });',
  output: {
    entryFileNames: 'client.js',
  },
})