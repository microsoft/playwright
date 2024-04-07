#!/usr/bin/env node
/**
 * Copyright 2019 Google Inc. All rights reserved.
 * Modifications copyright (c) Microsoft Corporation.
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
const ROOT = path.join(__dirname, '..', '..', '..');
const esbuild = require('esbuild');

/**
 * @type {[string, string][]}
 */
const injectedScripts = [
  [
    path.join(ROOT, 'packages', 'recorder', 'src', 'webextension', 'injected', 'recorder.ts'),
    path.join(ROOT, 'packages', 'playwright-core', 'lib', 'vite', 'recorder', 'webextension', 'injected'),
  ],
];

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
  for (const [injected, outdir] of injectedScripts) {
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
    // to ensure window is not poluted
    content = `(() => {
      ${content}
    })()`;
    await fs.promises.writeFile(outFileJs, content, 'utf-8');
  }
})();
