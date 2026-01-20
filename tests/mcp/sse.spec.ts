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

import { ChildProcess, spawn } from 'child_process';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { test as baseTest, expect, mcpServerPath } from './fixtures';

import type { Config } from '../../packages/playwright/src/mcp/config';

const test = baseTest.extend<{ serverEndpoint: (options?: { args?: string[], noPort?: boolean }) => Promise<{ url: URL, stderr: () => string }> }>({
  serverEndpoint: async ({ mcpHeadless }, use, testInfo) => {
    let cp: ChildProcess | undefined;
    const userDataDir = testInfo.outputPath('user-data-dir');
    await use(async (options?: { args?: string[], noPort?: boolean }) => {
      if (cp)
        throw new Error('Process already running');

      cp = spawn('node', [
        ...mcpServerPath,
        ...(options?.noPort ? [] : ['--port=0']),
        '--user-data-dir=' + userDataDir,
        ...(mcpHeadless ? ['--headless'] : []),
        ...(options?.args || []),
      ], {
        stdio: 'pipe',
        env: {
          ...process.env,
          DEBUG: 'pw:mcp:test',
          DEBUG_COLORS: '0',
          DEBUG_HIDE_DATE: '1',
        },
      });
      let stderr = '';
      const url = await new Promise<string>(resolve => cp!.stderr?.on('data', data => {
        stderr += data.toString();
        const match = stderr.match(/Listening on (http:\/\/.*)/);
        if (match)
          resolve(match[1]);
      }));

      return { url: new URL(url), stderr: () => stderr };
    });
    cp?.kill('SIGTERM');
  },
});

test('sse transport', async ({ serverEndpoint }) => {
  const { url } = await serverEndpoint();
  const transport = new SSEClientTransport(new URL('/sse', url));
  const client = new Client({ name: 'test', version: '1.0.0' });
  await client.connect(transport);
  await client.ping();
});

test('sse transport (config)', async ({ serverEndpoint }) => {
  const config: Config = {
    server: {
      port: 0,
    }
  };
  const configFile = test.info().outputPath('config.json');
  await fs.promises.writeFile(configFile, JSON.stringify(config, null, 2));

  const { url } = await serverEndpoint({ noPort: true, args: ['--config=' + configFile] });
  const transport = new SSEClientTransport(new URL('/sse', url));
  const client = new Client({ name: 'test', version: '1.0.0' });
  await client.connect(transport);
  await client.ping();
});

test('sse transport browser lifecycle (isolated)', async ({ serverEndpoint, server }) => {
  const { url, stderr } = await serverEndpoint({ args: ['--isolated'] });

  const transport1 = new SSEClientTransport(new URL('/sse', url));
  const client1 = new Client({ name: 'test', version: '1.0.0' });
  await client1.connect(transport1);
  await client1.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  });
  await client1.close();

  const transport2 = new SSEClientTransport(new URL('/sse', url));
  const client2 = new Client({ name: 'test', version: '1.0.0' });
  await client2.connect(transport2);
  await client2.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  });
  await client2.close();

  await expect(async () => {
    const lines = stderr().split('\n');
    expect(lines.filter(line => line.match(/create SSE session/)).length).toBe(2);
    expect(lines.filter(line => line.match(/delete SSE session/)).length).toBe(2);

    expect(lines.filter(line => line.match(/create context/)).length).toBe(2);
    expect(lines.filter(line => line.match(/close context/)).length).toBe(2);

    expect(lines.filter(line => line.match(/create browser context \(isolated\)/)).length).toBe(2);
    expect(lines.filter(line => line.match(/close browser context \(isolated\)/)).length).toBe(2);

    expect(lines.filter(line => line.match(/obtain browser \(isolated\)/)).length).toBe(2);
    expect(lines.filter(line => line.match(/close browser \(isolated\)/)).length).toBe(2);
  }).toPass();
});

test('sse transport browser lifecycle (isolated, multiclient)', async ({ serverEndpoint, server }) => {
  const { url, stderr } = await serverEndpoint({ args: ['--isolated'] });

  const transport1 = new SSEClientTransport(new URL('/sse', url));
  const client1 = new Client({ name: 'test', version: '1.0.0' });
  await client1.connect(transport1);
  await client1.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  });

  const transport2 = new SSEClientTransport(new URL('/sse', url));
  const client2 = new Client({ name: 'test', version: '1.0.0' });
  await client2.connect(transport2);
  await client2.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  });
  await client1.close();

  const transport3 = new SSEClientTransport(new URL('/sse', url));
  const client3 = new Client({ name: 'test', version: '1.0.0' });
  await client3.connect(transport3);
  await client3.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  });

  await client2.close();
  await client3.close();

  await expect(async () => {
    const lines = stderr().split('\n');
    expect(lines.filter(line => line.match(/create SSE session/)).length).toBe(3);
    expect(lines.filter(line => line.match(/delete SSE session/)).length).toBe(3);

    expect(lines.filter(line => line.match(/create context/)).length).toBe(3);
    expect(lines.filter(line => line.match(/close context/)).length).toBe(3);

    expect(lines.filter(line => line.match(/create browser context \(isolated\)/)).length).toBe(3);
    expect(lines.filter(line => line.match(/close browser context \(isolated\)/)).length).toBe(3);

    expect(lines.filter(line => line.match(/obtain browser \(isolated\)/)).length).toBe(1);
    expect(lines.filter(line => line.match(/close browser \(isolated\)/)).length).toBe(1);
  }).toPass();
});

test('sse transport browser lifecycle (persistent)', async ({ serverEndpoint, server }) => {
  const { url, stderr } = await serverEndpoint();

  const transport1 = new SSEClientTransport(new URL('/sse', url));
  const client1 = new Client({ name: 'test', version: '1.0.0' });
  await client1.connect(transport1);
  await client1.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  });
  await client1.close();

  const transport2 = new SSEClientTransport(new URL('/sse', url));
  const client2 = new Client({ name: 'test', version: '1.0.0' });
  await client2.connect(transport2);
  await client2.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  });
  await client2.close();

  await expect(async () => {
    const lines = stderr().split('\n');
    expect(lines.filter(line => line.match(/create SSE session/)).length).toBe(2);
    expect(lines.filter(line => line.match(/delete SSE session/)).length).toBe(2);

    expect(lines.filter(line => line.match(/create context/)).length).toBe(2);
    expect(lines.filter(line => line.match(/close context/)).length).toBe(2);

    expect(lines.filter(line => line.match(/create browser context \(persistent\)/)).length).toBe(2);
    expect(lines.filter(line => line.match(/close browser context \(persistent\)/)).length).toBe(2);

    expect(lines.filter(line => line.match(/lock user data dir/)).length).toBe(2);
    expect(lines.filter(line => line.match(/release user data dir/)).length).toBe(2);
  }).toPass();
});

test('sse transport browser lifecycle (persistent, multiclient)', async ({ serverEndpoint, server }) => {
  const { url } = await serverEndpoint();

  const transport1 = new SSEClientTransport(new URL('/sse', url));
  const client1 = new Client({ name: 'test', version: '1.0.0' });
  await client1.connect(transport1);
  await client1.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  });

  const transport2 = new SSEClientTransport(new URL('/sse', url));
  const client2 = new Client({ name: 'test', version: '1.0.0' });
  await client2.connect(transport2);
  const response = await client2.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  });
  expect(response.isError).toBe(true);
  expect(response.content?.[0].text).toContain('use --isolated to run multiple instances of the same browser');

  await client1.close();
  await client2.close();
});

test('sse transport shared context', async ({ serverEndpoint, server }) => {
  const { url, stderr } = await serverEndpoint({ args: ['--shared-browser-context'] });

  // Create first client and navigate
  const transport1 = new SSEClientTransport(new URL('/sse', url));
  const client1 = new Client({ name: 'test1', version: '1.0.0' });
  await client1.connect(transport1);
  await client1.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  });

  // Create second client - should reuse the same browser context
  const transport2 = new SSEClientTransport(new URL('/sse', url));
  const client2 = new Client({ name: 'test2', version: '1.0.0' });
  await client2.connect(transport2);

  // Get tabs from second client - should see the tab created by first client
  const tabsResult = await client2.callTool({
    name: 'browser_tabs',
    arguments: { action: 'list' },
  });

  // Should have at least one tab (the one created by client1)
  expect(tabsResult.content[0]?.text).toContain('Title');

  await client1.close();

  // Second client should still work since context is shared
  await client2.callTool({
    name: 'browser_snapshot',
    arguments: {},
  });

  await client2.close();

  await expect(async () => {
    const lines = stderr().split('\n');
    expect(lines.filter(line => line.match(/create SSE session/)).length).toBe(2);
    expect(lines.filter(line => line.match(/delete SSE session/)).length).toBe(2);

    // Should have only one context creation since it's shared
    expect(lines.filter(line => line.match(/create shared browser context/)).length).toBe(1);

    // Should see client connect/disconnect messages
    expect(lines.filter(line => line.match(/shared context client connected/)).length).toBe(2);
    expect(lines.filter(line => line.match(/shared context client disconnected/)).length).toBe(2);
    expect(lines.filter(line => line.match(/create context/)).length).toBe(2);
    expect(lines.filter(line => line.match(/close context/)).length).toBe(2);

    // Context should only close when the server shuts down.
    expect(lines.filter(line => line.match(/close browser context complete \(persistent\)/)).length).toBe(0);
  }).toPass();

  await fetch(new URL('/killkillkill', url).href).catch(() => {});

  await expect(async () => {
    const lines = stderr().split('\n');
    // Context should only close when the server shuts down.
    expect(lines.filter(line => line.match(/close browser context complete \(persistent\)/)).length).toBe(1);
  }).toPass();
});
