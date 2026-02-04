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

test('browser_console_messages', async ({ client, server }) => {
  server.setContent('/', `
    <!DOCTYPE html>
    <html>
      <script>
        console.log("Hello, world!");
        console.error("Error");
      </script>
    </html>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: server.PREFIX,
    },
  });

  const resource = await client.callTool({
    name: 'browser_console_messages',
  });
  expect(resource).toHaveResponse({
    result: expect.stringContaining('Total messages: 2 (Errors: 1, Warnings: 0)'),
  });
  expect(resource).toHaveResponse({
    result: expect.stringContaining(`[LOG] Hello, world! @ ${server.PREFIX}/:4`),
  });
  expect(resource).toHaveResponse({
    result: expect.stringContaining(`[ERROR] Error @ ${server.PREFIX}/:5`),
  });
});

test('browser_console_messages (page error)', async ({ client, server }) => {
  server.setContent('/', `
    <!DOCTYPE html>
    <html>
      <script>
        throw new Error("Error in script");
      </script>
    </html>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: server.PREFIX,
    },
  });

  const resource = await client.callTool({
    name: 'browser_console_messages',
  });
  expect(resource).toHaveResponse({
    result: expect.stringContaining(`Error: Error in script`),
  });
  expect(resource).toHaveResponse({
    result: expect.stringContaining(server.PREFIX),
  });
});

test('recent console messages', async ({ client, server }) => {
  server.setContent('/', `
    <!DOCTYPE html>
    <html>
      <button onclick="console.log('Hello, world!');">Click me</button>
    </html>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: server.PREFIX,
    },
  });

  const response = await client.callTool({
    name: 'browser_click',
    arguments: {
      element: 'Click me',
      ref: 'e2',
    },
  });

  expect(response).toHaveResponse({
    events: expect.stringContaining(`- [LOG] Hello, world! @`),
  });
});

test('recent console messages filter', async ({ startClient, server }) => {
  server.setContent('/', `
    <!DOCTYPE html>
    <html>
      <script>
        console.log("console.log");
        console.error("console.error");
      </script>
    </html>
  `, 'text/html');

  const { client } = await startClient({
    args: ['--console-level', 'error'],
  });

  const response = parseResponse(await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: server.PREFIX,
    },
  }));

  expect(response.events).toContain('console.error');
  expect(response.events).not.toContain('console.log');
});

test('browser_console_messages default level', async ({ client, server }) => {
  await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: server.HELLO_WORLD,
    },
  });

  await client.callTool({
    name: 'browser_evaluate',
    arguments: {
      function: `async () => {
        console.debug("console.debug");
        console.log("console.log");
        console.warn("console.warn");
        console.error("console.error");
        setTimeout(() => { throw new Error("unhandled"); }, 0);
        await fetch('/missing');
      }`,
    },
  });

  const response = parseResponse(await client.callTool({
    name: 'browser_console_messages',
  }));
  expect.soft(response.result).toContain('console.log');
  expect.soft(response.result).toContain('console.warn');
  expect.soft(response.result).toContain('console.error');
  expect.soft(response.result).toContain('Error: unhandled');
  expect.soft(response.result).toContain('404');
  expect.soft(response.result).not.toContain('console.debug');
});

test('browser_console_messages errors only', async ({ client, server }) => {
  await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: server.HELLO_WORLD,
    },
  });

  await client.callTool({
    name: 'browser_evaluate',
    arguments: {
      function: `async () => {
        console.debug("console.debug");
        console.log("console.log");
        console.warn("console.warn");
        console.error("console.error");
        setTimeout(() => { throw new Error("unhandled"); }, 0);
        await fetch('/missing');
      }`,
    },
  });

  const response = parseResponse(await client.callTool({
    name: 'browser_console_messages',
    arguments: {
      level: 'error',
    },
  }));
  expect.soft(response.result).toMatch(/Total messages: \d+ \(Errors: \d+, Warnings: \d+\)/);
  expect.soft(response.result).toMatch(/Returning \d+ messages for level "error"/);
  expect.soft(response.result).toContain('console.error');
  expect.soft(response.result).toContain('Error: unhandled');
  expect.soft(response.result).toContain('404');
  expect.soft(response.result).not.toContain('console.log');
  expect.soft(response.result).not.toContain('console.warn');
});

test('console log file is created on snapshot', async ({ startClient, server }, testInfo) => {
  const outputDir = testInfo.outputPath('output');
  const { client } = await startClient({
    config: { outputDir, outputMode: 'file' },
  });

  server.setContent('/', `
    <!DOCTYPE html>
    <html>
      <script>
        console.warn("Warning message");
        console.error("Error message1");
        console.error("Error message2");
      </script>
    </html>
  `, 'text/html');

  const response = parseResponse(await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  }));

  // Check events section mentions the log file with line range
  expect(response.events).toMatch(/New console entries: output[/\\]console-.+\.log#L\d+(-L\d+)?/);

  // Verify log file exists and contains the messages
  const files = await fs.promises.readdir(outputDir);
  const logFiles = files.filter(f => f.startsWith('console-') && f.endsWith('.log'));
  expect(logFiles.length).toBe(1);

  const logContent = await fs.promises.readFile(path.join(outputDir, logFiles[0]), 'utf-8');
  expect(logContent).toContain('Warning message');
  expect(logContent).toContain('Error message1');
  expect(logContent).toContain('Error message2');
});

test('console log file shows correct entry count', async ({ startClient, server }, testInfo) => {
  const outputDir = testInfo.outputPath('output');
  const { client } = await startClient({
    config: { outputDir, outputMode: 'file' },
  });

  server.setContent('/', `
    <!DOCTYPE html>
    <html>
      <script>
        console.error("Error 1");
        console.error("Error 2");
        console.error("Error 3");
      </script>
    </html>
  `, 'text/html');

  const response = parseResponse(await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  }));

  expect(response.events).toContain('New console entries:');
});

test('console log file shows singular entry', async ({ startClient, server }, testInfo) => {
  const outputDir = testInfo.outputPath('output');
  const { client } = await startClient({
    config: { outputDir, outputMode: 'file' },
  });

  server.setContent('/', `
    <!DOCTYPE html>
    <html>
      <script>
        console.error("Single error");
      </script>
    </html>
  `, 'text/html');

  const response = parseResponse(await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  }));

  expect(response.events).toContain('New console entries:');
});

test('new console log file after navigation', async ({ startClient, server }, testInfo) => {
  const outputDir = testInfo.outputPath('output');
  const { client } = await startClient({
    config: { outputDir, outputMode: 'file' },
  });

  server.setContent('/page1', `
    <!DOCTYPE html>
    <html>
      <script>console.error("Page 1 message");</script>
    </html>
  `, 'text/html');

  server.setContent('/page2', `
    <!DOCTYPE html>
    <html>
      <script>console.error("Page 2 message");</script>
    </html>
  `, 'text/html');

  // Navigate to first page
  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX + '/page1' },
  });

  // Navigate to second page (should create new log file)
  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX + '/page2' },
  });

  // Verify two log files exist
  const files = await fs.promises.readdir(outputDir);
  const logFiles = files.filter(f => f.startsWith('console-') && f.endsWith('.log'));
  expect(logFiles.length).toBe(2);

  // Each file should have only its own message
  const contents = await Promise.all(
      logFiles.map(f => fs.promises.readFile(path.join(outputDir, f), 'utf-8'))
  );
  const allContent = contents.join('\n');
  expect(allContent).toContain('Page 1 message');
  expect(allContent).toContain('Page 2 message');
});

test('console log file appends on multiple snapshots', async ({ startClient, server }, testInfo) => {
  const outputDir = testInfo.outputPath('output');
  const { client } = await startClient({
    config: { outputDir, outputMode: 'file' },
  });

  server.setContent('/', `
    <!DOCTYPE html>
    <html>
      <button onclick="console.error('Button clicked');">Click me</button>
    </html>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  // Click button to generate console message
  await client.callTool({
    name: 'browser_click',
    arguments: { element: 'Click me', ref: 'e2' },
  });

  // Click again
  await client.callTool({
    name: 'browser_click',
    arguments: { element: 'Click me', ref: 'e2' },
  });

  // Verify only one log file exists (same page, appended)
  const files = await fs.promises.readdir(outputDir);
  const logFiles = files.filter(f => f.startsWith('console-') && f.endsWith('.log'));
  expect(logFiles.length).toBe(1);

  // File should contain both click messages
  const logContent = await fs.promises.readFile(path.join(outputDir, logFiles[0]), 'utf-8');
  const matches = logContent.match(/Button clicked/g);
  expect(matches?.length).toBe(2);
});

test('console log file stores message type and content', async ({ startClient, server }, testInfo) => {
  const outputDir = testInfo.outputPath('output');
  const { client } = await startClient({
    config: { outputDir, outputMode: 'file' },
  });

  server.setContent('/', `
    <!DOCTYPE html>
    <html>
      <script>
        console.warn("Warning message");
        console.error("Error message");
      </script>
    </html>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  const files = await fs.promises.readdir(outputDir);
  const logFiles = files.filter(f => f.startsWith('console-') && f.endsWith('.log'));
  expect(logFiles.length).toBe(1);

  const logContent = await fs.promises.readFile(path.join(outputDir, logFiles[0]), 'utf-8');
  expect(logContent).toContain('[WARNING] Warning message');
  expect(logContent).toContain('[ERROR] Error message');

  // Check that source location is stored
  expect(logContent).toMatch(/@ http:\/\/localhost:\d+\/:\d/);
});

test('console log is updated without taking snapshots', async ({ startClient, server }, testInfo) => {
  const outputDir = testInfo.outputPath('output');
  const { client } = await startClient({
    config: { outputDir, outputMode: 'file' },
  });

  // Navigate to the page (this takes a snapshot)
  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.EMPTY_PAGE },
  });

  async function getLogContent() {
    const files = await fs.promises.readdir(outputDir);
    const logFile = files.find(f => f.startsWith('console-') && f.endsWith('.log'));
    if (!logFile)
      return '<no log file>';
    return await fs.promises.readFile(path.join(outputDir, logFile!), 'utf-8');
  }

  // Use browser_evaluate to trigger console messages without taking a snapshot
  await client.callTool({
    name: 'browser_evaluate',
    arguments: {
      function: `() => {
        for (let i = 0; i < 5; i++) {
          console.error('Evaluated message ' + i);
        }
      }`,
    },
  });

  // Verify log file contains the evaluated messages without needing another snapshot
  await expect.poll(async () => await getLogContent()).toContain('Evaluated message 4');

  const logContent = await getLogContent();
  expect(logContent).toContain('Evaluated message 0');
  expect(logContent).toContain('Evaluated message 1');
  expect(logContent).toContain('Evaluated message 2');
  expect(logContent).toContain('Evaluated message 3');
});
