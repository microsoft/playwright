const path = require('path');
const fs = require('fs');
const esbuild = require('esbuild');

const PLAYWRIGHT_CORE_DIR = path.join(__dirname);
const PLAYWRIGHT_CORE_SRC = path.join(PLAYWRIGHT_CORE_DIR, 'src');
const SHARED_FILES = [
  './src/inprocess',
  './src/utils/verifyNodeJsVersion',
  './src/server/trace/viewer/traceViewer',
  './src/utils/vfs',
  './src/client/clientHelper',
  './src/server/trace/test/inMemorySnapshotter',
  './src/inProcessFactory',
  './src/server/common/cssParser'
];

/** @type{import('esbuild').BuildOptions} */
const commonEsbuildOptions = {
  platform: 'node',
  target: 'node12',
  absWorkingDir: PLAYWRIGHT_CORE_DIR,
};

(async () => {
  await buildExternalDeps();
  await buildSharedFiles();
  await buildCore();
})().catch(e => {
  console.error(e);
  process.exit(1);
})

async function buildExternalDeps() {
  const entryPoints = fs.readdirSync(path.join(PLAYWRIGHT_CORE_SRC, 'externalDeps'))
    .map(file => path.join('./src', 'externalDeps', file));
  await esbuild.build({
    ...commonEsbuildOptions,
    entryPoints,
    bundle: true,
    outdir: './lib/externalDeps',
  })
}

async function buildSharedFiles() {
  await esbuild.build({
    ...commonEsbuildOptions,
    outdir: './lib',
    bundle: true,
    entryPoints: SHARED_FILES,
    loader: {
      ".png": "binary",
    },
  })
}

async function buildCore() {
  const entryPoints = Object.keys(require(path.join(PLAYWRIGHT_CORE_DIR, "./package.json")).exports)
    .filter(v => (
      v !== '.' && v !== './package.json' && v !== './cli' && v !== '.'
    ))
    .map(v => v.replace('./lib/', './src/'))
    .map(v => v + '.ts')
  await esbuild.build({
    ...commonEsbuildOptions,
    entryPoints: [
      ...entryPoints,
      './src/cli/cli.ts',
    ],
    bundle: true,
    outdir: './lib',
    external: [
      "@playwright/test/lib/experimentalLoader",
      "./lib/inprocess",
      "./index.js",
      './lib/externalDeps/*',
      ...SHARED_FILES.map(v => v.replace('./src/', './lib/')),
    ],
    loader: {
      ".png": "binary",
    },
  })
}
