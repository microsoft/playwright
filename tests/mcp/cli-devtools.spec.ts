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

test('requests', async ({ cli, server }) => {
  await cli('open', server.PREFIX);
  await cli('eval', '() => fetch("/hello-world")');
  const { output } = await cli('requests');
  expect(output).not.toContain(`[GET] ${`${server.PREFIX}/`} => [200] OK`);
  expect(output).toMatch(new RegExp(String.raw`^\d+\. \[GET\] ${escapeRegExp(`${server.PREFIX}/hello-world`)} => \[200\] OK$`, 'm'));
  expect(output).toContain('Note: 1 static request not shown, run with --static option to see it.');
});

test('requests --static', async ({ cli, server }) => {
  await cli('open', server.PREFIX);
  const { output } = await cli('requests', '--static');
  expect(output).toMatch(new RegExp(String.raw`^\d+\. \[GET\] ${escapeRegExp(`${server.PREFIX}/`)} => \[200\] OK$`, 'm'));
  expect(output).not.toContain('not shown');
});

test('requests --filter', async ({ cli, server }) => {
  server.setContent('/', `<script>
    Promise.all([fetch('/api/users'), fetch('/api/orders'), fetch('/static/image.png')]);
  </script>`, 'text/html');
  await cli('open', server.PREFIX);

  const { output } = await cli('requests', '--filter=/api/', '--static');
  expect(output).toContain(`${server.PREFIX}/api/users`);
  expect(output).toContain(`${server.PREFIX}/api/orders`);
  expect(output).not.toContain(`${server.PREFIX}/static/image.png`);
});

test('requests --clear', async ({ cli, server }) => {
  await cli('open', server.PREFIX);
  await cli('eval', '() => fetch("/hello-world")');
  await cli('requests', '--clear');
  const { output } = await cli('requests');
  expect(output).not.toContain(`${server.PREFIX}/hello-world`);
});

test('request shows full request and response details', async ({ cli, server }) => {
  server.setContent('/', `
    <button onclick="fetch('/api', { method: 'POST', headers: { 'X-Custom-Header': 'test-value' }, body: JSON.stringify({ key: 'value' }) })">Click me</button>
  `, 'text/html');
  server.setRoute('/api', (_req, res) => {
    res.setHeader('X-Custom-Response', 'response-value');
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ name: 'John Doe' }));
  });
  await cli('open', server.PREFIX);
  await cli('click', 'e2');

  const { output: list } = await cli('requests');
  const match = list.match(/^(\d+)\. \[POST\] [^ ]+\/api =>/m);
  expect(match).not.toBeNull();

  const { output } = await cli('request', match![1]);
  expect(output).toContain(`#${match![1]} [POST] ${server.PREFIX}/api`);
  expect(output).toContain('General');
  expect(output).toContain('status:    [200] OK');
  expect(output).toContain('Request headers');
  expect(output).toContain('x-custom-header: test-value');
  expect(output).toContain('Response headers');
  expect(output).toContain('x-custom-response: response-value');
  expect(output).toContain(`Run \`request-body ${match![1]}\` to read the request body.`);
  expect(output).toContain(`Run \`response-body ${match![1]}\` to read the response body.`);
  expect(output).not.toContain('Request body');
  expect(output).not.toContain('Response body');
  expect(output).not.toContain('{"key":"value"}');
});

test('per-part commands extract individual parts', async ({ cli, server }) => {
  server.setContent('/', `
    <button onclick="fetch('/api', { method: 'POST', headers: { 'X-Custom-Header': 'test-value' }, body: JSON.stringify({ key: 'value' }) })">Click me</button>
  `, 'text/html');
  server.setRoute('/api', (_req, res) => {
    res.setHeader('X-Custom-Response', 'response-value');
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ name: 'John Doe' }));
  });
  await cli('open', server.PREFIX);
  await cli('click', 'e2');

  const { output: list } = await cli('requests');
  const match = list.match(/^(\d+)\. \[POST\] [^ ]+\/api =>/m);
  expect(match).not.toBeNull();
  const num = match![1];

  expect((await cli('request-headers', num)).output).toContain('x-custom-header: test-value');
  expect((await cli('request-body', num)).output).toContain('{"key":"value"}');
  expect((await cli('response-headers', num)).output).toContain('x-custom-response: response-value');
  expect((await cli('response-body', num)).output).toContain('{"name":"John Doe"}');
});

test('request* and response* commands support --filename', async ({ cli, server }, testInfo) => {
  server.setContent('/', `
    <button onclick="fetch('/api', { method: 'POST', body: 'hello' })">Click me</button>
  `, 'text/html');
  server.setRoute('/api', (_req, res) => {
    res.setHeader('X-Custom-Response', 'response-value');
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ name: 'John Doe' }));
  });
  await cli('open', server.PREFIX);
  await cli('click', 'e2');

  const { output: list } = await cli('requests');
  const match = list.match(/^(\d+)\. \[POST\] [^ ]+\/api =>/m);
  expect(match).not.toBeNull();
  const num = match![1];

  const read = (file: string) => fs.readFileSync(testInfo.outputPath(file), 'utf-8');

  expect((await cli('request', num, '--filename=req.log')).output).toContain('[Request](./req.log)');
  expect(read('req.log')).toContain(`[POST] ${server.PREFIX}/api`);

  expect((await cli('request-headers', num, '--filename=req-h.txt')).output).toContain('[Body](./req-h.txt)');
  expect(read('req-h.txt')).toContain('content-type: text/plain;charset=UTF-8');

  expect((await cli('request-body', num, '--filename=req-b.txt')).output).toContain('[Body](./req-b.txt)');
  expect(read('req-b.txt')).toBe('hello');

  expect((await cli('response-headers', num, '--filename=res-h.txt')).output).toContain('[Body](./res-h.txt)');
  expect(read('res-h.txt')).toContain('x-custom-response: response-value');

  expect((await cli('response-body', num, '--filename=res-b.json')).output).toContain('[Body](./res-b.json)');
  expect(read('res-b.json')).toBe('{"name":"John Doe"}');
});

test('--raw response-body returns just the body', async ({ cli, server }) => {
  server.setContent('/', `
    <button onclick="fetch('/api')">Click me</button>
  `, 'text/html');
  server.setContent('/api', JSON.stringify({ name: 'John Doe' }), 'application/json');
  await cli('open', server.PREFIX);
  await cli('click', 'e2');

  const { output: list } = await cli('requests');
  const match = list.match(/^(\d+)\. \[GET\] [^ ]+\/api =>/m);
  expect(match).not.toBeNull();

  const { output } = await cli('--raw', 'response-body', match![1]);
  expect(output.trim()).toBe('{"name":"John Doe"}');
});

test('request with out-of-range index', async ({ cli, server }) => {
  await cli('open', server.PREFIX);
  const { output } = await cli('request', '999');
  expect(output).toContain('Request #999 not found');
});

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

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
  const { output: videoStartOutput } = await cli('video-start', 'video.webm', '--size=400x300');
  expect(videoStartOutput).toContain('Video recording started.');
  const { output: tabNewOutput } = await cli('tab-new');
  expect(tabNewOutput).toContain('1: (current) [](about:blank)');
  await cli('goto', server.EMPTY_PAGE);
  await cli('tab-select', '0');
  const { output: tabCloseOutput } = await cli('tab-close');
  expect(tabCloseOutput).toContain(`0: (current) [](${server.EMPTY_PAGE})`);
  const { output: videoStopOutput } = await cli('video-stop');
  expect(videoStopOutput).toContain(`### Result\n- [Video](./video.webm)\n- [Video](./video-1.webm)`);
});

test('video-chapter', async ({ cli, server }) => {
  await cli('open', server.HELLO_WORLD);
  await cli('video-start', 'video.webm');
  const { output } = await cli('video-chapter', 'Introduction', '--description=Welcome to the demo', '--duration=100');
  expect(output).toContain(`Chapter 'Introduction' added.`);
  await cli('video-stop');
});

test('generate-locator', async ({ cli, server }) => {
  server.setContent('/', `<button>Submit</button>`, 'text/html');
  await cli('open', server.PREFIX);
  await cli('snapshot');

  const { output } = await cli('generate-locator', 'e2', '--raw');
  expect(output).toContain(`getByRole('button', { name: 'Submit' })`);
});

test('highlight', async ({ boundBrowser, cli }) => {
  const page = await boundBrowser.newPage();
  await page.setContent(`<button>Submit</button>`);

  await cli('attach', 'default');
  await cli('snapshot');

  const { output } = await cli('highlight', 'e2');
  expect(output).toContain(`Highlighted locator('aria-ref=e2')`);

  const highlight = page.locator('x-pw-highlight');
  const tooltip = page.locator('x-pw-tooltip-line');
  await expect(highlight).toBeVisible();
  await expect(tooltip).toHaveText(`locator('aria-ref=e2')`);
  expect(await highlight.boundingBox()).toEqual(await page.getByRole('button', { name: 'Submit' }).boundingBox());
});

test('highlight --hide', async ({ boundBrowser, cli }) => {
  const page = await boundBrowser.newPage();
  await page.setContent(`<button>Submit</button>`);

  await cli('attach', 'default');
  await cli('snapshot');

  await cli('highlight', 'e2');
  await expect(page.locator('x-pw-highlight')).toBeVisible();

  const { output } = await cli('highlight', 'e2', '--hide');
  expect(output).toContain(`Hid highlight for locator('aria-ref=e2')`);
  await expect(page.locator('x-pw-highlight')).toHaveCount(0);
});

test('highlight --hide all', async ({ boundBrowser, cli }) => {
  const page = await boundBrowser.newPage();
  await page.setContent(`<button>Submit</button><a href="#">Go</a>`);

  await cli('attach', 'default');
  await cli('snapshot');

  await cli('highlight', 'e2');
  await cli('highlight', 'e3');
  await expect(page.locator('x-pw-highlight')).toHaveCount(2);

  const { output } = await cli('highlight', '--hide');
  expect(output).toContain('Hid page highlight');
  await expect(page.locator('x-pw-highlight')).toHaveCount(0);
});

test('highlight --style', async ({ boundBrowser, cli, mcpBrowser }) => {
  const page = await boundBrowser.newPage();
  await page.setContent(`<button>Submit</button>`);

  await cli('attach', 'default');
  await cli('snapshot');

  await cli('highlight', 'e2', '--style=outline: 3px solid rgb(255, 0, 0); background-color: rgba(0, 255, 0, 0.25)');

  const highlight = page.locator('x-pw-highlight');
  await expect(highlight).toBeVisible();
  expect(await highlight.evaluate((el: HTMLElement) => ({
    outline: el.style.outline,
    backgroundColor: el.style.backgroundColor,
  }))).toEqual(mcpBrowser === 'webkit' ? {
    outline: '3px solid rgb(255, 0, 0)',
    backgroundColor: 'rgba(0, 255, 0, 0.25)',
  } : {
    outline: 'rgb(255, 0, 0) solid 3px',
    backgroundColor: 'rgba(0, 255, 0, 0.25)',
  });
});
