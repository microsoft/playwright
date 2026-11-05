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

import fs from 'fs/promises';
import path from 'path';

import { test, expect } from './cli-fixtures';

test('downloads preserve files with the same suggested filename', {
  annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright-cli/issues/514' },
}, async ({ cli, server }, testInfo) => {
  server.setContent('/', `
    <a href="/v1" download="same.txt">V1</a>
    <a href="/v2" download="same.txt">V2</a>
  `, 'text/html');
  server.setContent('/v1', 'v1', 'text/plain');
  server.setContent('/v2', 'v2', 'text/plain');
  await cli('open', server.PREFIX);

  for (const [link, filename] of [['V1', 'same.txt'], ['V2', 'same-1.txt']]) {
    let { output } = await cli('click', `text=${link}`);
    await expect.poll(async () => {
      output += (await cli('snapshot')).output;
      return output;
    }).toContain(`Downloaded file same.txt to "${path.join('.playwright-cli', filename)}"`);
  }
  expect(await fs.readFile(testInfo.outputPath('.playwright-cli', 'same.txt'), 'utf8')).toBe('v1');
  expect(await fs.readFile(testInfo.outputPath('.playwright-cli', 'same-1.txt'), 'utf8')).toBe('v2');
});

test('screenshot', async ({ cli, server, mcpBrowser }) => {
  await cli('open', server.HELLO_WORLD);
  const { attachments } = await cli('screenshot');
  expect(attachments[0].name).toEqual('Screenshot of viewport');
  expect(attachments[0].data).toEqual(expect.any(Buffer));
});

test('screenshot <ref>', async ({ cli, server, mcpBrowser }) => {
  server.setContent('/', `<div id="square" style="width: 100px; height: 100px; background-color: red;"></div>`, 'text/html');
  await cli('open', server.PREFIX);
  const { attachments } = await cli('screenshot', 'e2');
  expect(attachments[0].name).toEqual('Screenshot of element');
  expect(attachments[0].data).toEqual(expect.any(Buffer));
});

test('screenshot --full-page', async ({ cli, server, mcpBrowser }) => {
  await cli('open', server.HELLO_WORLD);
  const { attachments } = await cli('screenshot', '--full-page');
  expect(attachments[0].name).toEqual('Screenshot of full page');
  expect(attachments[0].data).toEqual(expect.any(Buffer));
});

test('screenshot --hires', async ({ cli, server, mcpBrowser }) => {
  await cli('open', server.HELLO_WORLD);
  const { attachments } = await cli('screenshot', '--hires');
  expect(attachments[0].name).toEqual('Screenshot of viewport');
  expect(attachments[0].data).toEqual(expect.any(Buffer));
});

test('screenshot --filename', async ({ cli, server, mcpBrowser }) => {
  await cli('open', server.HELLO_WORLD);
  const { output, attachments } = await cli('screenshot', '--filename=screenshot.png');
  expect(output).toContain('[Screenshot of viewport](./screenshot.png)');
  expect(attachments[0].name).toEqual('Screenshot of viewport');
  expect(attachments[0].data).toEqual(expect.any(Buffer));
});

test('screenshot --filename infers webp from extension', async ({ cli, server, mcpBrowser }) => {
  test.skip(mcpBrowser === 'webkit' && process.platform === 'darwin', 'CG on macOS does not include a webp encoder UTI');

  await cli('open', server.HELLO_WORLD);
  const { output, attachments } = await cli('screenshot', '--filename=screenshot.webp');
  expect(output).toContain('[Screenshot of viewport](./screenshot.webp)');
  const buffer = attachments[0].data as Buffer;
  expect(buffer.subarray(0, 4).toString('latin1')).toBe('RIFF');
  expect(buffer.subarray(8, 12).toString('latin1')).toBe('WEBP');
});

test('pdf', async ({ cli, server, mcpBrowser }) => {
  test.skip(mcpBrowser !== 'chromium' && mcpBrowser !== 'chrome', 'PDF is only supported in Chromium and Chrome');
  await cli('open', server.HELLO_WORLD);
  const { attachments } = await cli('pdf');
  expect(attachments[0].name).toEqual('Page as pdf');
  expect(attachments[0].data).toEqual(expect.any(Buffer));
});

test('pdf --filename', async ({ cli, server, mcpBrowser }) => {
  test.skip(mcpBrowser !== 'chromium' && mcpBrowser !== 'chrome', 'PDF is only supported in Chromium and Chrome');
  await cli('open', server.HELLO_WORLD);
  const { output, attachments } = await cli('pdf', '--filename=pdf.pdf');
  expect(output).toContain('[Page as pdf](./pdf.pdf)');
  expect(attachments[0].name).toEqual('Page as pdf');
  expect(attachments[0].data).toEqual(expect.any(Buffer));
});
