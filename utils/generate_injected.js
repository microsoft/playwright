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
  path.join(ROOT, 'packages', 'playwright-core', 'src', 'server', 'injected', 'consoleApi.ts'),
  path.join(ROOT, 'packages', 'playwright-core', 'src', 'server', 'injected', 'recorder.ts'),
];

const modulePrefix = `"use strict";
let __export = (target, all) => {
  for (var name in all)
    target[name] = all[name];
};
let __commonJS = cb => function __require() {
  let fn;
  for (const name in cb) {
    fn = cb[name];
    break;
  }
  const exports = {};
  fn(exports);
  return exports;
};
let __toESM = mod => ({ ...mod, 'default': mod });
let __toCommonJS = mod =>  ({ ...mod, __esModule: true });
`;

async function replaceEsbuildHeader(content, outFileJs) {
  const sourcesStart = content.indexOf('// packages/playwright-core/src/server');
  if (sourcesStart === -1)
    throw new Error(`Did not find start of bundled code in ${outFileJs}`);

  const preambule = content.substring(0, sourcesStart);
  // Replace standard esbuild definition with our own which do not depend on builtins.
  // See https://github.com/microsoft/playwright/issues/17029
  if (preambule.indexOf('__toESM') !== -1 || preambule.indexOf('__toCommonJS') !== -1) {
    content = modulePrefix + content.substring(sourcesStart);
    await fs.promises.writeFile(outFileJs, content);
  }
  return content;
}

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
    const outFileJs = path.join(outdir, baseName.replace('.ts', '.js'));
    let content = await fs.promises.readFile(outFileJs, 'utf-8');
    content = await replaceEsbuildHeader(content, outFileJs);
    const newContent = `export const source = ${JSON.stringify(content)};`;
    await fs.promises.writeFile(path.join(generatedFolder, baseName.replace('.ts', 'Source.ts')), newContent);
  }
})();
