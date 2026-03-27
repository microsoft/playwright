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
import { test, expect } from './cli-fixtures';

test('console', async ({ cli, server }) => {
  await cli('open', server.PREFIX);
  await cli('eval', 'console.log("Hello, world!")');
  const { output } = await cli('console');
  expect(output).toContain('Total messages: 1 (Errors: 0, Warnings: 0)');
  expect(output).toContain('Hello, world!');
});

test('console error', async ({ cli, server }) => {
  await cli('open', server.PREFIX);
  await cli('eval', 'console.log("log-level")');
  await cli('eval', 'console.error("error-level")');
  const { output } = await cli('console', 'error');
  expect(output).toContain('Total messages: 2 (Errors: 1, Warnings: 0)');
  expect(output).toContain('Returning 1 messages for level "error"');
  expect(output).not.toContain('log-level');
  expect(output).toContain('error-level');
});

test('console --clear', async ({ cli, server }) => {
  await cli('open', server.PREFIX);
  await cli('eval', 'console.log("log-level")');
  await cli('console', '--clear');
  const { output } = await cli('console');
  expect(output).not.toContain('log-level');
});

test('network', async ({ cli, server }) => {
  await cli('open', server.PREFIX);
  await cli('eval', '() => fetch("/hello-world")');
  const { output } = await cli('network');
  expect(output).not.toContain(`[GET] ${`${server.PREFIX}/`} => [200] OK`);
  expect(output).toContain(`[GET] ${`${server.PREFIX}/hello-world`} => [200] OK`);
});

test('network --static', async ({ cli, server }) => {
  await cli('open', server.PREFIX);
  const { output } = await cli('network', '--static');
  expect(output).toContain(`[GET] ${`${server.PREFIX}/`} => [200] OK`);
});

test('network --filter', async ({ cli, server }) => {
  server.setContent('/', `<script>
    Promise.all([fetch('/api/users'), fetch('/api/orders'), fetch('/static/image.png')]);
  </script>`, 'text/html');
  await cli('open', server.PREFIX);

  const { output } = await cli('network', '--filter=/api/', '--static');
  expect(output).toContain(`${server.PREFIX}/api/users`);
  expect(output).toContain(`${server.PREFIX}/api/orders`);
  expect(output).not.toContain(`${server.PREFIX}/static/image.png`);
});

test('network --request-body', async ({ cli, server }) => {
  server.setContent('/', `
    <button onclick="fetch('/api', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'value' }) })">Click me</button>
  `, 'text/html');
  server.setContent('/api', '{}', 'application/json');
  await cli('open', server.PREFIX);
  await cli('click', 'e2');

  {
    const { output } = await cli('network');
    expect(output).not.toContain('Request body:');
  }

  {
    const { output } = await cli('network', '--request-body');
    expect(output).toContain(`[POST] ${server.PREFIX}/api => [200] OK`);
    expect(output).toContain('Request body: {"key":"value"}');
  }
});

test('network --request-headers', async ({ cli, server }) => {
  server.setContent('/', `
    <button onclick="fetch('/api', { headers: { 'X-Custom-Header': 'test-value' } })">Click me</button>
  `, 'text/html');
  server.setContent('/api', '{}', 'application/json');
  await cli('open', server.PREFIX);
  await cli('click', 'e2');

  {
    const { output } = await cli('network');
    expect(output).not.toContain('Request headers:');
  }

  {
    const { output } = await cli('network', '--request-headers');
    expect(output).toContain(`[GET] ${server.PREFIX}/api => [200] OK`);
    expect(output).toContain('Request headers:');
    expect(output).toContain('x-custom-header: test-value');
  }
});

test('network --clear', async ({ cli, server }) => {
  await cli('open', server.PREFIX);
  await cli('eval', '() => fetch("/hello-world")');
  await cli('network', '--clear');
  const { output } = await cli('network');
  expect(output).not.toContain(`[GET] ${`${server.PREFIX}/hello-world`} => [200] OK`);
});

test('tracing-start-stop', async ({ cli, server }, testInfo) => {
  await cli('open', server.HELLO_WORLD);
  const { output } = await cli('tracing-start');
  expect(output).toContain('Trace recording started');
  await cli('eval', '() => fetch("/hello-world")');

  const { output: tracingStopOutput } = await cli('tracing-stop');
  expect(tracingStopOutput).toContain('Trace recording stopped');
  const [, timestamp] = tracingStopOutput.match(/trace-(\d+)\.trace/);
  expect(tracingStopOutput).toContain(`- [Trace](.playwright-cli${path.sep}traces${path.sep}trace-${timestamp}.trace)`);
  expect(tracingStopOutput).toContain(`- [Network log](.playwright-cli${path.sep}traces${path.sep}trace-${timestamp}.network)`);
  expect(tracingStopOutput).toContain(`- [Resources](.playwright-cli${path.sep}traces${path.sep}resources)`);

  expect(fs.existsSync(testInfo.outputPath('.playwright-cli', 'traces', 'resources'))).toBeTruthy();
  expect(fs.existsSync(testInfo.outputPath('.playwright-cli', 'traces', `trace-${timestamp}.trace`))).toBeTruthy();
  expect(fs.existsSync(testInfo.outputPath('.playwright-cli', 'traces', `trace-${timestamp}.network`))).toBeTruthy();
});

test('video-start-stop', async ({ cli, server }) => {
  await cli('open', server.HELLO_WORLD);
  const { output: videoStartOutput } = await cli('video-start');
  expect(videoStartOutput).toContain('Video recording started.');
  const { output: tabNewOutput } = await cli('tab-new');
  expect(tabNewOutput).toContain('1: (current) [](about:blank)');
  await cli('goto', server.EMPTY_PAGE);
  await cli('tab-select', '0');
  const { output: tabCloseOutput } = await cli('tab-close');
  expect(tabCloseOutput).toContain(`0: (current) [](${server.EMPTY_PAGE})`);
  const { output: videoStopOutput } = await cli('video-stop', '--filename=video.webm');
  expect(videoStopOutput).toContain(`### Result\n- [Video](video.webm)\n- [Video](video-1.webm)`);
});

test('video-chapter', async ({ cli, server }) => {
  await cli('open', server.HELLO_WORLD);
  await cli('video-start');
  const { output } = await cli('video-chapter', 'Introduction', '--description=Welcome to the demo', '--duration=100');
  expect(output).toContain(`Chapter 'Introduction' added.`);
  await cli('video-stop');
});
