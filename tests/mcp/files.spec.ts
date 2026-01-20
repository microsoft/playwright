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

import { test, expect, parseResponse } from './fixtures';

test('browser_file_upload', async ({ client, server }, testInfo) => {
  server.setContent('/', `
    <input type="file" />
    <button>Button</button>
  `, 'text/html');

  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  })).toHaveResponse({
    snapshot: expect.stringContaining(`- generic [active] [ref=e1]:
  - button "Choose File" [ref=e2]
  - button "Button" [ref=e3]`),
  });

  {
    expect(await client.callTool({
      name: 'browser_file_upload',
      arguments: { paths: [] },
    })).toHaveResponse({
      isError: true,
      error: expect.stringContaining(`The tool "browser_file_upload" can only be used when there is related modal state present.`),
      modalState: undefined,
    });
  }

  expect(await client.callTool({
    name: 'browser_click',
    arguments: {
      element: 'Textbox',
      ref: 'e2',
    },
  })).toHaveResponse({
    modalState: expect.stringContaining(`- [File chooser]: can be handled by the "browser_file_upload" tool`),
  });

  const filePath = testInfo.outputPath('test.txt');
  await fs.writeFile(filePath, 'Hello, world!');

  {
    const response = await client.callTool({
      name: 'browser_file_upload',
      arguments: {
        paths: [filePath],
      },
    });

    expect(response).toHaveResponse({
      code: expect.stringContaining(`await fileChooser.setFiles(`),
      modalState: undefined,
    });
  }

  {
    const response = await client.callTool({
      name: 'browser_click',
      arguments: {
        element: 'Textbox',
        ref: 'e2',
      },
    });

    expect(response).toHaveResponse({
      modalState: `- [File chooser]: can be handled by the "browser_file_upload" tool`,
    });
  }

  {
    const response = await client.callTool({
      name: 'browser_click',
      arguments: {
        element: 'Button',
        ref: 'e3',
      },
    });

    expect(response).toHaveResponse({
      isError: true,
      error: `Error: Tool "browser_click" does not handle the modal state.`,
      modalState: expect.stringContaining(`- [File chooser]: can be handled by the "browser_file_upload" tool`),
    });
  }
});

test('clicking on download link emits download', async ({ startClient, server }, testInfo) => {
  const { client } = await startClient({
    config: { outputDir: testInfo.outputPath('output') },
  });

  server.setContent('/', `<a href="/download" download="test.txt">Download</a>`, 'text/html');
  server.setContent('/download', 'Data', 'text/plain');

  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  })).toHaveResponse({
    snapshot: expect.stringContaining(`- link "Download" [ref=e2]`),
  });

  const response = await client.callTool({
    name: 'browser_click',
    arguments: {
      element: 'Download link',
      ref: 'e2',
    },
  });
  const parsed = parseResponse(response);
  let events = parsed.events;
  await expect.poll(async () => {
    const r = await client.callTool({ name: 'browser_snapshot' });
    const p = parseResponse(r);
    if (p.events)
      events += '\n' + p.events;
    return events;
  }).toBe(`- Downloading file test.txt ...
- Downloaded file test.txt to "output${path.sep}test.txt"`);
});

test('navigating to download link emits download', async ({ startClient, server, mcpBrowser }, testInfo) => {
  test.skip(mcpBrowser !== 'chromium', 'This test is racy');
  const { client } = await startClient({
    config: { outputDir: testInfo.outputPath('output') },
  });

  server.setRoute('/download', (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/plain',
      'Content-Disposition': 'attachment; filename=test.txt',
    });
    res.end('Hello world!');
  });

  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: server.PREFIX + '/download',
    },
  })).toHaveResponse({
    events: expect.stringMatching(`- Downloaded file test\.txt to|- Downloading file test\.txt`),
  });
});

test('file upload restricted to roots by default', async ({ startClient, server }, testInfo) => {
  const rootDir = testInfo.outputPath('workspace');
  await fs.mkdir(rootDir, { recursive: true });

  const { client } = await startClient({
    roots: [
      {
        name: 'workspace',
        uri: `file://${rootDir}`,
      }
    ],
  });

  server.setContent('/', `<input type="file" />`, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  // Click on file input to trigger file chooser
  await client.callTool({
    name: 'browser_click',
    arguments: {
      element: 'Textbox',
      ref: 'e2',
    },
  });

  // Create a file inside the root
  const fileInsideRoot = testInfo.outputPath('workspace', 'inside.txt');
  await fs.writeFile(fileInsideRoot, 'Inside root');

  // Should succeed - file is inside root
  expect(await client.callTool({
    name: 'browser_file_upload',
    arguments: {
      paths: [fileInsideRoot],
    },
  })).toHaveResponse({
    code: expect.stringContaining(`await fileChooser.setFiles(`),
  });

  // Click again to open file chooser
  await client.callTool({
    name: 'browser_click',
    arguments: {
      element: 'Textbox',
      ref: 'e2',
    },
  });

  // Create a file outside the root
  const fileOutsideRoot = testInfo.outputPath('outside.txt');
  await fs.writeFile(fileOutsideRoot, 'Outside root');

  // Should fail - file is outside root
  expect(await client.callTool({
    name: 'browser_file_upload',
    arguments: {
      paths: [fileOutsideRoot],
    },
  })).toHaveResponse({
    isError: true,
    error: expect.stringMatching('File access denied: .* is outside allowed roots'),
  });
});

test('file upload is restricted to cwd if no roots are configured', async ({ startClient, server }, testInfo) => {
  const rootDir = testInfo.outputPath('workspace');
  await fs.mkdir(rootDir, { recursive: true });

  const { client } = await startClient({
    cwd: rootDir,
  });

  server.setContent('/', `<input type="file" />`, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  // Click on file input to trigger file chooser
  await client.callTool({
    name: 'browser_click',
    arguments: {
      element: 'Textbox',
      ref: 'e2',
    },
  });

  // Create a file inside the root
  const fileInsideRoot = testInfo.outputPath('workspace', 'inside.txt');
  await fs.writeFile(fileInsideRoot, 'Inside root');

  // Should succeed - file is inside root
  expect(await client.callTool({
    name: 'browser_file_upload',
    arguments: {
      paths: [fileInsideRoot],
    },
  })).toHaveResponse({
    code: expect.stringContaining(`await fileChooser.setFiles(`),
  });

  // Click again to open file chooser
  await client.callTool({
    name: 'browser_click',
    arguments: {
      element: 'Textbox',
      ref: 'e2',
    },
  });

  const fileOutsideRoot = testInfo.outputPath('outside.txt');
  await fs.writeFile(fileOutsideRoot, 'Outside root');

  expect(await client.callTool({
    name: 'browser_file_upload',
    arguments: {
      paths: [fileOutsideRoot],
    },
  })).toHaveResponse({
    isError: true,
    error: expect.stringMatching('File access denied: .* is outside allowed roots. Allowed roots: ' + rootDir.replace(/\\/g, '\\\\')),
  });
});

test('file upload unrestricted when flag is set', async ({ startClient, server }, testInfo) => {
  const rootDir = testInfo.outputPath('workspace');
  await fs.mkdir(rootDir, { recursive: true });

  const { client } = await startClient({
    config: {
      allowUnrestrictedFileAccess: true,
    },
    roots: [
      {
        name: 'workspace',
        uri: `file://${rootDir}`,
      }
    ],
  });

  server.setContent('/', `<input type="file" />`, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  // Click on file input to trigger file chooser
  await client.callTool({
    name: 'browser_click',
    arguments: {
      element: 'Textbox',
      ref: 'e2',
    },
  });

  // Create a file outside the root
  const fileOutsideRoot = testInfo.outputPath('outside.txt');
  await fs.writeFile(fileOutsideRoot, 'Outside root');

  // Should succeed - unrestricted uploads are allowed
  expect(await client.callTool({
    name: 'browser_file_upload',
    arguments: {
      paths: [fileOutsideRoot],
    },
  })).toHaveResponse({
    code: expect.stringContaining(`await fileChooser.setFiles(`),
  });
});
