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

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

import { test, expect } from './fixtures';

const p = process.platform === 'win32' ? 'c:\\non\\existent\\folder' : '/non/existent/folder';

test('should use separate user data by root path', async ({ startClient, server }, testInfo) => {
  const { client } = await startClient({
    clientName: 'Visual Studio Code',
    roots: [
      {
        name: 'test',
        uri: 'file://' + p.replace(/\\/g, '/'),
      }
    ],
  });

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  });

  const hash = createHash(p);
  const [file] = await fs.promises.readdir(testInfo.outputPath('ms-playwright'));
  expect(file).toContain(hash);
});

test('check that trace is saved in workspace', async ({ startClient, server }, testInfo) => {
  const rootPath = testInfo.outputPath('workspace');
  const { client } = await startClient({
    args: ['--save-trace'],
    clientName: 'My client',
    roots: [
      {
        name: 'workspace',
        uri: pathToFileURL(rootPath).toString(),
      },
    ],
  });

  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  })).toHaveResponse({
    code: expect.stringContaining(`page.goto('http://localhost`),
  });

  const [file] = await fs.promises.readdir(path.join(rootPath, '.playwright-mcp'));
  expect(file).toContain('traces');
});

test('should list all tools when listRoots is slow', async ({ startClient }) => {
  const { client } = await startClient({
    clientName: 'Another custom client',
    roots: [],
    rootsResponseDelay: 1000,
  });
  const tools = await client.listTools();
  expect(tools.tools.length).toBeGreaterThan(10);
});

test('should tolerate malformed roots', async ({ startClient, server }, testInfo) => {
  const { client } = await startClient({
    clientName: 'Visual Studio Code',
    roots: [
      {
        name: 'test',
        uri: 'bogus://' + p.replace(/\\/g, '/'),
      }
    ],
  });

  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  })).toHaveResponse({
    code: expect.stringContaining(`page.goto('http://localhost`),
  });

  const [file] = await fs.promises.readdir(testInfo.outputPath('ms-playwright'));
  expect(file).toMatch(/mcp-.*/);
});

function createHash(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex').slice(0, 7);
}
