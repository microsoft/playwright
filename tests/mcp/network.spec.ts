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

test('browser_network_requests', async ({ client, server }) => {
  server.setContent('/', `
    <button onclick="fetch('/json')">Click me</button>
    <img src="/image.png" />
  `, 'text/html');

  server.setContent('/json', JSON.stringify({ name: 'John Doe' }), 'application/json');

  await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: server.PREFIX,
    },
  });

  await client.callTool({
    name: 'browser_click',
    arguments: {
      element: 'Click me button',
      ref: 'e2',
    },
  });

  {
    const response = parseResponse(await client.callTool({
      name: 'browser_network_requests',
    }));
    expect(response.result).not.toContain(`[GET] ${`${server.PREFIX}/`} => [200] OK`);
    expect(response.result).toContain(`[GET] ${`${server.PREFIX}/json`} => [200] OK`);
    expect(response.result).toContain(`[GET] ${`${server.PREFIX}/image.png`} => [404]`);
  }

  {
    const response = parseResponse(await client.callTool({
      name: 'browser_network_requests',
      arguments: {
        includeStatic: true,
      },
    }));
    expect(response.result).toContain(`[GET] ${`${server.PREFIX}/`} => [200] OK`);
    expect(response.result).toContain(`[GET] ${`${server.PREFIX}/json`} => [200] OK`);
    expect(response.result).toContain(`[GET] ${`${server.PREFIX}/image.png`} => [404]`);
  }
});

test('network log file is returned on snapshot', async ({ startClient, server }, testInfo) => {
  const outputDir = testInfo.outputPath('output');
  const { client } = await startClient({
    config: { outputDir, outputMode: 'file' },
  });

  server.setContent('/', `
    <html>
      <head>
        <link rel="stylesheet" href="/one-style.css">
      </head>
      <body>
        <img src="/image.png" />
        <script src="/script.js"></script>
      </body>
    </html>
  `, 'text/html');

  const response = parseResponse(await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  }));

  expect(response.events).toMatch(/\d+ new network entr(y|ies) in "output\/network-assets-.+\.log#L\d+(-L\d+)?"/);

  // Verify network log file exist
  const files = await fs.readdir(outputDir);
  const networkLogFiles = files.filter(f => f.startsWith('network-assets-') && f.endsWith('.log'));
  expect(networkLogFiles.length).toBe(1);

  // Verify the log contains both requests
  const logContent = await fs.readFile(path.join(outputDir, networkLogFiles[0]), 'utf-8');
  expect(logContent).toContain(`[GET] ${server.PREFIX}/ => [200] OK`);
  expect(logContent).toContain('/image.png => [404] Not Found');
  expect(logContent).toContain('/one-style.css => [200] OK');
  expect(logContent).toContain('/script.js => [404] Not Found');
});

test('network log file separates requests and assets', async ({ startClient, server }, testInfo) => {
  const outputDir = testInfo.outputPath('output');
  const { client } = await startClient({
    config: { outputDir, outputMode: 'file' },
  });

  server.setContent('/', `
    <html>
      <body>
        <img src="/image.png" />
      </body>
    </html>
  `, 'text/html');

  server.setContent('/api/data', JSON.stringify({ data: 'test' }), 'application/json');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  const response = parseResponse(await client.callTool({
    name: 'browser_evaluate',
    arguments: { function: '() => fetch("/api/data")' },
  }));
  expect(response.events).toMatch(/1 new network entry in "output\/network-requests-.+\.log#L\d+(-L\d+)?"/);

  const files = await fs.readdir(outputDir);

  // Check that both network-requests and network-assets log files exist
  const requestsLog = files.find(f => f.startsWith('network-requests-') && f.endsWith('.log'));
  const assetsLog = files.find(f => f.startsWith('network-assets-') && f.endsWith('.log'));

  expect(requestsLog).toBeTruthy();
  expect(assetsLog).toBeTruthy();

  // API request should be in network-requests log
  const requestsContent = await fs.readFile(path.join(outputDir, requestsLog!), 'utf-8');
  expect(requestsContent).toContain('/api/data => [200] OK');

  // Image should be in network-assets log
  const assetsContent = await fs.readFile(path.join(outputDir, assetsLog!), 'utf-8');
  expect(assetsContent).toContain('/image.png');
  expect(assetsContent).not.toContain('/api/data');
});

test('network log file stores method and status', async ({ startClient, server }, testInfo) => {
  const outputDir = testInfo.outputPath('output');
  const { client } = await startClient({
    config: { outputDir, outputMode: 'file' },
  });

  server.setContent('/api/get', JSON.stringify({ method: 'get' }), 'application/json');
  server.setContent('/api/post', JSON.stringify({ method: 'post' }), 'application/json');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.EMPTY_PAGE },
  });

  const response = parseResponse(await client.callTool({
    name: 'browser_evaluate',
    arguments: { function: `async () => {
        await fetch('/api/get');
        await fetch('/api/post', { method: 'POST' });
      }`
    },
  }));
  expect(response.events).toMatch(/2 new network entries in "output\/network-requests-.+\.log#L\d+(-L\d+)?"/);

  const files = await fs.readdir(outputDir);
  const requestsLog = files.find(f => f.startsWith('network-requests-') && f.endsWith('.log'));
  expect(requestsLog).toBeTruthy();

  const logContent = await fs.readFile(path.join(outputDir, requestsLog!), 'utf-8');

  // Check that method and status are stored
  expect(logContent).toMatch(/\[GET\].*\/api\/get.*=>\s*\[200\]/);
  expect(logContent).toMatch(/\[POST\].*\/api\/post.*=>\s*\[200\]/);

  expect(logContent.split('\n').filter(Boolean).length).toBe(2);
});

test('new network log file after navigation', async ({ startClient, server }, testInfo) => {
  const outputDir = testInfo.outputPath('output');
  const { client } = await startClient({
    config: { outputDir, outputMode: 'file' },
  });

  server.setContent('/page1', `
    <html>
      <head>
        <link rel="stylesheet" href="/one-style.css">
      </head>
    </html>
  `, 'text/html');

  server.setContent('/page2', `
    <html>
      <head>
        <link rel="stylesheet" href="/one-style.css">
      </head>
      <body>
        <img src="/image.png" />
      </body>
    </html>
  `, 'text/html');

  // Navigate to first page
  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX + '/page1' },
  });

  {
    // Should have one network-assets log file
    const files = await fs.readdir(outputDir);
    const networkLogs = files.filter(f => f.startsWith('network-assets-') && f.endsWith('.log'));
    expect(networkLogs.length).toBe(1);

    const logContent = await fs.readFile(path.join(outputDir, networkLogs[0]), 'utf-8');
    expect(logContent).toContain('/one-style.css');
  }

  // Navigate to second page
  const response2 = parseResponse(await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX + '/page2' },
  }));

  expect(response2.events).toMatch(/\d+ new network entries in "output\/network-assets-.+\.log#L\d+(-L\d+)?"/);
  const secondFileName = response2.events.match(/(network-assets-.+\.log)#/)![1];

  {
    // Should have 2 network-requests log files (one per navigation)
    const files = await fs.readdir(outputDir);
    const networkLogs = files.filter(f => f.startsWith('network-assets-') && f.endsWith('.log'));
    expect(networkLogs.length).toBe(2);

    const file = networkLogs.find(f => f === secondFileName);
    expect(file).toBeTruthy();

    const logContent = await fs.readFile(path.join(outputDir, file), 'utf-8');
    expect(logContent).toContain('/one-style.css');
    expect(logContent).toContain('/image.png');
  }
});
