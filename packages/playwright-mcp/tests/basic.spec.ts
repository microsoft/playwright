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

import { test, expect } from '@playwright/test';

import { MCPServer } from './fixtures';

async function startServer(): Promise<MCPServer> {
  const server = new MCPServer('node', [path.join(__dirname, '../cli.js'), '--headless']);
  const initialize = await server.send({
    jsonrpc: '2.0',
    id: 0,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: {
        name: 'Playwright Test',
        version: '0.0.0',
      },
    },
  });

  expect(initialize).toEqual(expect.objectContaining({
    id: 0,
    result: expect.objectContaining({
      protocolVersion: '2024-11-05',
      capabilities: {
        tools: {},
        resources: {},
      },
      serverInfo: expect.objectContaining({
        name: 'Playwright',
        version: expect.any(String),
      }),
    }),
  }));

  await server.sendNoReply({
    jsonrpc: '2.0',
    method: 'notifications/initialized',
  });

  return server;
}

test('test tool list', async ({}) => {
  const server = await startServer();

  const list = await server.send({
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/list',
  });

  expect(list).toEqual(expect.objectContaining({
    id: 1,
    result: expect.objectContaining({
      tools: [
        expect.objectContaining({
          name: 'browser_navigate',
        }),
        expect.objectContaining({
          name: 'browser_go_back',
        }),
        expect.objectContaining({
          name: 'browser_go_forward',
        }),
        expect.objectContaining({
          name: 'browser_snapshot',
        }),
        expect.objectContaining({
          name: 'browser_click',
        }),
        expect.objectContaining({
          name: 'browser_hover',
        }),
        expect.objectContaining({
          name: 'browser_type',
        }),
        expect.objectContaining({
          name: 'browser_press_key',
        }),
        expect.objectContaining({
          name: 'browser_wait',
        }),
        expect.objectContaining({
          name: 'browser_save_as_pdf',
        }),
        expect.objectContaining({
          name: 'browser_close',
        }),
      ],
    }),
  }));
});

test('test resources list', async ({}) => {
  const server = await startServer();

  const list = await server.send({
    jsonrpc: '2.0',
    id: 2,
    method: 'resources/list',
  });

  expect(list).toEqual(expect.objectContaining({
    id: 2,
    result: expect.objectContaining({
      resources: [
        expect.objectContaining({
          uri: 'browser://console',
          mimeType: 'text/plain',
        }),
      ],
    }),
  }));
});

test('test browser_navigate', async ({}) => {
  const server = await startServer();

  const response = await server.send({
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call',
    params: {
      name: 'browser_navigate',
      arguments: {
        url: 'https://example.com',
      },
    },
  });

  expect(response).toEqual(expect.objectContaining({
    id: 2,
    result: {
      content: [{
        type: 'text',
        text: expect.stringContaining(`
# Page URL: https://example.com/
# Page Title: [object Promise]
# Page Snapshot
- document`),
      }],
    },
  }));
});
