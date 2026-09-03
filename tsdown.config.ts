import { defineConfig } from 'tsdown'

/**
 * dsh-fs-browser client bundle: emits lib/client.js as the ModuleLoader
 * closure-factory artifact the runtime's web client module system serves.
 * React stays an external (require('react') from the page's module table);
 * everything else — shiki, grammars, engine — is inlined at build time.
 */
export default defineConfig({
  entry: { client: './src/client.ts' },
  outDir: 'lib',
  format: ['cjs'],
  platform: 'browser',
  target: 'es2022',
  dts: false,
  clean: false,
  deps: {
    neverBundle: (specifier: string) => specifier === 'react' || specifier.startsWith('react/'),
    alwaysBundle: (specifier: string) => specifier !== 'react' && !specifier.startsWith('react/'),
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
    'import.meta.env.MODE': JSON.stringify('production'),
    'import.meta.env': JSON.stringify({ MODE: 'production' }),
  },
  outputOptions: {
    entryFileNames: 'client.js',
    banner: `window.__ModuleLoader__.load({ id: "dsh-fs-browser", factory: (require) => {`,
    footer: 'return module.exports; } });',
    intro: 'var module = { exports: {} }; var exports = module.exports;',
  },
})