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
import { test, expect, parseResponse } from './fixtures';

test('should respect --snapshot-mode=full', async ({ startClient, server }) => {
  server.setContent('/', `<button>Button 1</button>`, 'text/html');

  const { client } = await startClient({
    args: ['--snapshot-mode=full'],
  });

  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: server.PREFIX,
    },
  })).toHaveResponse({
    snapshot: expect.stringContaining(`- button "Button 1" [ref=e2]`),
  });

  await client.callTool({
    name: 'browser_evaluate',
    arguments: {
      function: `async () => {
        const button2 = document.createElement('button');
        button2.textContent = 'Button 2';
        document.body.appendChild(button2);
      }`,
    },
  });

  expect(await client.callTool({
    name: 'browser_snapshot',
  })).toHaveResponse({
    inlineSnapshot: expect.stringContaining(`- button "Button 1" [ref=e2]
  - button "Button 2" [ref=e3]`),
  });
});

test('should respect --snapshot-mode=none', async ({ startClient, server }) => {
  server.setContent('/', `<button>Button 1</button>`, 'text/html');

  const { client } = await startClient({
    args: ['--snapshot-mode=none'],
  });

  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: server.PREFIX,
    },
  })).toHaveResponse({
    page: `- Page URL: ${server.PREFIX}/`,
  });
});

test('should not inline console messages with --snapshot-mode=none', async ({ startClient, server }) => {
  server.setContent('/', `
    <title>Tab one</title>
    <body>
      <button>Click me</button>
      <script>
        console.log('info message');
        console.error('error message');
      </script>
    </body>
  `, 'text/html');

  const { client } = await startClient({
    args: ['--snapshot-mode=none'],
  });

  const response = await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  expect(response).not.toHaveResponse({
    events: expect.stringContaining('error message'),
  });
});

test('should still emit download events with --snapshot-mode=none', async ({ startClient, server }, testInfo) => {
  server.setContent('/', `<a href="/download" download="test.txt">Download</a>`, 'text/html');
  server.setContent('/download', 'Data', 'text/plain');

  const { client } = await startClient({
    args: ['--snapshot-mode=none'],
    config: { outputDir: testInfo.outputPath('output') },
  });

  const navigate = await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });
  // ARIA snapshot is skipped, but other state (page header) is still present.
  expect(navigate).toHaveResponse({ page: `- Page URL: ${server.PREFIX}/` });
  expect(navigate).not.toHaveResponse({ snapshot: expect.anything() });

  // No ARIA refs exist in 'none' mode, so target by selector instead.
  const click = await client.callTool({
    name: 'browser_click',
    arguments: { element: 'Download link', target: 'a' },
  });

  // The download finishes asynchronously; accumulate events across polls.
  let events = parseResponse(click).events ?? '';
  await expect.poll(async () => {
    const r = await client.callTool({ name: 'browser_evaluate', arguments: { function: '() => 1' } });
    const p = parseResponse(r);
    if (p.events)
      events += '\n' + p.events;
    return events;
  }).toContain(`- Downloaded file test.txt to`);
});

test('should respect snapshot[filename]', async ({ client, server }, testInfo) => {
  server.setContent('/', `<button>Button 1</button>`, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: server.PREFIX,
    },
  });

  expect(await client.callTool({
    name: 'browser_snapshot',
    arguments: {
      filename: 'snapshot1.yml',
    },
  })).toHaveTextResponse(expect.stringContaining('snapshot1.yml'));

  expect(await fs.promises.readFile(path.join(testInfo.outputPath(), 'snapshot1.yml'), 'utf8')).toContain(`- button "Button 1" [ref=e2]`);
});
