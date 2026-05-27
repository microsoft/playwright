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

async function takeScreenshot(client: any) {
  return await client.callTool({
    name: 'browser_take_screenshot',
  });
}

function listFiles(dir: string, ext: string) {
  if (!fs.existsSync(dir))
    return [];
  return fs.readdirSync(dir).filter(f => f.endsWith(ext));
}

function totalBytes(dir: string, ext: string) {
  return listFiles(dir, ext).reduce((acc, f) => acc + fs.statSync(path.join(dir, f)).size, 0);
}

test('evicts oldest evictable files before write exceeds cap', async ({ startClient, server }, testInfo) => {
  const outputDir = testInfo.outputPath('output');
  const { client } = await startClient({
    config: {
      outputDir,
      // Pick a low cap so even one extra screenshot triggers eviction.
      outputMaxSize: 10_000,
    },
  });

  await client.callTool({ name: 'browser_navigate', arguments: { url: server.HELLO_WORLD } });

  const beforeCount = listFiles(outputDir, '.png').length;
  // Take more screenshots than would fit in the cap.
  for (let i = 0; i < 8; i++) {
    await takeScreenshot(client);
    // Ensure subsequent files have distinct timestamps in their names.
    await new Promise(r => setTimeout(r, 5));
  }
  const after = listFiles(outputDir, '.png');
  // Fewer than 8 should remain.
  expect(after.length).toBeLessThan(8);
  expect(after.length).toBeGreaterThan(beforeCount);
  // Total size must not exceed cap.
  expect(totalBytes(outputDir, '.png')).toBeLessThanOrEqual(10_000);
});

test('oversize single file evicts everything and still writes', async ({ startClient, server }, testInfo) => {
  const outputDir = testInfo.outputPath('output');
  const { client } = await startClient({
    config: {
      outputDir,
      // Tiny cap, smaller than a single screenshot.
      outputMaxSize: 100,
    },
  });

  await client.callTool({ name: 'browser_navigate', arguments: { url: server.HELLO_WORLD } });

  await takeScreenshot(client);
  await new Promise(r => setTimeout(r, 5));
  await takeScreenshot(client);

  // Older file should be removed; newest is written even though it exceeds the cap.
  expect(listFiles(outputDir, '.png')).toHaveLength(1);
});

test('session.md is pinned and survives eviction', async ({ startClient, server }, testInfo) => {
  const outputDir = testInfo.outputPath('output');
  const { client } = await startClient({
    config: {
      outputDir,
      saveSession: true,
      outputMaxSize: 50_000,
    },
  });

  await client.callTool({ name: 'browser_navigate', arguments: { url: server.HELLO_WORLD } });

  // Fill the cap with evictable assets.
  for (let i = 0; i < 6; i++) {
    await takeScreenshot(client);
    await new Promise(r => setTimeout(r, 5));
  }

  const entries = fs.readdirSync(outputDir);
  const sessionFolder = entries.find(e => e.startsWith('session-'));
  expect(sessionFolder).toBeTruthy();
  const sessionFile = path.join(outputDir, sessionFolder!, 'session.md');
  expect(fs.existsSync(sessionFile)).toBe(true);
});

test('no cap means no eviction', async ({ startClient, server }, testInfo) => {
  const outputDir = testInfo.outputPath('output');
  const { client } = await startClient({
    config: { outputDir },
  });

  await client.callTool({ name: 'browser_navigate', arguments: { url: server.HELLO_WORLD } });

  for (let i = 0; i < 3; i++) {
    await takeScreenshot(client);
    await new Promise(r => setTimeout(r, 5));
  }

  expect(listFiles(outputDir, '.png')).toHaveLength(3);
});

test('honors PLAYWRIGHT_MCP_OUTPUT_MAX_SIZE env var', async ({ startClient, server }, testInfo) => {
  const outputDir = testInfo.outputPath('output');
  const { client } = await startClient({
    config: { outputDir },
    env: { PLAYWRIGHT_MCP_OUTPUT_MAX_SIZE: '100' },
  });

  await client.callTool({ name: 'browser_navigate', arguments: { url: server.HELLO_WORLD } });

  await takeScreenshot(client);
  await new Promise(r => setTimeout(r, 5));
  await takeScreenshot(client);

  expect(listFiles(outputDir, '.png')).toHaveLength(1);
});
