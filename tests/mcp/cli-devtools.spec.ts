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
  const { output: videoStartOutput } = await cli('video-start', 'video.webm', '--size=400x300');
  expect(videoStartOutput).toContain('Video recording started.');
  const { output: tabNewOutput } = await cli('tab-new');
  expect(tabNewOutput).toContain('1: (current) [](about:blank)');
  await cli('goto', server.EMPTY_PAGE);
  await cli('tab-select', '0');
  const { output: tabCloseOutput } = await cli('tab-close');
  expect(tabCloseOutput).toContain(`0: (current) [](${server.EMPTY_PAGE})`);
  const { output: videoStopOutput } = await cli('video-stop');
  expect(videoStopOutput).toContain(`### Result\n- [Video](video.webm)\n- [Video](video-1.webm)`);
});

test('video-chapter', async ({ cli, server }) => {
  await cli('open', server.HELLO_WORLD);
  await cli('video-start', 'video.webm');
  const { output } = await cli('video-chapter', 'Introduction', '--description=Welcome to the demo', '--duration=100');
  expect(output).toContain(`Chapter 'Introduction' added.`);
  await cli('video-stop');
});

test('pick', async ({ cdpServer, cli, server }) => {
  server.setContent('/', `<button>Submit</button>`, 'text/html');
  const browserContext = await cdpServer.start();
  const [page] = browserContext.pages();
  await page.goto(server.PREFIX);

  await cli('attach', `--cdp=${cdpServer.endpoint}`);
  await cli('snapshot');

  const scriptReady = page.waitForEvent('console', msg => msg.text() === 'Recorder script ready for test');
  const pickPromise = cli('pick');
  await scriptReady;

  const box = await page.getByRole('button', { name: 'Submit' }).boundingBox();
  await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);

  const { output } = await pickPromise;
  expect(output).toContain(`ref: e2`);
  expect(output).toContain(`locator: getByRole('button', { name: 'Submit' })`);
});

test('pick activates dashboard session', async ({ cdpServer, cli, server, openDashboard }) => {
  server.setContent('/', `<button>Submit</button>`, 'text/html');
  const browserContext = await cdpServer.start();
  const [page] = browserContext.pages();
  await page.goto(server.PREFIX);

  await cli('attach', `--cdp=${cdpServer.endpoint}`);
  await cli('snapshot');

  const dashboard = await openDashboard();
  await expect(dashboard.locator('div.dashboard-view')).toBeVisible();

  const scriptReady = page.waitForEvent('console', msg => msg.text() === 'Recorder script ready for test');
  const pickPromise = cli('pick');
  await scriptReady;

  await expect(dashboard.locator('div.dashboard-view.interactive')).toBeVisible();

  const box = await page.getByRole('button', { name: 'Submit' }).boundingBox();
  await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);

  const { output } = await pickPromise;
  expect(output).toContain(`ref: e2`);
  expect(output).toContain(`locator: getByRole('button', { name: 'Submit' })`);
});

test('highlight', async ({ cdpServer, cli, server }) => {
  server.setContent('/', `<button>Submit</button>`, 'text/html');
  const browserContext = await cdpServer.start();
  const [page] = browserContext.pages();
  await page.goto(server.PREFIX);

  await cli('attach', `--cdp=${cdpServer.endpoint}`);
  await cli('snapshot');

  const { output } = await cli('highlight', 'e2');
  expect(output).toContain(`Highlighted locator('aria-ref=e2')`);

  const highlight = page.locator('x-pw-highlight');
  const tooltip = page.locator('x-pw-tooltip-line');
  await expect(highlight).toBeVisible();
  await expect(tooltip).toHaveText(`locator('aria-ref=e2')`);
  expect(await highlight.boundingBox()).toEqual(await page.getByRole('button', { name: 'Submit' }).boundingBox());
});

test('highlight --hide', async ({ cdpServer, cli, server }) => {
  server.setContent('/', `<button>Submit</button>`, 'text/html');
  const browserContext = await cdpServer.start();
  const [page] = browserContext.pages();
  await page.goto(server.PREFIX);

  await cli('attach', `--cdp=${cdpServer.endpoint}`);
  await cli('snapshot');

  await cli('highlight', 'e2');
  await expect(page.locator('x-pw-highlight')).toBeVisible();

  const { output } = await cli('highlight', 'e2', '--hide');
  expect(output).toContain(`Hid highlight for locator('aria-ref=e2')`);
  await expect(page.locator('x-pw-highlight')).toHaveCount(0);
});

test('highlight --hide all', async ({ cdpServer, cli, server }) => {
  server.setContent('/', `<button>Submit</button><a href="#">Go</a>`, 'text/html');
  const browserContext = await cdpServer.start();
  const [page] = browserContext.pages();
  await page.goto(server.PREFIX);

  await cli('attach', `--cdp=${cdpServer.endpoint}`);
  await cli('snapshot');

  await cli('highlight', 'e2');
  await cli('highlight', 'e3');
  await expect(page.locator('x-pw-highlight')).toHaveCount(2);

  const { output } = await cli('highlight', '--hide');
  expect(output).toContain('Hid page highlight');
  await expect(page.locator('x-pw-highlight')).toHaveCount(0);
});

test('highlight --style', async ({ cdpServer, cli, server }) => {
  server.setContent('/', `<button>Submit</button>`, 'text/html');
  const browserContext = await cdpServer.start();
  const [page] = browserContext.pages();
  await page.goto(server.PREFIX);

  await cli('attach', `--cdp=${cdpServer.endpoint}`);
  await cli('snapshot');

  await cli('highlight', 'e2', '--style=outline: 3px solid rgb(255, 0, 0); background-color: rgba(0, 255, 0, 0.25)');

  const highlight = page.locator('x-pw-highlight');
  await expect(highlight).toBeVisible();
  expect(await highlight.evaluate((el: HTMLElement) => ({
    outline: el.style.outline,
    backgroundColor: el.style.backgroundColor,
  }))).toEqual({
    outline: 'rgb(255, 0, 0) solid 3px',
    backgroundColor: 'rgba(0, 255, 0, 0.25)',
  });
});
