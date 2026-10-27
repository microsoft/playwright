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
import { pathToFileURL } from 'url';
import { test, expect } from './npmTest';

test('Docker builds select stable Chrome for Testing and Node.js LTS', { annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/43664' } }, async ({ exec, writeFiles, tmpWorkspace }) => {
  test.skip(process.platform === 'win32', 'Docker images are built with bash');
  const dockerDir = path.resolve(__dirname, '../../utils/docker');
  await writeFiles({
    'bin/docker': '#!/bin/sh\nprintf "%s\\n" "$@"\n',
    'fetch.mjs': `
      globalThis.fetch = async url => {
        if (url === 'https://nodejs.org/dist/index.json')
          return new Response(JSON.stringify([{ version: 'v25.0.0', lts: false }, { version: 'v24.9.0', lts: 'Krypton' }]));
        if (url === 'https://googlechromelabs.github.io/chrome-for-testing/last-known-good-versions.json')
          return new Response(JSON.stringify({ channels: { Stable: { version: '143.0.7499.4' }, Beta: { version: '144.0.7500.1' } } }));
        throw new Error('Unexpected URL: ' + url);
      };
    `,
  });
  await fs.promises.chmod(path.join(tmpWorkspace, 'bin/docker'), 0o755);
  const output = await exec(`bash "${path.join(dockerDir, 'build.sh')}" --amd64 noble playwright:test`, {
    env: {
      PATH: path.join(tmpWorkspace, 'bin') + path.delimiter + process.env.PATH,
      NODE_OPTIONS: `--import=${pathToFileURL(path.join(tmpWorkspace, 'fetch.mjs'))}`,
    },
  });
  expect(output).toContain('NODE_VERSION=24.9.0');
  expect(output).toContain('CHROMIUM_VERSION=143.0.7499.4');
  expect(output).toContain('--pull');

  await exec('npm i playwright-core');
  const browsersFile = path.join(tmpWorkspace, 'node_modules/playwright-core/browsers.json');
  const original: { browsers: { name: string, revision: string, browserVersion?: string }[] } = JSON.parse(await fs.promises.readFile(browsersFile, 'utf8'));
  await exec(`node "${path.join(dockerDir, 'configure-browsers.mjs')}" 143.0.7499.4`);
  const configured = JSON.parse(await fs.promises.readFile(browsersFile, 'utf8'));
  expect(configured).toEqual({
    ...original,
    browsers: original.browsers.map(browser => ['chromium', 'chromium-headless-shell'].includes(browser.name) ? { ...browser, browserVersion: '143.0.7499.4' } : browser),
  });
  const downloads = await exec('npx playwright-core install chromium --dry-run');
  expect(downloads).toContain('/builds/cft/143.0.7499.4/');
  for (const name of ['chromium', 'chromium-headless-shell']) {
    const descriptor = original.browsers.find(browser => browser.name === name);
    expect(downloads).toContain(`${name.replace(/-/g, '_')}-${descriptor.revision}`);
  }

  await writeFiles({ 'fetch-error.mjs': 'globalThis.fetch = async () => new Response("", { status: 503 });' });
  const failure = await exec(`bash "${path.join(dockerDir, 'build.sh')}" --amd64 noble playwright:test`, {
    env: {
      PATH: path.join(tmpWorkspace, 'bin') + path.delimiter + process.env.PATH,
      NODE_OPTIONS: `--import=${pathToFileURL(path.join(tmpWorkspace, 'fetch-error.mjs'))}`,
    },
    expectToExitWithError: true,
  });
  expect(failure).toContain('Failed to fetch');
  expect(failure).toContain('503');
});
