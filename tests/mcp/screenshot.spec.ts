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

test('browser_take_screenshot (viewport)', async ({ startClient, server }, testInfo) => {
  const { client } = await startClient({
    config: { outputDir: testInfo.outputPath('output') },
  });
  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  })).toHaveResponse({
    code: expect.stringContaining(`page.goto('http://localhost`),
  });

  expect(await client.callTool({
    name: 'browser_take_screenshot',
  })).toHaveResponse({
    code: expect.stringContaining(`await page.screenshot`),
    attachments: [{
      data: expect.any(String),
      mimeType: 'image/png',
      type: 'image',
    }],
  });
});

test('browser_take_screenshot (element)', async ({ startClient, server }, testInfo) => {
  const { client } = await startClient({
    config: { outputDir: testInfo.outputPath('output') },
  });
  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  })).toHaveResponse({
    pageState: expect.stringContaining(`[ref=e1]`),
  });

  expect(await client.callTool({
    name: 'browser_take_screenshot',
    arguments: {
      element: 'hello button',
      ref: 'e1',
    },
  })).toEqual({
    content: [
      {
        text: expect.stringContaining(`page.getByText('Hello, world!').screenshot`),
        type: 'text',
      },
      {
        data: expect.any(String),
        mimeType: 'image/png',
        type: 'image',
      },
    ],
  });
});

test('--output-dir should work', async ({ startClient, server }, testInfo) => {
  const outputDir = testInfo.outputPath('output');
  const { client } = await startClient({
    config: { outputDir },
  });
  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  })).toHaveResponse({
    code: expect.stringContaining(`page.goto('http://localhost`),
  });

  await client.callTool({
    name: 'browser_take_screenshot',
  });

  expect(fs.existsSync(outputDir)).toBeTruthy();
  const files = [...fs.readdirSync(outputDir)].filter(f => f.endsWith('.png'));
  expect(files).toHaveLength(1);
  expect(files[0]).toMatch(/^page-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.png$/);
});

for (const type of ['png', 'jpeg']) {
  test(`browser_take_screenshot (type: ${type})`, async ({ startClient, server }, testInfo) => {
    const outputDir = testInfo.outputPath('output');
    const { client } = await startClient({
      config: { outputDir },
    });
    expect(await client.callTool({
      name: 'browser_navigate',
      arguments: { url: server.PREFIX },
    })).toHaveResponse({
      code: expect.stringContaining(`page.goto('http://localhost`),
    });

    expect(await client.callTool({
      name: 'browser_take_screenshot',
      arguments: { type },
    })).toEqual({
      content: [
        {
          text: expect.stringMatching(
              new RegExp(`page-\\d{4}-\\d{2}-\\d{2}T\\d{2}-\\d{2}-\\d{2}\\-\\d{3}Z\\.${type}`)
          ),
          type: 'text',
        },
        {
          data: expect.any(String),
          mimeType: `image/${type}`,
          type: 'image',
        },
      ],
    });

    const files = [...fs.readdirSync(outputDir)].filter(f => f.endsWith(`.${type}`));

    expect(fs.existsSync(outputDir)).toBeTruthy();
    expect(files).toHaveLength(1);
    expect(files[0]).toMatch(
        new RegExp(`^page-\\d{4}-\\d{2}-\\d{2}T\\d{2}-\\d{2}-\\d{2}-\\d{3}Z\\.${type}$`)
    );
  });

}

test('browser_take_screenshot (default type should be png)', async ({ startClient, server }, testInfo) => {
  const outputDir = testInfo.outputPath('output');
  const { client } = await startClient({
    config: { outputDir },
  });
  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  })).toHaveResponse({
    code: `await page.goto('${server.PREFIX}');`,
  });

  expect(await client.callTool({
    name: 'browser_take_screenshot',
  })).toEqual({
    content: [
      {
        text: expect.stringMatching(
            new RegExp(`page-\\d{4}-\\d{2}-\\d{2}T\\d{2}-\\d{2}-\\d{2}\\-\\d{3}Z\\.png`)
        ),
        type: 'text',
      },
      {
        data: expect.any(String),
        mimeType: 'image/png',
        type: 'image',
      },
    ],
  });

  const files = [...fs.readdirSync(outputDir)].filter(f => f.endsWith('.png'));

  expect(fs.existsSync(outputDir)).toBeTruthy();
  expect(files).toHaveLength(1);
  expect(files[0]).toMatch(/^page-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.png$/);
});

test('browser_take_screenshot (filename: "output.png")', async ({ startClient, server }, testInfo) => {
  const outputDir = testInfo.outputPath('output');
  const { client } = await startClient({
    config: { outputDir },
  });
  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  })).toHaveResponse({
    code: expect.stringContaining(`page.goto('http://localhost`),
  });

  expect(await client.callTool({
    name: 'browser_take_screenshot',
    arguments: {
      filename: 'output.png',
    },
  })).toEqual({
    content: [
      {
        text: expect.stringContaining(`output.png`),
        type: 'text',
      },
      {
        data: expect.any(String),
        mimeType: 'image/png',
        type: 'image',
      },
    ],
  });

  const files = [...fs.readdirSync(outputDir)].filter(f => f.endsWith('.png'));

  expect(fs.existsSync(outputDir)).toBeTruthy();
  expect(files).toHaveLength(1);
  expect(files[0]).toMatch(/^output\.png$/);
});

test('browser_take_screenshot (imageResponses=omit)', async ({ startClient, server }, testInfo) => {
  const outputDir = testInfo.outputPath('output');
  const { client } = await startClient({
    config: {
      outputDir,
      imageResponses: 'omit',
    },
  });

  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  })).toHaveResponse({
    code: expect.stringContaining(`page.goto('http://localhost`),
  });

  await client.callTool({
    name: 'browser_take_screenshot',
  });

  expect(await client.callTool({
    name: 'browser_take_screenshot',
  })).toEqual({
    content: [
      {
        text: expect.stringContaining(`await page.screenshot`),
        type: 'text',
      },
    ],
  });
});

test('browser_take_screenshot (fullPage: true)', async ({ startClient, server }, testInfo) => {
  const { client } = await startClient({
    config: { outputDir: testInfo.outputPath('output') },
  });
  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  })).toHaveResponse({
    code: expect.stringContaining(`page.goto('http://localhost`),
  });

  expect(await client.callTool({
    name: 'browser_take_screenshot',
    arguments: { fullPage: true },
  })).toEqual({
    content: [
      {
        text: expect.stringContaining('fullPage: true'),
        type: 'text',
      }
    ],
  });
});

test('browser_take_screenshot (fullPage with element should error)', async ({ startClient, server }, testInfo) => {
  const { client } = await startClient({
    config: { outputDir: testInfo.outputPath('output') },
  });
  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  })).toHaveResponse({
    pageState: expect.stringContaining(`[ref=e1]`),
  });

  const result = await client.callTool({
    name: 'browser_take_screenshot',
    arguments: {
      fullPage: true,
      element: 'hello button',
      ref: 'e1',
    },
  });

  expect(result.isError).toBe(true);
  expect(result.content?.[0]?.text).toContain('fullPage cannot be used with element screenshots');
});

test('browser_take_screenshot (viewport without snapshot)', async ({ startClient, server }, testInfo) => {
  const { client } = await startClient({
    config: { outputDir: testInfo.outputPath('output') },
  });

  // Ensure we have a tab but don't navigate anywhere (no snapshot captured)
  expect(await client.callTool({
    name: 'browser_tabs',
    arguments: {
      action: 'list',
    },
  })).toHaveResponse({
    tabs: `- 0: (current) [] (about:blank)`,
  });

  // This should work without requiring a snapshot since it's a viewport screenshot
  expect(await client.callTool({
    name: 'browser_take_screenshot',
  })).toEqual({
    content: [
      {
        text: expect.stringContaining(`page.screenshot`),
        type: 'text',
      },
      {
        data: expect.any(String),
        mimeType: 'image/png',
        type: 'image',
      },
    ],
  });
});
