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
import { jpegjs, PNG } from 'packages/playwright-core/lib/utilsBundle';

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
    snapshot: expect.stringContaining(`[ref=e1]`),
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

test('browser_take_screenshot (filename is empty string)', async ({ startClient, server }, testInfo) => {
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
      filename: '',
    },
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
  expect(files[0]).toMatch(
      new RegExp(`^page-\\d{4}-\\d{2}-\\d{2}T\\d{2}-\\d{2}-\\d{2}-\\d{3}Z\\.png$`)
  );
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
      },
      {
        data: expect.any(String),
        mimeType: 'image/png',
        type: 'image',
      },
    ],
  });
});

test('browser_take_screenshot size cap', async ({ startClient, server, mcpBrowser }, testInfo) => {
  test.skip(!['chrome', 'msedge', 'chromium'].includes(mcpBrowser ?? ''), 'Non-chrome has unusual full page size');

  const { client } = await startClient({
    config: { outputDir: testInfo.outputPath('output') },
  });

  const expectations = [
    { title: '2000x500', pageWidth: 2000, pageHeight: 500, expectedWidth: 1568, expectedHeight: 500 * 1568 / 2000 | 0 },
    { title: '2000x2000', pageWidth: 2000, pageHeight: 2000, expectedWidth: 1098, expectedHeight: 1098 },
    { title: '1280x800', pageWidth: 1280, pageHeight: 800, expectedWidth: 1280, expectedHeight: 800 },
  ];

  for (const expectation of expectations) {
    await test.step(expectation.title, async () => {
      server.setContent('/', `<body style="width: ${expectation.pageWidth}px; height: ${expectation.pageHeight}px; background: red; margin: 0;"></body>`, 'text/html');
      await client.callTool({ name: 'browser_navigate', arguments: { url: server.PREFIX } });

      const pngResult = await client.callTool({
        name: 'browser_take_screenshot',
        arguments: { fullPage: true },
      });
      const png = PNG.sync.read(Buffer.from(pngResult.content?.[1]?.data, 'base64'));
      expect(png.width).toBe(expectation.expectedWidth);
      expect(png.height).toBe(expectation.expectedHeight);

      const jpegResult = await client.callTool({
        name: 'browser_take_screenshot',
        arguments: { fullPage: true, type: 'jpeg' },
      });
      const jpeg = jpegjs.decode(Buffer.from(jpegResult.content?.[1]?.data, 'base64'));
      expect(jpeg.width).toBe(expectation.expectedWidth);
      expect(jpeg.height).toBe(expectation.expectedHeight);
    });
  }
});

test('browser_take_screenshot (fullPage with element should error)', async ({ startClient, server }, testInfo) => {
  const { client } = await startClient({
    config: { outputDir: testInfo.outputPath('output') },
  });
  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  })).toHaveResponse({
    snapshot: expect.stringContaining(`[ref=e1]`),
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
    result: `- 0: (current) [](about:blank)`,
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

// OCR Screenshot Tests
test('browser_take_ocr_friendly_screenshot (basic)', async ({ startClient, server }, testInfo) => {
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
    name: 'browser_take_ocr_friendly_screenshot',
  })).toHaveResponse({
    code: expect.stringContaining(`fullPage: true`),
    attachments: [{
      data: expect.any(String),
      mimeType: 'image/png',
      type: 'image',
    }],
  });
});

test('browser_take_ocr_friendly_screenshot (without tiling)', async ({ startClient, server }, testInfo) => {
  const { client } = await startClient({
    config: { outputDir: testInfo.outputPath('output') },
  });
  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  })).toHaveResponse({
    code: expect.stringContaining(`page.goto('http://localhost`),
  });

  // With tileHeight=0, should capture full page as single image
  expect(await client.callTool({
    name: 'browser_take_ocr_friendly_screenshot',
    arguments: { tileHeight: 0 },
  })).toHaveResponse({
    code: expect.stringContaining(`fullPage: true`),
    attachments: [{
      data: expect.any(String),
      mimeType: 'image/png',
      type: 'image',
    }],
  });
});

test('browser_take_ocr_friendly_screenshot (with tiling)', async ({ startClient, server, mcpBrowser }, testInfo) => {
  test.skip(!['chrome', 'msedge', 'chromium'].includes(mcpBrowser ?? ''), 'Non-chrome has unusual full page size');

  const { client } = await startClient({
    config: { outputDir: testInfo.outputPath('output') },
  });

  // Create a tall page that will require tiling
  server.setContent('/', `<body style="width: 800px; height: 2000px; background: linear-gradient(red, blue); margin: 0;"><h1>OCR Test Page</h1></body>`, 'text/html');
  await client.callTool({ name: 'browser_navigate', arguments: { url: server.PREFIX } });

  // With tileHeight=500, should create multiple tiles for 2000px page
  const result = await client.callTool({
    name: 'browser_take_ocr_friendly_screenshot',
    arguments: { tileHeight: 500 },
  });

  // Should have multiple image attachments (tiles)
  const content = result.content as Array<{ type: string; mimeType?: string; text?: string }>;
  const attachments = content?.filter(c => c.type === 'image') || [];
  expect(attachments.length).toBeGreaterThan(1);

  // All attachments should be PNG
  for (const attachment of attachments)
    expect(attachment.mimeType).toBe('image/png');

  // Text should mention the tiling
  const textContent = content?.find(c => c.type === 'text');
  expect(textContent?.text).toContain('tiles');
});

test('browser_take_ocr_friendly_screenshot (style injection)', async ({ startClient, server }, testInfo) => {
  const { client } = await startClient({
    config: { outputDir: testInfo.outputPath('output') },
  });
  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  })).toHaveResponse({
    code: expect.stringContaining(`page.goto('http://localhost`),
  });

  // Custom CSS should be accepted
  expect(await client.callTool({
    name: 'browser_take_ocr_friendly_screenshot',
    arguments: { style: 'body { background: yellow; }' },
  })).toHaveResponse({
    attachments: [{
      data: expect.any(String),
      mimeType: 'image/png',
      type: 'image',
    }],
  });
});

test('browser_take_ocr_friendly_screenshot (hideFixed)', async ({ startClient, server }, testInfo) => {
  const { client } = await startClient({
    config: { outputDir: testInfo.outputPath('output') },
  });

  // Create a page with fixed position element
  server.setContent('/', `
    <body style="height: 500px; margin: 0;">
      <div style="position: fixed; top: 0; left: 0; background: red; width: 100px; height: 50px;">Fixed Header</div>
      <h1 style="margin-top: 100px;">Main Content</h1>
    </body>
  `, 'text/html');
  await client.callTool({ name: 'browser_navigate', arguments: { url: server.PREFIX } });

  // Should accept hideFixed parameter (page fits in single tile at 500px height)
  expect(await client.callTool({
    name: 'browser_take_ocr_friendly_screenshot',
    arguments: { hideFixed: true },
  })).toHaveResponse({
    attachments: [{
      data: expect.any(String),
      mimeType: 'image/png',
      type: 'image',
    }],
  });
});

test('browser_take_ocr_friendly_screenshot (no downscaling)', async ({ startClient, server, mcpBrowser }, testInfo) => {
  test.skip(!['chrome', 'msedge', 'chromium'].includes(mcpBrowser ?? ''), 'Non-chrome has unusual page size');

  const outputDir = testInfo.outputPath('output');
  const { client } = await startClient({
    config: { outputDir },
  });

  // Create a page with known dimensions
  server.setContent('/', `<body style="width: 1000px; height: 500px; background: red; margin: 0;"></body>`, 'text/html');
  await client.callTool({ name: 'browser_navigate', arguments: { url: server.PREFIX } });

  const result = await client.callTool({
    name: 'browser_take_ocr_friendly_screenshot',
    arguments: { tileHeight: 0 },
  });

  const content = result.content as Array<{ type: string; data?: string }>;
  const imageData = content?.find(c => c.type === 'image');
  expect(imageData).toBeTruthy();

  // Verify the image was not downscaled - it should be at least 1000px wide
  // (device scale may make it larger, but it should never be smaller than CSS pixels)
  const png = PNG.sync.read(Buffer.from(imageData!.data!, 'base64'));
  expect(png.width).toBeGreaterThanOrEqual(1000);
  expect(png.height).toBeGreaterThanOrEqual(500);
});
