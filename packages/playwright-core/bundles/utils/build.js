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

esbuild.build({
  entryPoints: [path.join(__dirname, 'src/utilsBundleImpl.ts')],
  bundle: true,
  outdir: path.join(__dirname, '../../lib'),
  format: 'cjs',
  platform: 'node',
  target: 'ES2019',
  watch: process.argv.includes('--watch'),
  sourcemap: process.argv.includes('--sourcemap'),
  minify: process.argv.includes('--minify'),
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
