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

import path from 'path';
import { test, expect, parseResponse } from './fixtures';

test('--file-paths=absolute', async ({ startClient, server }, testInfo) => {
  const outputDir = testInfo.outputPath('output');
  const { client } = await startClient({
    args: ['--file-paths=absolute'],
    config: { outputDir },
  });
  server.setContent('/', `<script>console.error('hello')</script>`, 'text/html');

  const navigate = parseResponse(await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  }));
  expect(navigate.events).toContain(`New console entries: ${path.join(outputDir, 'console-')}`);

  expect(await client.callTool({
    name: 'browser_take_screenshot',
  })).toHaveResponse({
    result: expect.stringContaining(`[Screenshot of viewport](${path.join(outputDir, 'page-')}`),
  });

  expect(await client.callTool({
    name: 'browser_take_screenshot',
    arguments: { filename: 'screenshot.png' },
  })).toHaveResponse({
    result: expect.stringContaining(`[Screenshot of viewport](${testInfo.outputPath('screenshot.png')})`),
  });
});
