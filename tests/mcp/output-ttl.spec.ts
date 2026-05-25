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

import { test, expect } from './fixtures';

test('--output-ttl should prune expired artifacts', async ({ startClient, server }, testInfo) => {
  const outputDir = testInfo.outputPath('output');
  await fs.promises.mkdir(outputDir, { recursive: true });

  const oldFile = path.join(outputDir, 'old-screenshot.png');
  await fs.promises.writeFile(oldFile, 'old-data');
  const past = new Date(Date.now() - 120_000);
  await fs.promises.utimes(oldFile, past, past);

  const freshFile = path.join(outputDir, 'fresh-screenshot.png');
  await fs.promises.writeFile(freshFile, 'fresh-data');

  const { client } = await startClient({
    config: { outputDir, outputTtl: 30 },
  });

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  });

  await client.callTool({
    name: 'browser_take_screenshot',
  });

  expect(fs.existsSync(oldFile)).toBe(false);
  expect(fs.existsSync(freshFile)).toBe(true);
});

test('--output-ttl should prune expired subdirectories', async ({ startClient, server }, testInfo) => {
  const outputDir = testInfo.outputPath('output');
  const oldDir = path.join(outputDir, 'session-old');
  await fs.promises.mkdir(oldDir, { recursive: true });
  await fs.promises.writeFile(path.join(oldDir, 'log.txt'), 'session-data');
  const past = new Date(Date.now() - 120_000);
  await fs.promises.utimes(oldDir, past, past);

  const { client } = await startClient({
    config: { outputDir, outputTtl: 30 },
  });

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  });

  await client.callTool({
    name: 'browser_take_screenshot',
  });

  expect(fs.existsSync(oldDir)).toBe(false);
});

test('no cleanup when outputTtl is not set', async ({ startClient, server }, testInfo) => {
  const outputDir = testInfo.outputPath('output');
  await fs.promises.mkdir(outputDir, { recursive: true });

  const oldFile = path.join(outputDir, 'old-screenshot.png');
  await fs.promises.writeFile(oldFile, 'old-data');
  const past = new Date(Date.now() - 60000);
  await fs.promises.utimes(oldFile, past, past);

  const { client } = await startClient({
    config: { outputDir },
  });

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  });

  await client.callTool({
    name: 'browser_take_screenshot',
  });

  expect(fs.existsSync(oldFile)).toBe(true);
});
