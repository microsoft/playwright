/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// @ts-check
const path = require('path');
const esbuild = require('esbuild');
const fs = require('fs');

const outdir = path.join(__dirname, '../../lib/utilsBundleImpl');

function copyXdgOpen() {
  if (!fs.existsSync(outdir))
    fs.mkdirSync(outdir, { recursive: true });

  // 'open' package requires 'xdg-open' binary to be present, which does not get bundled by esbuild.
  fs.copyFileSync(path.join(__dirname, 'node_modules/open/xdg-open'), path.join(outdir, 'xdg-open'));
  console.log('==== Copied xdg-open to', path.join(outdir, 'xdg-open'));
}

/**
 * @param {boolean} watchMode
 * @returns {import('esbuild').BuildOptions}
 */
function esbuildOptions(watchMode) {
  return {
    entryPoints: [path.join(__dirname, 'src/utilsBundleImpl.ts')],
    bundle: true,
    outfile: path.join(outdir, 'index.js'),
    format: 'cjs',
    platform: 'node',
    target: 'ES2019',
    sourcemap: watchMode,
    minify: !watchMode,
  };
}

async function main() {
  copyXdgOpen();
  const watchMode = process.argv.includes('--watch');
  const ctx = await esbuild.context(esbuildOptions(watchMode));
  await ctx.rebuild();
  if (watchMode)
    await ctx.watch();
  else
    await ctx.dispose();
}

module.exports = {
  beforeEsbuild: copyXdgOpen,
  esbuildOptions,
};

if (require.main === module)
  main();
