# Vendor Dependencies & Bundling

Playwright ships a small number of node_modules inlined into a handful of
pre-built "bundle" files under `lib/`. Everything else is either a source
file compiled per-file, or loaded at runtime from one of the bundles. This
doc covers how the bundling works, how to add or move a vendored package,
and how the dependency checker enforces the contract.

## The Bundles

### playwright-core

| Output | Entry | Purpose |
|---|---|---|
| `lib/utilsBundle.js` | `src/utilsBundle.ts` | Vendored npm packages (`debug`, `mime`, `ws`, `yauzl`, `yazl`, `@modelcontextprotocol/sdk`, `graceful-fs`, …). The single home for third-party runtime code in playwright-core. |
| `lib/coreBundle.js` | `src/coreBundle.ts` | Re-exports of playwright-core's own modules (`client`, `iso`, `utils`, `cli`, `server`, `registry`, …) as namespaces. Inlines almost all playwright-core source except `utilsBundle`. |
| `lib/server/electron/loader.js` | `src/server/electron/loader.ts` | Tiny Electron preload shim. |

The `dynamicImportToRequirePlugin` in `utils/build/build.js` rewrites
vendored npm imports at **bundle time**. For example, a playwright-core
source file containing

```ts
import debug from 'debug';
```

gets rewritten to

```js
const debug = require('./utilsBundle').debug;
```

before the bundler sees it — so the vendored package never gets inlined
into `coreBundle.js`. The mapping from npm package name to utilsBundle
export key lives in `utils/build/utilsBundleMapping.js`.

### playwright

| Output | Entry | Purpose |
|---|---|---|
| `lib/transform/babelBundle.js` | `src/transform/babelBundle.ts` | Wraps `@babel/core`, `@babel/traverse`, `@babel/code-frame`, plugins. Shared by every consumer that needs babel. |
| `lib/transform/esmLoader.js` | `src/transform/esmLoader.ts` | Node ESM loader registered via `node:module.register()`. Output sits next to `babelBundle.js` so its `./babelBundle` sibling require resolves correctly. |
| `lib/common/index.js` | `src/common/index.ts` | Barrel of `common/*` + `transform/*` (compilationCache, test, configLoader, fixtures, globals, …). State-holding singletons (currentTestInfo, memoryCache, …) live here. |
| `lib/runner/index.js` | `src/runner/index.ts` | Barrel of `runner/*` + `reporters/*` + `plugins/*`. |
| `lib/matchers/expect.js` | `src/matchers/expect.ts` | Jest-style matchers with `expect` inlined. |
| `lib/worker/workerProcessEntry.js` | `src/worker/workerProcessEntry.ts` | Entry point spawned per test worker. |
| `lib/loader/loaderProcessEntry.js` | `src/loader/loaderProcessEntry.ts` | Entry point for the test file loader sub-process. |
| `lib/runner/uiModeReporter.js` | `src/runner/uiModeReporter.ts` | Loaded by `require.resolve` from testServer; passed to child workers as a file path. |

The `common` and `runner` bundles externalize `../transform/babelBundle`
(among other things) so babel code is not duplicated across them. The
`lib/transform/transform.ts` module uses `libPath('transform', 'babelBundle')`
(absolute path via `package.ts` root) to load the babel bundle at runtime,
so it works regardless of which bundle has inlined it.

### Per-file emits (no bundle)

Files outside the bundled entries are compiled 1:1 by esbuild and land
under `lib/` mirroring their source layout. The per-file step in
`utils/build/build.js` lists the specific directories for the
`playwright` package (`cli/`, `agents/`, `mcp/`, root `*.ts`, and a few
targeted files like `runner/uiModeReporter.ts`). Other packages
(`playwright-test`, `html-reporter`, `trace-viewer`, …) are compiled by
the generic per-package loop.

## Bundle Sidecars

Every bundled output has two sidecar files next to it:

- **`<bundle>.js.txt`** — human-readable report listing inlined files
  (sorted by path, with per-file KB sizes), externals, and total bytes.
  Written by `utils/build/bundle_report.js`.
- **`<bundle>.js.LICENSE`** — third-party license texts for every npm
  package whose source got inlined. Populated from `license-checker`,
  memoized once per build invocation. Consumed by the top-level
  `ThirdPartyNotices.txt` files, which just point readers at the
  per-bundle sidecars.

Both sidecars are included in the published npm package (controlled by
`packages/*/.npmignore`).

## Adding a Vendored NPM Dependency

Three pieces need to line up when adding a new npm package that you want
inlined into `utilsBundle` (i.e., loaded through `require('./utilsBundle').<key>`):

1. **Install the package.** Add it to the root `package.json`
   `devDependencies`. The monorepo root is where esbuild resolves modules
   from; the workspace root's `node_modules/<pkg>` is what gets inlined
   into `utilsBundle.js`.

2. **Export it from `src/utilsBundle.ts`.** Pick one of:
   ```ts
   import fooLibrary from 'foo';
   export const foo = fooLibrary;             // default

   import * as fooLibrary from 'foo';
   export const foo = fooLibrary;             // namespace

   export { namedSymbol } from 'foo';         // named
   ```
   Type-only exports (`export type { X } from 'foo'`) are valid and
   don't affect runtime.

3. **Add a mapping entry to `utils/build/utilsBundleMapping.js`**:
   ```js
   'foo': { default: 'foo' },
   // or:
   'foo': { namespace: 'foo' },
   // or:
   'foo': { named: { namedSymbol: 'fooNamedSymbol' } },
   ```
   - `default` — matches `import foo from 'foo'` and rewrites to
     `require('./utilsBundle').foo`.
   - `namespace` — matches `import * as foo from 'foo'`.
   - `named` — matches `import { namedSymbol } from 'foo'` and rewrites
     to `const { fooNamedSymbol: namedSymbol } = require('./utilsBundle')`.
   - Multiple forms can coexist in one entry (see `yauzl`).
   - The map key is the exact npm specifier as written in source
     (including subpaths like `'@babel/core'` or `'colors/safe'`).

4. **Update DEPS.list.** The file or its enclosing folder's `DEPS.list`
   must authorize `node_modules/<pkg>` — otherwise `npm run flint`'s
   `check_deps` step complains about the disallowed external dependency.
   If the DEPS.list authorizes it, the package.json-dependencies check
   also gets skipped for that file.

5. **Run `npm run flint`.** It runs `check_deps`, `tsc`, `eslint`, and
   `doc` in parallel. A missing mapping typically surfaces as `node_modules/`
   references leaking into `coreBundle.js` — the build fails hard via
   `assertCoreBundleHasNoNodeModules()`.

## In-tree Third-Party Helpers

Some vendored code isn't a published npm package but lives in-tree at
`packages/playwright-core/src/server/utils/third_party/` (e.g.
`extractZip.ts`, `lockfile.ts`). These are TypeScript files, not
node_modules. They're exposed to callers via two different routes:

- **Through `coreBundle.utils`.** Re-exported from
  `src/server/utils/index.ts` via `export * from './third_party/extractZip'`
  etc. Callers import via the `@utils/*` path alias:
  ```ts
  import { extractZip } from '@utils/third_party/extractZip';
  ```
  The alias is rewritten at bundle time to
  `require('playwright-core/lib/coreBundle').utils.extractZip`.
- **Transitive npm deps via utilsBundle.** When a third_party TS file
  imports an npm package (e.g., `lockfile.ts` imports `graceful-fs`,
  `retry`, `signal-exit`), those are still rewritten through
  `utilsBundle` — so the mapping in `utilsBundleMapping.js` must list
  them too.

## DEPS.list

Every directory under `packages/*/src/` has a `DEPS.list` constraining
its imports. Three kinds of entries:

| Syntax | Meaning |
|---|---|
| `./somefile.ts`, `@isomorphic/**` | Relative or alias source import allowed |
| `node_modules/<pkg>` | npm package import allowed (exact specifier match) |
| `"strict"` | No other DEPS inherited; only what's listed is allowed |

Section headers `[filename.ts]` scope rules to a single file. The
top-level `[*]` (or no header) applies to everything in the folder plus
subfolders that don't have their own DEPS.list.

A DEPS.list entry of `node_modules/<pkg>` now shortcuts both layers of
the check: the "disallowed external dependency" error AND the
"dependencies not declared in package.json" report. The per-file
allowlist is the contract — no need to also list the dep in
`packages/<pkg>/package.json` if only one file uses it and it's
authorized there.

### check_deps.js

`utils/check_deps.js` walks the TypeScript program, visits every
`import` in `src/**`, and for each npm specifier:

1. Skips if the source file's DEPS.list authorizes `node_modules/<specifier>`.
2. Otherwise records the top-level package name along with the file
   path that imported it.
3. Subtracts `peerDependencies`, `VENDORED_PACKAGES` (from
   `utilsBundleMapping.js`), and any package that resolves without
   `node_modules/` (a core module or a local file).
4. Subtracts packages listed in `packages/<pkg>/package.json`
   `dependencies`.
5. Anything left is reported with the specific file(s) that import it.

The missing-dep error now includes file paths:
```
Dependencies are not declared in package.json:
  expect
    src/matchers/expect.ts
  @babel/core
    src/transform/babelBundle.ts
```

## Bundle-Level Externalization (onResolve plugins)

Two onResolve plugins in `utils/build/build.js` normalize relative
imports to the sibling bundle at consumer output level:

- **`externalizeUtilsBundlePlugin`** — matches any relative specifier
  ending in `/utilsBundle` or `/utilsBundle.js` (at any depth: `./utilsBundle`,
  `../utilsBundle`, `../../utilsBundle`) and marks it external with the
  single spelling `./utilsBundle`. This only applies to the coreBundle
  build because coreBundle inlines source files from all over
  `playwright-core/src/` (different depths) and needs a single consistent
  external specifier that resolves correctly at runtime from
  `lib/coreBundle.js`.
- The **babelBundle** case is handled differently — instead of a plugin,
  consumers' source/output depths are aligned:
  - `esmLoader` bundle output is placed at `lib/transform/esmLoader.js`
    (same folder as `babelBundle.js`), so `./babelBundle` from
    `transform.ts` resolves correctly.
  - `common` and `runner` bundles declare `'../transform/babelBundle'`
    as a static external; their outputs are at `lib/common/index.js` and
    `lib/runner/index.js`, both at depth 1, so the source-relative
    specifier resolves naturally.
  - `transform.ts`'s own `require('./babelBundle')` was replaced with
    `require(libPath('transform', 'babelBundle'))` — an absolute path
    computed at runtime via `package.ts`, which works from any bundle.

## Quick Reference

- To add a new vendored npm dep: root `package.json` → `utilsBundle.ts`
  export → `utilsBundleMapping.js` entry → DEPS.list → `npm run flint`.
- To add a new in-tree third-party helper: drop the `.ts` file under
  `server/utils/third_party/`, re-export from `server/utils/index.ts`,
  and use `@utils/third_party/<name>` at call sites.
- To add a new bundle entry: add an `EsbuildStep` in
  `utils/build/build.js`, pick output location so relative externals
  line up with runtime layout, and list externals for every sibling
  bundle the entry should not inline.
- To expose a bundle file as a package subpath: add it to the
  `exports` field in `packages/<pkg>/package.json`.
- To check what's inside a bundle: read the `.js.txt` sidecar next to
  the output.
