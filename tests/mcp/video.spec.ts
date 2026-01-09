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
import { test, expect } from './fixtures';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import path from 'path';

for (const mode of ['isolated', 'persistent']) {
  test(`should work with --save-video (${mode})`, async ({ startClient, server }, testInfo) => {
    const outputDir = testInfo.outputPath('output');

    const { client } = await startClient({
      args: [
        '--save-video=800x600',
        ...(mode === 'isolated' ? ['--isolated'] : []),
        '--output-dir', outputDir,
      ],
    });

    await navigateToTestPage(client, server);
    await expect(async () => {
      await produceFrames(client);
      await checkIntermediateVideoFileExists(outputDir);
    }).toPass();
    await closeBrowser(client);

    const sessionDirs = await fs.promises.readdir(outputDir);
    expect(sessionDirs.length).toBe(1);
    const sessionId = sessionDirs[0]!;
    expect(sessionId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    const files = await fs.promises.readdir(path.join(outputDir, sessionId));
    expect(files.some(file => /page-.*\.webm/.test(file))).toBeTruthy();
  });

  test(`should work with  { saveVideo } (${mode})`, async ({ startClient, server }, testInfo) => {
    const outputDir = testInfo.outputPath('output');

    const { client } = await startClient({
      config: {
        browser: { isolated: mode === 'isolated' },
        saveVideo: { width: 800, height: 600 },
        outputDir,
      }
    });

    await navigateToTestPage(client, server);
    await expect(async () => {
      await produceFrames(client);
      await checkIntermediateVideoFileExists(outputDir);
    }).toPass();
    await closeBrowser(client);

    const sessionDirs = await fs.promises.readdir(outputDir);
    expect(sessionDirs.length).toBe(1);
    const sessionId = sessionDirs[0]!;
    expect(sessionId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    const files = await fs.promises.readdir(path.join(outputDir, sessionId));
    expect(files.some(file => /page-.*\.webm/.test(file))).toBeTruthy();
  });

  test(`should work with recordVideo (${mode})`, async ({ startClient, server }, testInfo) => {
    const videosDir = testInfo.outputPath('videos');

    const { client } = await startClient({
      config: {
        browser: {
          contextOptions: {
            recordVideo: {
              dir: videosDir,
              size: { width: 800, height: 600 },
            },
          }
        }
      },
      args: [
        ...(mode === 'isolated' ? ['--isolated'] : []),
      ],
    });

    await navigateToTestPage(client, server);
    await produceFrames(client);
    await closeBrowser(client);
  });
}

async function navigateToTestPage(client: Client, server: any) {
  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  })).toHaveResponse({
    code: expect.stringContaining(`page.goto('http://localhost`),
  });
}

async function closeBrowser(client: Client) {
  expect(await client.callTool({
    name: 'browser_close',
  })).toHaveResponse({
    code: expect.stringContaining(`page.close()`),
  });
}

async function produceFrames(client: Client) {
  expect(await client.callTool({
    name: 'browser_evaluate',
    arguments: {
      function: `async () => {
        async function rafraf(count) {
          for (let i = 0; i < count; i++)
            await new Promise(f => requestAnimationFrame(() => requestAnimationFrame(f)));
        }
        document.body.style.backgroundColor = "red";
        await rafraf(30);
        document.body.style.backgroundColor = "green";
        await rafraf(30);
        document.body.style.backgroundColor = "blue";
        await rafraf(30);
        return 'ok';
      }`,
    },
  })).toHaveResponse({
    result: '"ok"',
  });
}

async function checkIntermediateVideoFileExists(videosDir: string) {
  const entries = await fs.promises.readdir(videosDir, { recursive: true });
  expect(entries.some(e => typeof e === 'string' && e.endsWith('.webm'))).toBeTruthy();
}
