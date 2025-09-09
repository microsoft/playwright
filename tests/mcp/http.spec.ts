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
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { test as baseTest, expect, mcpServerPath } from './fixtures';

import type { Config } from '../../packages/playwright/src/mcp/config';
import { ListRootsRequestSchema } from 'packages/playwright/lib/mcp/sdk/bundle';

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

test('http transport', async ({ serverEndpoint }) => {
  const { url } = await serverEndpoint();
  const transport = new StreamableHTTPClientTransport(new URL('/mcp', url));
  const client = new Client({ name: 'test', version: '1.0.0' });
  await client.connect(transport);
  await client.ping();
});

test('http transport (config)', async ({ serverEndpoint }) => {
  const config: Config = {
    server: {
      port: 0,
    }
  };
  const configFile = test.info().outputPath('config.json');
  await fs.promises.writeFile(configFile, JSON.stringify(config, null, 2));

  const { url } = await serverEndpoint({ noPort: true, args: ['--config=' + configFile] });
  const transport = new StreamableHTTPClientTransport(new URL('/mcp', url));
  const client = new Client({ name: 'test', version: '1.0.0' });
  await client.connect(transport);
  await client.ping();
});

test('http transport browser lifecycle (isolated)', async ({ serverEndpoint, server }) => {
  const { url, stderr } = await serverEndpoint({ args: ['--isolated'] });

  const transport1 = new StreamableHTTPClientTransport(new URL('/mcp', url));
  const client1 = new Client({ name: 'test', version: '1.0.0' });
  await client1.connect(transport1);
  await client1.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  });
  /**
   * src/client/streamableHttp.ts
   * Clients that no longer need a particular session
   * (e.g., because the user is leaving the client application) SHOULD send an
   * HTTP DELETE to the MCP endpoint with the Mcp-Session-Id header to explicitly
   * terminate the session.
   */
  await transport1.terminateSession();
  await client1.close();

  const transport2 = new StreamableHTTPClientTransport(new URL('/mcp', url));
  const client2 = new Client({ name: 'test', version: '1.0.0' });
  await client2.connect(transport2);
  await client2.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  });
  await transport2.terminateSession();
  await client2.close();

  await expect(async () => {
    const lines = stderr().split('\n');
    expect(lines.filter(line => line.match(/create http session/)).length).toBe(2);
    expect(lines.filter(line => line.match(/delete http session/)).length).toBe(2);

    expect(lines.filter(line => line.match(/create context/)).length).toBe(2);
    expect(lines.filter(line => line.match(/close context/)).length).toBe(2);

    expect(lines.filter(line => line.match(/create browser context \(isolated\)/)).length).toBe(2);
    expect(lines.filter(line => line.match(/close browser context \(isolated\)/)).length).toBe(2);

    expect(lines.filter(line => line.match(/obtain browser \(isolated\)/)).length).toBe(2);
    expect(lines.filter(line => line.match(/close browser \(isolated\)/)).length).toBe(2);
  }).toPass();
});

test('http transport browser lifecycle (isolated, multiclient)', async ({ serverEndpoint, server }) => {
  const { url, stderr } = await serverEndpoint({ args: ['--isolated'] });

  const transport1 = new StreamableHTTPClientTransport(new URL('/mcp', url));
  const client1 = new Client({ name: 'test', version: '1.0.0' });
  await client1.connect(transport1);
  await client1.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  });

  const transport2 = new StreamableHTTPClientTransport(new URL('/mcp', url));
  const client2 = new Client({ name: 'test', version: '1.0.0' });
  await client2.connect(transport2);
  await client2.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  });
  await transport1.terminateSession();
  await client1.close();

  const transport3 = new StreamableHTTPClientTransport(new URL('/mcp', url));
  const client3 = new Client({ name: 'test', version: '1.0.0' });
  await client3.connect(transport3);
  await client3.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  });

  await transport2.terminateSession();
  await client2.close();
  await transport3.terminateSession();
  await client3.close();

  await expect(async () => {
    const lines = stderr().split('\n');
    expect(lines.filter(line => line.match(/create http session/)).length).toBe(3);
    expect(lines.filter(line => line.match(/delete http session/)).length).toBe(3);

    expect(lines.filter(line => line.match(/create context/)).length).toBe(3);
    expect(lines.filter(line => line.match(/close context/)).length).toBe(3);

    expect(lines.filter(line => line.match(/create browser context \(isolated\)/)).length).toBe(3);
    expect(lines.filter(line => line.match(/close browser context \(isolated\)/)).length).toBe(3);

    expect(lines.filter(line => line.match(/obtain browser \(isolated\)/)).length).toBe(1);
    expect(lines.filter(line => line.match(/close browser \(isolated\)/)).length).toBe(1);
  }).toPass();
});

test('http transport browser lifecycle (persistent)', async ({ serverEndpoint, server }) => {
  const { url, stderr } = await serverEndpoint();

  const transport1 = new StreamableHTTPClientTransport(new URL('/mcp', url));
  const client1 = new Client({ name: 'test', version: '1.0.0' });
  await client1.connect(transport1);
  await client1.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  });
  await transport1.terminateSession();
  await client1.close();

  const transport2 = new StreamableHTTPClientTransport(new URL('/mcp', url));
  const client2 = new Client({ name: 'test', version: '1.0.0' });
  await client2.connect(transport2);
  await client2.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  });
  await transport2.terminateSession();
  await client2.close();

  await expect(async () => {
    const lines = stderr().split('\n');
    expect(lines.filter(line => line.match(/create http session/)).length).toBe(2);
    expect(lines.filter(line => line.match(/delete http session/)).length).toBe(2);

    expect(lines.filter(line => line.match(/create context/)).length).toBe(2);
    expect(lines.filter(line => line.match(/close context/)).length).toBe(2);

    expect(lines.filter(line => line.match(/create browser context \(persistent\)/)).length).toBe(2);
    expect(lines.filter(line => line.match(/close browser context \(persistent\)/)).length).toBe(2);

    expect(lines.filter(line => line.match(/lock user data dir/)).length).toBe(2);
    expect(lines.filter(line => line.match(/release user data dir/)).length).toBe(2);
  }).toPass();
});

test('http transport browser lifecycle (persistent, multiclient)', async ({ serverEndpoint, server }) => {
  const { url } = await serverEndpoint();

  const transport1 = new StreamableHTTPClientTransport(new URL('/mcp', url));
  const client1 = new Client({ name: 'test', version: '1.0.0' });
  await client1.connect(transport1);
  await client1.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  });

  const transport2 = new StreamableHTTPClientTransport(new URL('/mcp', url));
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

test('http transport (default)', async ({ serverEndpoint }) => {
  const { url } = await serverEndpoint();
  const transport = new StreamableHTTPClientTransport(url);
  const client = new Client({ name: 'test', version: '1.0.0' });
  await client.connect(transport);
  await client.ping();
  expect(transport.sessionId, 'has session support').toBeDefined();
});

test('client should receive list roots request', async ({ serverEndpoint }) => {
  const { url } = await serverEndpoint();
  const transport = new StreamableHTTPClientTransport(url);
  const client = new Client({ name: 'test', version: '1.0.0' }, { capabilities: { roots: {} } });
  let rootsListedCallback;
  const rootsListedPromise = new Promise((resolve, reject) => {
    rootsListedCallback = resolve;
    setTimeout(() => reject(new Error('timeout waiting for ListRootsRequestSchema')), 5_000);
  });
  client.setRequestHandler(ListRootsRequestSchema, async request => {
    rootsListedCallback('success');
    return {
      roots: [
        {
          name: 'test',
          uri: 'file://tmp/',
        }
      ],
    };
  });
  await client.connect(transport);
  await client.ping();
  expect(await rootsListedPromise).toBe('success');
});
