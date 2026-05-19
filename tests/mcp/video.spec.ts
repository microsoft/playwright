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

for (const mode of ['isolated', 'persistent']) {
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

test('reports missing ffmpeg, not missing browser, when recordVideo is enabled', {
  annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/40862' },
}, async ({ startClient, server, mcpBrowser }, testInfo) => {
  test.skip(mcpBrowser !== 'chrome' && mcpBrowser !== 'msedge', 'Channel browsers use system-installed binaries; bundled browsers would also be missing under an empty PLAYWRIGHT_BROWSERS_PATH');

  const emptyBrowsersPath = testInfo.outputPath('empty-browsers');
  await fs.promises.mkdir(emptyBrowsersPath, { recursive: true });

  const { client } = await startClient({
    env: { PLAYWRIGHT_BROWSERS_PATH: emptyBrowsersPath },
    config: {
      browser: {
        contextOptions: {
          recordVideo: { dir: testInfo.outputPath('videos') },
        },
      },
    },
  });

  const response = await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  });
  expect.soft(response).toHaveResponse({
    isError: true,
    error: expect.stringContaining('FFmpeg is not installed'),
  });
  expect.soft(response).toHaveResponse({
    isError: true,
    error: expect.not.stringContaining(`Browser "${mcpBrowser}" is not installed`),
  });
});

test.describe('action overlays', () => {
  test.use({ mcpArgs: ['--caps=devtools'] });

  test('browser_video_show_actions and browser_video_hide_actions', async ({ client, server }) => {
    expect(await client.callTool({
      name: 'browser_navigate',
      arguments: { url: server.HELLO_WORLD },
    })).toHaveResponse({
      code: expect.stringContaining(`page.goto('http://localhost`),
    });

    expect(await client.callTool({
      name: 'browser_video_show_actions',
      arguments: { duration: 200, position: 'bottom-right' },
    })).toHaveResponse({
      result: 'Action annotations enabled.',
    });

    expect(await client.callTool({
      name: 'browser_video_hide_actions',
      arguments: {},
    })).toHaveResponse({
      result: 'Action annotations disabled.',
    });
  });

  test('browser_video_show_actions rejects invalid position', async ({ client, server }) => {
    expect(await client.callTool({
      name: 'browser_navigate',
      arguments: { url: server.HELLO_WORLD },
    })).toHaveResponse({
      code: expect.stringContaining(`page.goto('http://localhost`),
    });

    expect(await client.callTool({
      name: 'browser_video_show_actions',
      arguments: { position: 'middle' },
    })).toHaveResponse({
      isError: true,
    });
  });
});

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
