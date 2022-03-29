#!/usr/bin/env node
/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// @ts-check

const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const esbuild = require('esbuild');

const injectedScripts = [
  path.join(ROOT, 'packages', 'playwright-core', 'src', 'server', 'injected', 'utilityScript.ts'),
  path.join(ROOT, 'packages', 'playwright-core', 'src', 'server', 'injected', 'injectedScript.ts'),
  path.join(ROOT, 'packages', 'playwright-core', 'src', 'server', 'supplements', 'injected', 'consoleApi.ts'),
  path.join(ROOT, 'packages', 'playwright-core', 'src', 'server', 'supplements', 'injected', 'recorder.ts'),
];

(async () => {
  const generatedFolder = path.join(ROOT, 'packages', 'playwright-core', 'src', 'generated');
  await fs.promises.mkdir(generatedFolder, { recursive: true });
  for (const injected of injectedScripts) {
    const outdir = path.join(ROOT, 'packages', 'playwright-core', 'lib', 'server', 'injected', 'packed');
    await esbuild.build({
      entryPoints: [injected],
      bundle: true,
      outdir,
      format: 'cjs',
      platform: 'browser',
      target: 'ES2019'
    });
    const baseName = path.basename(injected);
    const content = await fs.promises.readFile(path.join(outdir, baseName.replace('.ts', '.js')), 'utf-8');
    const newContent = `export const source = ${JSON.stringify(content)};`;
    await fs.promises.writeFile(path.join(generatedFolder, baseName.replace('.ts', 'Source.ts')), newContent);
  }
})();
