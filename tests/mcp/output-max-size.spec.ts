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
    config: { outputDir, saveSession: true, outputMaxSize: 5_000 },
  });

  let n = 0;
  server.setRoute('/download', (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename=file-${n++}.bin`,
    });
    res.end(Buffer.alloc(1000, 'x'));
  });
  server.setContent('/', `<!doctype html><body><a href="/download" download>D</a></body>`, 'text/html');

  await client.callTool({ name: 'browser_navigate', arguments: { url: server.PREFIX } });
  for (let i = 0; i < 8; i++) {
    await client.callTool({ name: 'browser_click', arguments: { element: 'D', target: 'e2' } });
    // Click returns before download.saveAs() completes; wait for the file before the next eviction.
    await expect.poll(() => fs.existsSync(path.join(outputDir, `file-${i}.bin`))).toBe(true);
  }
  // One more tool call so eviction runs with all 8 downloads on disk.
  await client.callTool({ name: 'browser_snapshot' });

  const bins = fs.readdirSync(outputDir).filter(f => f.endsWith('.bin'));
  expect(bins.length).toBeLessThan(8);
  expect(bins.reduce((acc, f) => acc + fs.statSync(path.join(outputDir, f)).size, 0)).toBeLessThanOrEqual(5_000);

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
