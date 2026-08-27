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
import child_process from 'child_process';
import fs from 'fs/promises';
import net from 'net';

import * as playwright from 'playwright';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { test, expect } from './fixtures';
import { tools } from '../../packages/playwright-core/lib/coreBundle';

import type { Server } from '@modelcontextprotocol/sdk/server/index.js';

const { createConnection } = tools;

test('library can be used from CommonJS', { annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright-mcp/issues/456' } }, async ({}, testInfo) => {
  const file = testInfo.outputPath('main.cjs');
  await fs.writeFile(file, `
    import('playwright-core/lib/coreBundle')
      .then(({ tools }) => tools.createConnection())
      .then(() => console.log('OK'));
 `);
  expect(child_process.execSync(`node ${file}`, { encoding: 'utf-8' })).toContain('OK');
});

test('createConnection detaches backend listeners from a caller owned context', async ({ mcpBrowser, mcpHeadless, server }, testInfo) => {
  const { browserName, channel } = browserForProject(mcpBrowser);
  const browser = await playwright[browserName].launch({ channel, headless: mcpHeadless });
  const browserContext = await browser.newContext();

  const client = await connectClient(await createConnection({
    outputDir: testInfo.outputPath('output'),
  }, async () => browserContext));

  const contextListeners = listenerCount(browserContext, 'close');
  const browserListeners = listenerCount(browser, 'disconnected');

  // browser_close disposes the backend while the caller keeps the context, so
  // the next tool call builds another backend over the same two objects.
  for (let i = 0; i < 3; i++) {
    await client.callTool({ name: 'browser_navigate', arguments: { url: server.HELLO_WORLD } });
    // A live backend listens on both objects.
    expect(listenerCount(browserContext, 'close')).toBe(contextListeners + 1);
    expect(listenerCount(browser, 'disconnected')).toBe(browserListeners + 1);

    await client.callTool({ name: 'browser_close', arguments: {} });
    // A disposed one gives both back, so they do not pile up.
    expect(listenerCount(browserContext, 'close')).toBe(contextListeners);
    expect(listenerCount(browser, 'disconnected')).toBe(browserListeners);
  }

  await client.close();
  await browser.close();
});

test('createConnection closes the browser it launched when the backend is disposed', async ({ mcpBrowser, mcpHeadless, server }, testInfo) => {
  test.skip(!['chrome', 'msedge', 'chromium'].includes(mcpBrowser!), 'Profile locking is a Chromium behavior');

  const { browserName, channel } = browserForProject(mcpBrowser);
  const userDataDir = testInfo.outputPath('user-data-dir');

  const client = await connectClient(await createConnection({
    browser: { browserName, userDataDir, launchOptions: { channel, headless: mcpHeadless } },
    outputDir: testInfo.outputPath('output'),
  }));

  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  })).toHaveResponse({
    page: expect.stringContaining(`Page URL: ${server.HELLO_WORLD}`),
  });

  // Nothing else holds this browser, so disposing the backend has to close it.
  // A leaked browser keeps the profile, and nothing else can open it. Claiming
  // the profile from the test rather than through another tool call keeps this
  // about the browser process and not about how the server rebuilds a backend.
  await client.callTool({ name: 'browser_close', arguments: {} });
  await client.close();

  await expect.poll(async () => {
    try {
      const context = await playwright[browserName].launchPersistentContext(userDataDir, { channel, headless: mcpHeadless });
      await context.close();
      return 'free';
    } catch (e: any) {
      return String(e.message);
    }
  }, { timeout: 15000 }).toBe('free');
});

test('createConnection drops its connection to an attached browser when the backend is disposed', async ({ mcpBrowser, mcpHeadless, server }, testInfo) => {
  const { browserName, channel } = browserForProject(mcpBrowser);
  const browserServer = await playwright[browserName].launchServer({ channel, headless: mcpHeadless });
  const wsUrl = new URL(browserServer.wsEndpoint());
  // URL keeps the brackets around an IPv6 host, net.connect does not take them.
  const wsHost = wsUrl.hostname.replace(/^\[|\]$/g, '');

  // A counting TCP proxy in front of the browser server makes the connection
  // the factory holds observable from the outside.
  let openConnections = 0;
  const proxy = net.createServer(socket => {
    openConnections++;
    const upstream = net.connect(Number(wsUrl.port), wsHost);
    socket.pipe(upstream);
    upstream.pipe(socket);
    socket.once('close', () => {
      openConnections--;
      upstream.destroy();
    });
    upstream.once('close', () => socket.destroy());
    socket.on('error', () => socket.destroy());
    upstream.on('error', () => upstream.destroy());
  });
  await new Promise<void>(resolve => proxy.listen(0, '127.0.0.1', resolve));
  const proxyPort = (proxy.address() as net.AddressInfo).port;

  const client = await connectClient(await createConnection({
    browser: { remoteEndpoint: `ws://127.0.0.1:${proxyPort}${wsUrl.pathname}` },
    outputDir: testInfo.outputPath('output'),
  }));

  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  })).toHaveResponse({
    page: expect.stringContaining(`Page URL: ${server.HELLO_WORLD}`),
  });
  expect(openConnections).toBe(1);

  // The factory attached to this browser instead of launching it, so closing
  // the browser on dispose only drops the connection the factory made while
  // the browser server keeps running. Skipping the close would leak that
  // connection for as long as the server stays up.
  await client.callTool({ name: 'browser_close', arguments: {} });
  await expect.poll(() => openConnections).toBe(0);

  // The external browser survived the disconnect.
  const probe = await playwright[browserName].connect(browserServer.wsEndpoint());
  expect(probe.isConnected()).toBe(true);
  await probe.close();

  await client.close();
  await new Promise<void>(resolve => proxy.close(() => resolve()));
  await browserServer.close();
});

function browserForProject(mcpBrowser: string | undefined): { browserName: 'chromium' | 'firefox' | 'webkit', channel: string | undefined } {
  const channel = mcpBrowser === 'chrome' || mcpBrowser === 'msedge' ? mcpBrowser : undefined;
  const browserName = channel || mcpBrowser === 'chromium' ? 'chromium' : mcpBrowser as 'firefox' | 'webkit';
  return { browserName, channel };
}

function listenerCount(emitter: object, event: string): number {
  return (emitter as unknown as { listenerCount(event: string): number }).listenerCount(event);
}

async function connectClient(server: Server): Promise<Client> {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: 'test', version: '1.0.0' });
  await client.connect(clientTransport);
  return client;
}
