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

function parseLogEvents(events: string) {
  const dynamicMatch = /\d+ new network entr(y|ies) in "(output[\\/]network-dynamic-.+\.log)#L\d+(-L\d+)?"/.exec(events);
  const fullMatch = /\d+ new network entr(y|ies) in "(output[\\/]network-full-.+\.log)#L\d+(-L\d+)?"/.exec(events);
  return {
    dynamicLogFile: dynamicMatch?.[2],
    fullLogFile: fullMatch?.[2],
  };
}

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

  server.setContent('/empty.html', `
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
    arguments: { url: server.EMPTY_PAGE },
  }));

  expect(response.events).toMatch(/\d+ new network entr(y|ies) in "output\/network-full-.+\.log#L\d+(-L\d+)?"/);

  // Verify network log file exist
  const files = await fs.readdir(outputDir);
  const networkLogFiles = files.filter(f => f.startsWith('network-full-') && f.endsWith('.log'));
  expect(networkLogFiles.length).toBe(1);

  const { fullLogFile } = parseLogEvents(response.events);
  expect(fullLogFile).toBeTruthy();
  // Verify the log contains both requests
  const logContent = await fs.readFile(testInfo.outputPath(fullLogFile), 'utf-8');
  expect(logContent).toMatch(new RegExp([
      /\[GET\].*empty\.html => \[200\] OK/,
      /\/image\.png => \[404\] Not Found/,
      /\/one-style\.css => \[200\] OK/,
      /\/script\.js => \[404\] Not Found/,
    ].map(r => `(?=[\\s\\S]*${r.source})`).join(''))
  );
});

test('network log file separates requests and assets', async ({ startClient, server }, testInfo) => {
  const outputDir = testInfo.outputPath('output');
  const { client } = await startClient({
    config: { outputDir, outputMode: 'file' },
  });

  server.setContent('/empty.html', `
    <html>
      <body>
        <img src="/image.png" />
      </body>
    </html>
  `, 'text/html');

  server.setContent('/api/data', JSON.stringify({ data: 'test' }), 'application/json');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.EMPTY_PAGE },
  });

  const response = parseResponse(await client.callTool({
    name: 'browser_evaluate',
    arguments: { function: '() => fetch("/api/data")' },
  }));
  expect(response.events).toMatch(/\d+ new network entr(y|ies) in "output\/network-dynamic-.+\.log#L\d+(-L\d+)?"/);

  // Check that both network-dynamic and network-full log files exist
  const { dynamicLogFile, fullLogFile } = parseLogEvents(response.events);
  expect(dynamicLogFile).toBeTruthy();
  expect(fullLogFile).toBeTruthy();

  // API request should be in network-dynamic log
  const dynamicContent = await fs.readFile(testInfo.outputPath(dynamicLogFile), 'utf-8');
  expect(dynamicContent).toMatch(new RegExp([
    /\/api\/data => \[200\] OK/,
    /\/image\.png => \[404\] Not Found/,
  ].map(r => `(?=[\\s\\S]*${r.source})`).join('')));
  // main resource
  expect(dynamicContent).not.toContain(`[GET] ${server.EMPTY_PAGE}`);

  // network-full should contain all requests
  const fullContent = await fs.readFile(testInfo.outputPath(fullLogFile), 'utf-8');
  expect(fullContent).toMatch(new RegExp([
    /\[GET\].*empty\.html => \[200\] OK/,
    /\/image\.png => \[404\] Not Found/,
    /\/api\/data => \[200\] OK/,
  ].map(r => `(?=[\\s\\S]*${r.source})`).join('')));
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
  expect(response.events).toMatch(/\d+ new network entr(y|ies) in "output\/network-dynamic-.+\.log#L\d+(-L\d+)?"/);

  const { dynamicLogFile, fullLogFile } = parseLogEvents(response.events);
  expect(dynamicLogFile).toBeTruthy();
  expect(fullLogFile).toBeTruthy();

  const logContent = await fs.readFile(testInfo.outputPath(dynamicLogFile), 'utf-8');
  expect(logContent).toMatch(new RegExp([
    /\[GET\].*\/api\/get.*=>\s*\[200\]/,
    /\[POST\].*\/api\/post.*=>\s*\[200\]/,
  ].map(r => `(?=[\\s\\S]*${r.source})`).join('')));

  const fullContent = await fs.readFile(testInfo.outputPath(fullLogFile), 'utf-8');
  expect(fullContent).toMatch(new RegExp([
    /\[GET\].*\/api\/get.*=>\s*\[200\]/,
    /\[POST\].*\/api\/post.*=>\s*\[200\]/,
  ].map(r => `(?=[\\s\\S]*${r.source})`).join('')));
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
  const response1 = parseResponse(await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX + '/page1' },
  }));

  {
    // Should have one network-full log file
    const { fullLogFile } = parseLogEvents(response1.events);
    expect(fullLogFile).toBeTruthy();

    const logContent = await fs.readFile(testInfo.outputPath(fullLogFile), 'utf-8');
    expect(logContent).toContain('/one-style.css');
  }

  // Navigate to second page
  const response2 = parseResponse(await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX + '/page2' },
  }));

  expect(response2.events).toMatch(/\d+ new network entries in "output\/network-full-.+\.log#L\d+(-L\d+)?"/);
  const { fullLogFile: secondLogFile } = parseLogEvents(response2.events);

  {
    // Should have 2 network-full log files (one per navigation)
    const files = await fs.readdir(outputDir);
    const networkLogs = files.filter(f => f.startsWith('network-full-') && f.endsWith('.log'));
    expect(networkLogs.length).toBe(2);

    expect(secondLogFile).toBeTruthy();
    const logContent = await fs.readFile(testInfo.outputPath(secondLogFile), 'utf-8');
    expect(logContent).toMatch(new RegExp([
      /\/one-style\.css => \[200\] OK/,
      /\/image\.png => \[404\] Not Found/,
    ].map(r => `(?=[\\s\\S]*${r.source})`).join('')));
  }
});
