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

import { test, expect } from './cli-fixtures';
import fs from 'fs';

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

test('screenshot --filename', async ({ cli, server, mcpBrowser }) => {
  await cli('open', server.HELLO_WORLD);
  const { output, attachments } = await cli('screenshot', '--filename=screenshot.png');
  expect(output).toContain('[Screenshot of viewport](screenshot.png)');
  expect(attachments[0].name).toEqual('Screenshot of viewport');
  expect(attachments[0].data).toEqual(expect.any(Buffer));
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
  expect(output).toContain('[Page as pdf](pdf.pdf)');
  expect(attachments[0].name).toEqual('Page as pdf');
  expect(attachments[0].data).toEqual(expect.any(Buffer));
});

test('download file via run-code', async ({ cli, server }) => {
  server.setContent('/', `<a href="/file" download>Download</a>`, 'text/html');
  server.setRoute('/file', (req, res) => {
    res.setHeader('Content-Disposition', 'attachment; filename="file.txt"');
    res.end('Hello world');
  });
  await cli('open', server.PREFIX);
  const subdir = test.info().outputPath('subdir');
  fs.mkdirSync(subdir, { recursive: true });
  await cli('run-code', `async page => {
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByText('Download').click()
    ]);
    await download.saveAs('downloaded.txt');
  }`, { cwd: subdir });
  expect.soft(fs.readdirSync(test.info().outputDir)).not.toContain('downloaded.txt');
  expect.soft(fs.readdirSync(subdir)).toContain('downloaded.txt');
});
