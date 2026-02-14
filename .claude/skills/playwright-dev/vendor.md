# Vendoring (Bundling) a New Dependency

Playwright vendors third-party npm packages by bundling them with esbuild into self-contained files.
This isolates dependencies, prevents version conflicts, and keeps the published packages lean.

## Architecture Overview

Each bundle lives under `packages/<package>/bundles/<name>/` and consists of three parts:

1. **Bundle directory** (`bundles/<name>/`) — has its own `package.json` with the dependencies to vendor, plus a `src/<name>BundleImpl.ts` entry point that imports and re-exports them.
2. **Build configuration** in `utils/build/build.js` — an esbuild entry that bundles the impl file into a single minified CJS file.
3. **Wrapper file** (`src/<name>Bundle.ts`) — a thin typed wrapper that `require()`s the built bundle impl and re-exports symbols with TypeScript types.

Data flow:
```
bundles/<name>/package.json          (declares npm deps)
  → npm ci → node_modules/
bundles/<name>/src/<name>BundleImpl.ts  (imports from node_modules, re-exports)
  → esbuild (bundle + minify) →
lib/<name>BundleImpl.js              (single self-contained file)
  ←
src/<name>Bundle.ts                  (typed wrapper, require('./...BundleImpl'))
  → esbuild (normal compile) →
lib/<name>Bundle.js                  (used by application code)
```

## Step-by-Step: Adding a New Bundle

### Decide which package it belongs to

- `packages/playwright-core/bundles/` — for core browser automation deps (networking, compression, protocols, etc.)
- `packages/playwright/bundles/` — for test runner deps (assertion libs, transpilers, file watchers, etc.)

### 1. Create the bundle directory

```
packages/<package>/bundles/<name>/
├── package.json
└── src/
    └── <name>BundleImpl.ts
```

### 2. Create `package.json`

Minimal private package with only the deps you want to bundle:

```json
{
  "name": "<name>-bundle",
  "version": "0.0.1",
  "private": true,
  "dependencies": {
    "some-lib": "^1.2.3"
  },
  "devDependencies": {
    "@types/some-lib": "^1.2.0"
  }
}
```

Then run `npm install` inside the bundle directory to generate `package-lock.json`.

### 3. Create `src/<name>BundleImpl.ts`

This is the esbuild entry point. Import from `node_modules` and re-export:

```typescript
// For default exports:
import someLibrary from 'some-lib';
export const someLib = someLibrary;

// For named exports:
export { SomeClass } from 'some-lib';

// For namespace imports:
import * as someLibrary from 'some-lib';
export const someLib = someLibrary;

// For vendored/third-party code that can't be bundled:
const custom = require('./third_party/custom');
export const customThing = custom;
```

### 4. Register the bundle in `utils/build/build.js`

Add an entry to the `bundles` array (around line 246):

```javascript
bundles.push({
  modulePath: 'packages/<package>/bundles/<name>',
  entryPoints: ['src/<name>BundleImpl.ts'],
  // Use outdir for a single .js file alongside other lib files:
  outdir: 'packages/<package>/lib',
  // OR use outfile for output in a subdirectory (needed if bundle has non-JS assets):
  // outfile: 'packages/<package>/lib/<name>BundleImpl/index.js',

  // Optional: deps that should NOT be bundled (must be installed at runtime):
  // external: ['express'],

  // Optional: redirect imports to custom implementations:
  // alias: { 'some-module': 'custom-impl.ts' },
});
```

**`outdir` vs `outfile`:**
- `outdir` — output goes to `lib/<name>BundleImpl.js` (most bundles use this)
- `outfile` — output goes to `lib/<name>BundleImpl/index.js` (use when you need to copy companion files like binaries next to the bundle)

### 5. Create the typed wrapper `src/<name>Bundle.ts`

This file lives in the main package source (NOT in the bundle directory). It provides TypeScript types while loading the bundled code at runtime:

```typescript
// packages/<package>/src/<name>Bundle.ts
// (or src/subdir/<name>Bundle.ts if it belongs in a subdirectory)

export const someLib: typeof import('../bundles/<name>/node_modules/some-lib')
  = require('./<name>BundleImpl').someLib;

export const SomeClass: typeof import('../bundles/<name>/node_modules/some-lib').SomeClass
  = require('./<name>BundleImpl').SomeClass;

// Re-export types if needed:
export type { SomeType } from '../bundles/<name>/node_modules/some-lib';
```

The pattern is: `typeof import('../bundles/<name>/node_modules/...')` for the type, `require('./<name>BundleImpl').<export>` for the value.

If the wrapper lives in a subdirectory (e.g. `src/common/<name>Bundle.ts`), adjust the `outdir` accordingly so the BundleImpl ends up next to the compiled wrapper:
```javascript
// in build.js
outdir: 'packages/<package>/lib/common',
```

### 6. Build and verify

```bash
npm run build
```

Or if watch is running, it will pick up changes automatically.

### 7. Use the bundle in application code

Import from the wrapper file, never from the bundle directory or `node_modules` directly:

```typescript
import { someLib } from '../<name>Bundle';
```

## Existing Bundles Reference

### playwright-core bundles

| Bundle | Deps | Output |
|--------|------|--------|
| `utils` | colors, commander, debug, diff, dotenv, graceful-fs, https-proxy-agent, jpeg-js, mime, minimatch, open, pngjs, progress, proxy-from-env, socks-proxy-agent, ws, yaml | `lib/utilsBundleImpl/index.js` |
| `zip` | yauzl, yazl, get-stream, debug | `lib/zipBundleImpl.js` |
| `mcp` | @modelcontextprotocol/sdk, zod, zod-to-json-schema | `lib/mcpBundleImpl/index.js` |

### playwright bundles

| Bundle | Deps | Output |
|--------|------|--------|
| `utils` | chokidar, enquirer, json5, source-map-support, stoppable, unified, remark-parse | `lib/utilsBundleImpl.js` |
| `babel` | ~30 @babel/* packages | `lib/transform/babelBundleImpl.js` |
| `expect` | expect, jest-matcher-utils | `lib/common/expectBundleImpl.js` |

## Advanced Patterns

### Adding a dep to an existing bundle

If the dep logically belongs with an existing bundle (e.g. a new utility lib → `utils` bundle):

1. Add the dependency to the existing `bundles/<name>/package.json`
2. Run `npm install` in that bundle directory
3. Add the import/export to the existing `src/<name>BundleImpl.ts`
4. Add the typed re-export to the existing `src/<name>Bundle.ts`

### Vendored third-party code

If a package can't be bundled by esbuild (e.g. it uses dynamic requires or has runtime file dependencies), place a modified copy in `bundles/<name>/src/third_party/` and require it from the BundleImpl. See `bundles/zip/src/third_party/extract-zip.js` for an example.

### External dependencies

Use `external: ['pkg']` in the build.js config when a dependency should NOT be bundled — e.g. optional peer deps that users install themselves. These must be available at runtime in the consumer's `node_modules`.

### Module aliases

Use `alias: { 'module-name': 'local-file.ts' }` to replace a dependency with a custom local implementation. The alias path is relative to the bundle's `modulePath`. See the `mcp` bundle's `raw-body` alias for an example.
