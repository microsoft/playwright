#!/usr/bin/env node
/**
 * Build script for `packages/playwright-mcp-dist`.
 *
 * Builds from the sibling fork source at ../playwright-core/src/
 * (i.e. packages/playwright-mcp-fork/packages/playwright-core/src/).
 *
 * Two phases:
 *  1. Codegen: transform ../playwright-core/src/injected-src/*.ts files
 *     into ../playwright-core/src/generated/*Source.ts files (same
 *     transform upstream's utils/generate_injected.js does).
 *  2. Bundle: esbuild the fork entry point
 *     (../playwright-core/src/tools/mcp/program.ts) into dist/program.js,
 *     and the supervisor modules into dist/<name>.js.
 */

const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');
const { builtinModules } = require('module');
const pkg = require('./package.json');
const npmDeps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
const externals = [
  ...builtinModules,
  ...builtinModules.map(m => `node:${m}`),
  ...npmDeps,
];

// Root of the fork's playwright-core source, relative to this file.
const SRC = path.join(__dirname, '../playwright-core/src');

// ---------------------------------------------------------------------------
// Phase 1 — codegen: vendored source .ts → generated *Source.ts
// ---------------------------------------------------------------------------

const INJECTED_SOURCES = [
  { src: 'injected-src/utilityScript.ts',            out: 'generated/utilityScriptSource.ts' },
  { src: 'injected-src/injectedScript.ts',           out: 'generated/injectedScriptSource.ts' },
  { src: 'injected-src/recorder/pollingRecorder.ts', out: 'generated/pollingRecorderSource.ts' },
  { src: 'injected-src/clock.ts',                    out: 'generated/clockSource.ts' },
  { src: 'injected-src/storageScript.ts',            out: 'generated/storageScriptSource.ts' },
  { src: 'injected-src/bindingsController.ts',       out: 'generated/bindingsControllerSource.ts' },
  { src: 'injected-src/webSocketMock.ts',            out: 'generated/webSocketMockSource.ts' },
];

const EMPTY_STUB_SOURCES = [
  'webAuthnSource',
  'webViewInputSource',
  'webViewDialogSource',
];

const MODULE_PREFIX = `
var __commonJS = obj => {
  let required = false;
  let result;
  return function __require() {
    if (!required) {
      required = true;
      let fn;
      for (const name in obj) { fn = obj[name]; break; }
      const module = { exports: {} };
      fn(module.exports, module);
      result = module.exports;
    }
    return result;
  }
};
var __export = (target, all) => {for (var name in all) target[name] = all[name];};
var __toESM = mod => ({ ...mod, 'default': mod });
var __toCommonJS = mod => ({ ...mod, __esModule: true });

var __defNormalProp = (obj, key, value) => key in obj ? obj[key] = value : Object.defineProperty(obj, key, { value, writable: true, configurable: true, enumerable: true });
var __publicField = (obj, key, value) => {
  if (key in obj) return;
  if (key in obj.prototype) {
    if (typeof value !== "function") throw new Error("Class public method \`" + key + "\` must be a function");
    Object.defineProperty(obj.prototype, key, { value, writable: true, configurable: true, enumerable: false });
  } else {
    obj[key] = value;
  }
};
`;

const inlineCSSPlugin = {
  name: 'inlineCSSPlugin',
  setup(build) {
    build.onLoad({ filter: /\.css$/ }, async (args) => {
      const css = await fs.promises.readFile(args.path);
      const result = await esbuild.transform(css, { loader: 'css', minify: true });
      return { loader: 'text', contents: result.code };
    });
  },
};

async function replaceEsbuildHeader(content) {
  let sourcesStart = content.indexOf('__toCommonJS');
  if (sourcesStart !== -1) {
    sourcesStart = content.indexOf('\n', sourcesStart);
  }
  if (sourcesStart === -1) {
    throw new Error('Did not find start of bundled code in esbuild output');
  }
  const preamble = content.substring(0, sourcesStart);
  if (preamble.indexOf('__toCommonJS') !== -1) {
    content = MODULE_PREFIX + content.substring(sourcesStart);
  }
  return content;
}

async function generateInjectedSources() {
  const outdir = path.join(__dirname, '.codegen-tmp');
  await fs.promises.mkdir(outdir, { recursive: true });
  const generatedDir = path.join(SRC, 'generated');
  await fs.promises.mkdir(generatedDir, { recursive: true });
  try {
    for (const { src, out } of INJECTED_SOURCES) {
      const srcPath = path.join(SRC, src);
      const outPath = path.join(SRC, out);

      const result = await esbuild.build({
        entryPoints: [srcPath],
        bundle: true,
        format: 'cjs',
        platform: 'browser',
        target: 'es2019',
        plugins: [inlineCSSPlugin],
        write: false,
        logLevel: 'silent',
      });
      if (!result.outputFiles || result.outputFiles.length === 0) {
        throw new Error(`esbuild produced no output for ${src}`);
      }
      let content = result.outputFiles[0].text;
      content = await replaceEsbuildHeader(content);
      const wrapped = `export const source = ${JSON.stringify(content)};\n`;
      await fs.promises.writeFile(outPath, wrapped);
    }
    for (const name of EMPTY_STUB_SOURCES) {
      const outPath = path.join(SRC, 'generated', `${name}.ts`);
      await fs.promises.writeFile(
        outPath,
        '// Empty stub: this code path is pruned in the multi-slot fork.\n' +
        '// Regenerated by build.js from EMPTY_STUB_SOURCES.\n' +
        'export const source: string = "";\n'
      );
    }
  } finally {
    await fs.promises.rm(outdir, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// Phase 2 — bundle: fork entry → dist/program.js
// ---------------------------------------------------------------------------

async function bundleFork() {
  await esbuild.build({
    entryPoints: [path.join(SRC, 'tools/mcp/program.ts')],
    bundle: true,
    platform: 'node',
    target: 'node18',
    outdir: path.join(__dirname, 'dist'),
    format: 'cjs',
    sourcemap: false,
    external: externals,
    define: {
      'process.env.PW_LANG_NAME': '"javascript"',
    },
    logLevel: 'info',
  });
}

/**
 * Bundle supervisor modules as standalone CJS files under dist/.
 * esbuild flattens the common ancestor of all entries, so each
 * emits as dist/<name>.js — matching what cli.js require()s.
 */
async function bundleSupervisor() {
  const entries = [
    'tools/utils/mcp/restart-config.ts',
    'tools/utils/mcp/source-watcher.ts',
    'tools/utils/mcp/supervisor.ts',
    'tools/utils/mcp/supervisor-server.ts',
    'tools/utils/mcp/child-rpc.ts',
  ];
  await esbuild.build({
    entryPoints: entries.map(e => path.join(SRC, e)),
    bundle: true,
    platform: 'node',
    target: 'node18',
    outdir: path.join(__dirname, 'dist'),
    format: 'cjs',
    sourcemap: false,
    external: externals,
    logLevel: 'info',
    entryNames: '[dir]/[name]',
  });
}

// ---------------------------------------------------------------------------

(async () => {
  try {
    await generateInjectedSources();
    await bundleFork();
    await bundleSupervisor();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
