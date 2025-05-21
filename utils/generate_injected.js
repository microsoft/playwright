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

/**
 * @type {[string, string, string, boolean][]}
 */
const injectedScripts = [
  [
    path.join(ROOT, 'packages', 'injected', 'src', 'utilityScript.ts'),
    path.join(ROOT, 'packages', 'injected', 'lib'),
    path.join(ROOT, 'packages', 'playwright-core', 'src', 'generated'),
    true,
  ],
  [
    path.join(ROOT, 'packages', 'injected', 'src', 'injectedScript.ts'),
    path.join(ROOT, 'packages', 'injected', 'lib'),
    path.join(ROOT, 'packages', 'playwright-core', 'src', 'generated'),
    true,
  ],
  [
    path.join(ROOT, 'packages', 'injected', 'src', 'recorder', 'pollingRecorder.ts'),
    path.join(ROOT, 'packages', 'injected', 'lib'),
    path.join(ROOT, 'packages', 'playwright-core', 'src', 'generated'),
    true,
  ],
  [
    path.join(ROOT, 'packages', 'injected', 'src', 'clock.ts'),
    path.join(ROOT, 'packages', 'injected', 'lib'),
    path.join(ROOT, 'packages', 'playwright-core', 'src', 'generated'),
    true,
  ],
  [
    path.join(ROOT, 'packages', 'injected', 'src', 'storageScript.ts'),
    path.join(ROOT, 'packages', 'injected', 'lib'),
    path.join(ROOT, 'packages', 'playwright-core', 'src', 'generated'),
    true,
  ],
  [
    path.join(ROOT, 'packages', 'injected', 'src', 'bindingsController.ts'),
    path.join(ROOT, 'packages', 'injected', 'lib'),
    path.join(ROOT, 'packages', 'playwright-core', 'src', 'generated'),
    true,
  ],
  [
    path.join(ROOT, 'packages', 'injected', 'src', 'webSocketMock.ts'),
    path.join(ROOT, 'packages', 'injected', 'lib'),
    path.join(ROOT, 'packages', 'playwright-core', 'src', 'generated'),
    true,
  ],
  [
    path.join(ROOT, 'packages', 'playwright-ct-core', 'src', 'injected', 'index.ts'),
    path.join(ROOT, 'packages', 'playwright-ct-core', 'lib', 'injected', 'packed'),
    path.join(ROOT, 'packages', 'playwright-ct-core', 'src', 'generated'),
    false,
  ]
];

const modulePrefix = `
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
`;

async function replaceEsbuildHeader(content, outFileJs) {
  let sourcesStart = content.indexOf('__toCommonJS');
  if (sourcesStart !== -1)
    sourcesStart = content.indexOf('\n', sourcesStart);
  if (sourcesStart === -1)
    throw new Error(`Did not find start of bundled code in ${outFileJs}`);

  const preamble = content.substring(0, sourcesStart);
  // Replace standard esbuild definition with our own which do not depend on builtins.
  // See https://github.com/microsoft/playwright/issues/17029
  if (preamble.indexOf('__toCommonJS') !== -1) {
    content = modulePrefix + content.substring(sourcesStart);
    await fs.promises.writeFile(outFileJs, content);
  }
  return content;
}

const inlineCSSPlugin = {
  name: 'inlineCSSPlugin',
  setup(build) {
    build.onLoad({ filter: /\.css$/ }, async (args) => {
      const f = await fs.promises.readFile(args.path)
      const css = await esbuild.transform(f, { loader: 'css', minify: true });
      return { loader: 'text', contents: css.code };
    });
  },
};

(async () => {
  for (const [injected, outdir, generatedFolder, hasExports] of injectedScripts) {
    await fs.promises.mkdir(generatedFolder, { recursive: true });
    const buildOutput = await esbuild.build({
      entryPoints: [injected],
      bundle: true,
      outdir,
      format: 'cjs',
      platform: 'browser',
      target: 'ES2019',
      plugins: [inlineCSSPlugin],
    });
    for (const message of [...buildOutput.errors, ...buildOutput.warnings])
      console.log(message.text);
    const baseName = path.basename(injected);
    const outFileJs = path.join(outdir, baseName.replace('.ts', '.js'));
    let content = await fs.promises.readFile(outFileJs, 'utf-8');
    if (hasExports)
      content = await replaceEsbuildHeader(content, outFileJs);
    const newContent = `export const source = ${JSON.stringify(content)};`;
    await fs.promises.writeFile(path.join(generatedFolder, baseName.replace('.ts', 'Source.ts')), newContent);
  }
})();
