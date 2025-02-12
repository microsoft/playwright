/**
 * Copyright 2018 Google Inc. All rights reserved.
 * Modifications copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { stripAnsi } from 'tests/config/utils';
import type { TestServer } from '../config/testserver';
import { test as it, expect } from './pageTest';

function initStallingServer(server: TestServer, url?: string) {
  let release: () => void;
  const releasePromise = new Promise<void>(r => release = r);
  let route: () => void;
  const routePromise = new Promise<void>(r => route = r);
  const messages = [];
  server.setRoute(url ?? '/empty.html', async (req, res) => {
    messages.push('route');
    route();
    await releasePromise;
    res.setHeader('Content-Type', 'text/html');
    res.end(`<button onclick="window.__clicked=true">click me</button>`);
  });
  return { messages, release, routed: routePromise };
}

it('should await navigation before clicking anchor', async ({ page, server }) => {
  const { messages, release, routed } = initStallingServer(server);
  await page.setContent(`<a href="${server.EMPTY_PAGE}">empty.html</a>`);

  await page.click('a');
  await routed;
  expect(messages.join('|')).toBe('route');

  const click2 = page.click('button').then(() => messages.push('click2'));
  await page.waitForTimeout(1000);
  expect(messages.join('|')).toBe('route');

  release();
  await click2;
  expect(messages.join('|')).toBe('route|click2');
});

it('should not stall on JS navigation link', async ({ page, browserName }) => {
  await page.setContent(`<a href="javascript:console.log(1)">console.log</a>`);
  await page.click('a');
});

it('should await cross-process navigation before clicking anchor', async ({ page, server }) => {
  const { messages, release, routed } = initStallingServer(server);
  await page.setContent(`<a href="${server.CROSS_PROCESS_PREFIX + '/empty.html'}">empty.html</a>`);

  await page.click('a');
  await routed;
  expect(messages.join('|')).toBe('route');

  const click2 = page.click('button').then(() => messages.push('click2'));
  await page.waitForTimeout(1000);
  expect(messages.join('|')).toBe('route');

  release();
  await click2;
  expect(messages.join('|')).toBe('route|click2');
});

it('should await form-get navigation before click', async ({ page, server }) => {
  const { messages, release, routed } = initStallingServer(server, '/empty.html?foo=bar');
  await page.setContent(`
    <form action="${server.EMPTY_PAGE}" method="get">
      <input name="foo" value="bar">
      <input type="submit" value="Submit">
    </form>`);

  await page.click('input[type=submit]');
  await routed;
  expect(messages.join('|')).toBe('route');

  const click2 = page.click('button').then(() => messages.push('click2'));
  await page.waitForTimeout(1000);
  expect(messages.join('|')).toBe('route');

  release();
  await click2;
  expect(messages.join('|')).toBe('route|click2');
});

it('should await form-post navigation before click', async ({ page, server }) => {
  const { messages, release, routed } = initStallingServer(server);
  await page.setContent(`
    <form action="${server.EMPTY_PAGE}" method="post">
      <input name="foo" value="bar">
      <input type="submit" value="Submit">
    </form>`);

  await page.click('input[type=submit]');
  await routed;
  expect(messages.join('|')).toBe('route');

  const click2 = page.click('button').then(() => messages.push('click2'));
  await page.waitForTimeout(1000);
  expect(messages.join('|')).toBe('route');

  release();
  await click2;
  expect(messages.join('|')).toBe('route|click2');
});

it('should work without noWaitAfter when navigation is stalled', async ({ page, server }) => {
  server.setRoute('/empty.html', async () => {});
  await page.setContent(`<a id="anchor" href="${server.EMPTY_PAGE}">empty.html</a>`);
  await page.click('a');
});

it('should work with dblclick without noWaitAfter when navigation is stalled', async ({ page, server }) => {
  server.setRoute('/empty.html', async () => {});
  await page.setContent(`<a id="anchor" href="${server.EMPTY_PAGE}">empty.html</a>`);
  await page.dblclick('a');
});

it('should work with goto following click', async ({ page, server }) => {
  server.setRoute('/login.html', async (req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.end(`You are logged in`);
  });

  await page.setContent(`
    <form action="${server.PREFIX}/login.html" method="get">
      <input type="text">
      <input type="submit" value="Submit">
    </form>`);

  await page.fill('input[type=text]', 'admin');
  await page.click('input[type=submit]');
  await page.goto(server.EMPTY_PAGE);
});

it('should report and collapse log in action', async ({ page, server, mode }) => {
  await page.setContent(`<input id='checkbox' type='checkbox' style="visibility: hidden"></input>`);
  const error = await page.locator('input').click({ timeout: 5000 }).catch(e => e);
  const message = stripAnsi(error.message);
  expect(message).toContain(`Call log:`);
  expect(message).toMatch(/\d+ × waiting for/);
  const logLines = message.substring(message.indexOf('Call log:')).split('\n');
  expect(logLines.length).toBeLessThan(30);
});

it('should report and collapse log in expect', async ({ page, server, mode }) => {
  await page.setContent(`<input id='checkbox' type='checkbox' style="visibility: hidden"></input>`);
  const error = await expect(page.locator('input')).toBeVisible({ timeout: 5000 }).catch(e => e);
  const message = stripAnsi(error.message);
  expect(message).toContain(`Call log:`);
  expect(message).toMatch(/\d+ × locator resolved to/);
});
