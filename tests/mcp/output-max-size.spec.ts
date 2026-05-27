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

test('evicts oldest evictable files before write exceeds cap, pinned session.md survives', async ({ startClient, server }, testInfo) => {
  const outputDir = testInfo.outputPath('output');
  const { client } = await startClient({
    config: {
      outputDir,
      saveSession: true,
      outputMaxSize: 10_000,
    },
  });

  await client.callTool({ name: 'browser_navigate', arguments: { url: server.HELLO_WORLD } });

  for (let i = 0; i < 8; i++)
    await client.callTool({ name: 'browser_take_screenshot' });
  const pngs = fs.readdirSync(outputDir).filter(f => f.endsWith('.png'));
  expect(pngs.length).toBeLessThan(8);
  expect(pngs.reduce((acc, f) => acc + fs.statSync(path.join(outputDir, f)).size, 0)).toBeLessThanOrEqual(10_000);

  const sessionFolder = fs.readdirSync(outputDir).find(e => e.startsWith('session-'));
  expect(sessionFolder).toBeTruthy();
  expect(fs.existsSync(path.join(outputDir, sessionFolder!, 'session.md'))).toBe(true);
});

test('oversize single file evicts everything and still writes', async ({ startClient, server }, testInfo) => {
  const outputDir = testInfo.outputPath('output');
  const { client } = await startClient({
    config: {
      outputDir,
      outputMaxSize: 100,
    },
  });

  await client.callTool({ name: 'browser_navigate', arguments: { url: server.HELLO_WORLD } });

  await client.callTool({ name: 'browser_take_screenshot' });
  await client.callTool({ name: 'browser_take_screenshot' });

  expect(fs.readdirSync(outputDir)).toHaveLength(1);
});
