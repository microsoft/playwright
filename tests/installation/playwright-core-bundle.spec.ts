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

import fs from 'fs';
import path from 'path';
import { test, expect } from './npmTest';

test('playwright-core should work when bundled into a single file', async ({ exec, writeFiles, tmpWorkspace }) => {
  await exec('npm i playwright-core esbuild@0.28.1', { env: { PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: '1' } });
  await writeFiles({
    'main.js': `
      const http = require('http');
      const { chromium, request } = require('playwright-core');
      (async () => {
        const server = http.createServer((req, res) => res.end(req.headers['user-agent']));
        await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
        const context = await request.newContext();
        const response = await context.get('http://127.0.0.1:' + server.address().port);
        console.log(await response.text());
        console.log(chromium.executablePath());
        await context.dispose();
        server.close();
      })();
    `,
  });
  const expected = await exec('node main.js');
  expect(expected).toContain('Playwright/');
  await exec('npx esbuild main.js --bundle --platform=node --outfile=dist/main.js');
  // The bundle must not read package.json, browsers.json or any other file from the installed package.
  await fs.promises.rm(path.join(tmpWorkspace, 'node_modules'), { recursive: true });
  expect(await exec('node dist/main.js')).toBe(expected);
});

test('playwright-core bundle should keep its browsers registered', async ({ exec, tmpWorkspace }) => {
  await exec('npm i playwright-core esbuild@0.28.1', { env: { PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: '1' } });
  await exec('npx playwright-core install ffmpeg');
  const packageDir = path.join(tmpWorkspace, 'node_modules', 'playwright-core');
  const browsersJSON = JSON.parse(await fs.promises.readFile(path.join(packageDir, 'browsers.json'), 'utf8'));
  const { version } = JSON.parse(await fs.promises.readFile(path.join(packageDir, 'package.json'), 'utf8'));
  await exec('npx esbuild node_modules/playwright-core/cli.js --bundle --platform=node --outfile=dist/cli.js');
  await fs.promises.rm(path.join(tmpWorkspace, 'node_modules'), { recursive: true });

  await exec('node dist/cli.js install ffmpeg');
  const list = await exec('node dist/cli.js install --list');
  expect(list).toContain(`Playwright version: ${version}`);
  expect(list).toContain('ffmpeg');
  expect(list).toContain(path.join(tmpWorkspace, '.playwright'));
  expect(JSON.parse(await fs.promises.readFile(path.join(tmpWorkspace, '.playwright', 'browsers.json'), 'utf8'))).toEqual(browsersJSON);
});
