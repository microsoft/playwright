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
const fs = require('fs');
const esbuild = require('esbuild');

// Can be removed once source-map-support was  is fixed.
/** @type{import('esbuild').Plugin} */
let patchSourceMapSupportHideBufferDeprecationWarning = {
  name: 'patch-source-map-support-deprecation',
  setup(build) {
    build.onResolve({ filter: /^source-map-support$/ }, () => {
      const originalPath = require.resolve('source-map-support');
      const patchedPath = path.join(path.dirname(originalPath), path.basename(originalPath, '.js') + '.pw-patched.js');
      let sourceFileContent = fs.readFileSync(originalPath, 'utf8')
      sourceFileContent = sourceFileContent.replace(/new Buffer\(rawData/g, 'Buffer.from(rawData');
      fs.writeFileSync(patchedPath, sourceFileContent);
      return { path: patchedPath }
    });
  },
}

esbuild.build({
  entryPoints: [path.join(__dirname, 'src/utilsBundleImpl.ts')],
  bundle: true,
  outdir: path.join(__dirname, '../../lib'),
  plugins: [patchSourceMapSupportHideBufferDeprecationWarning],
  format: 'cjs',
  platform: 'node',
  target: 'ES2019',
  watch: process.argv.includes('--watch'),
  sourcemap: process.argv.includes('--sourcemap'),
  minify: process.argv.includes('--minify'),
}).catch(() => process.exit(1));
