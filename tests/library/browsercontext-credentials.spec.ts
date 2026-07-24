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

import { browserTest as base, expect } from '../config/browserTest';

const it = base.extend<{ failsOn401: boolean }>({
  failsOn401: async ({ browserName, isHeadlessShell }, use) => {
    await use(browserName === 'chromium' && !isHeadlessShell);
  },
});

it('should fail without credentials', async ({ browser, server, failsOn401 }) => {
  server.setAuth('/empty.html', 'user', 'pass');
  const context = await browser.newContext();
  const page = await context.newPage();
  const responseOrError = await page.goto(server.EMPTY_PAGE).catch(e => e);
  if (failsOn401)
    expect(responseOrError.message).toContain('net::ERR_INVALID_AUTH_CREDENTIALS');
  else
    expect(responseOrError.status()).toBe(401);
});

it('should work with setHTTPCredentials', async ({ browser, server, failsOn401 }) => {
  server.setAuth('/empty.html', 'user', 'pass');
  const context = await browser.newContext();
  const page = await context.newPage();

  let responseOrError = await page.goto(server.EMPTY_PAGE).catch(e => e);
  if (failsOn401)
    expect(responseOrError.message).toContain('net::ERR_INVALID_AUTH_CREDENTIALS');
  else
    expect(responseOrError.status()).toBe(401);

  await context.setHTTPCredentials({ username: 'user', password: 'pass' });
  responseOrError = await page.reload();
  expect(responseOrError.status()).toBe(200);
  await context.close();
});

it('should work with setHTTPCredentials and multiple credentials', async ({ browser, server, browserName }) => {
  server.setAuth('/empty.html', 'user1', 'pass1');
  const context = await browser.newContext();
  const page = await context.newPage();
  await context.setHTTPCredentials([
    { username: 'user1', password: 'pass1', origin: server.PREFIX },
    { username: 'user2', password: 'pass2', origin: server.CROSS_PROCESS_PREFIX },
  ]);
  const response1 = await page.goto(server.EMPTY_PAGE);
  expect(response1!.status()).toBe(200);
  // Wrong credentials are picked for the other origin.
  const response2 = await page.goto(server.CROSS_PROCESS_PREFIX + '/empty.html');
  expect(response2!.status()).toBe(401);
  await context.close();
});

it('should work with correct credentials @smoke', async ({ browser, server }) => {
  server.setAuth('/empty.html', 'user', 'pass');
  const context = await browser.newContext({
    httpCredentials: { username: 'user', password: 'pass' }
  });
  const page = await context.newPage();
  const response = await page.goto(server.EMPTY_PAGE);
  expect(response!.status()).toBe(200);
  await context.close();
});

it('should fail with wrong credentials', async ({ browser, server }) => {
  server.setAuth('/empty.html', 'user', 'pass');
  const context = await browser.newContext({
    httpCredentials: { username: 'foo', password: 'bar' }
  });
  const page = await context.newPage();
  const response = await page.goto(server.EMPTY_PAGE);
  expect(response!.status()).toBe(401);
  await context.close();
});

it('should return resource body', async ({ browser, server }) => {
  server.setAuth('/playground.html', 'user', 'pass');
  const context = await browser.newContext({
    httpCredentials: { username: 'user', password: 'pass' }
  });
  const page = await context.newPage();
  const response = await page.goto(server.PREFIX + '/playground.html');
  expect(response!.status()).toBe(200);
  expect(await page.title()).toBe('Playground');
  expect((await response!.body()).toString()).toContain('Playground');
  await context.close();
});

it('should work with a single credential in an array', async ({ browser, server }) => {
  server.setAuth('/empty.html', 'user', 'pass');
  const context = await browser.newContext({
    httpCredentials: [{ username: 'user', password: 'pass' }]
  });
  const page = await context.newPage();
  const response = await page.goto(server.EMPTY_PAGE);
  expect(response!.status()).toBe(200);
  await context.close();
});

it('should work with multiple credentials for different origins', async ({ browser, server, browserName }) => {
  server.setAuth('/empty.html', 'user1', 'pass1');
  const context = await browser.newContext({
    httpCredentials: [
      { username: 'user1', password: 'pass1', origin: server.PREFIX },
      { username: 'user2', password: 'pass2', origin: server.CROSS_PROCESS_PREFIX },
    ]
  });
  const page = await context.newPage();
  const response1 = await page.goto(server.EMPTY_PAGE);
  expect(response1!.status()).toBe(200);
  // Wrong credentials are picked for the other origin.
  const response2 = await page.goto(server.CROSS_PROCESS_PREFIX + '/empty.html');
  expect(response2!.status()).toBe(401);
  await context.close();
});

it('should fall back to credentials without origin', async ({ browser, server, browserName }) => {
  server.setAuth('/empty.html', 'user', 'pass');
  const context = await browser.newContext({
    httpCredentials: [
      { username: 'user2', password: 'pass2', origin: server.CROSS_PROCESS_PREFIX },
      { username: 'user', password: 'pass' },
    ]
  });
  const page = await context.newPage();
  const response1 = await page.goto(server.EMPTY_PAGE);
  expect(response1!.status()).toBe(200);
  // First matching entry has wrong credentials for this origin.
  const response2 = await page.goto(server.CROSS_PROCESS_PREFIX + '/empty.html');
  expect(response2!.status()).toBe(401);
  await context.close();
});

it('should use the first matching credential', async ({ browser, server, browserName }) => {
  server.setAuth('/empty.html', 'user', 'pass');
  const context = await browser.newContext({
    httpCredentials: [
      { username: 'wrong', password: 'wrong' },
      { username: 'user', password: 'pass', origin: server.PREFIX },
    ]
  });
  const page = await context.newPage();
  const response = await page.goto(server.EMPTY_PAGE);
  expect(response!.status()).toBe(401);
  await context.close();
});

it('should work with correct credentials and matching origin', async ({ browser, server }) => {
  server.setAuth('/empty.html', 'user', 'pass');
  const context = await browser.newContext({
    httpCredentials: { username: 'user', password: 'pass', origin: server.PREFIX }
  });
  const page = await context.newPage();
  const response = await page.goto(server.EMPTY_PAGE);
  expect(response!.status()).toBe(200);
  await context.close();
});

it('should work with correct credentials and matching origin case insensitive', async ({ browser, server }) => {
  server.setAuth('/empty.html', 'user', 'pass');
  const context = await browser.newContext({
    httpCredentials: { username: 'user', password: 'pass', origin: server.PREFIX.toUpperCase() }
  });
  const page = await context.newPage();
  const response = await page.goto(server.EMPTY_PAGE);
  expect(response!.status()).toBe(200);
  await context.close();
});

it('should fail with correct credentials and mismatching scheme', async ({ browser, server, failsOn401 }) => {
  server.setAuth('/empty.html', 'user', 'pass');
  const context = await browser.newContext({
    httpCredentials: { username: 'user', password: 'pass', origin: server.PREFIX.replace('http://', 'https://') }
  });
  const page = await context.newPage();
  const responseOrError = await page.goto(server.EMPTY_PAGE).catch(e => e);
  if (failsOn401)
    expect(responseOrError.message).toContain('net::ERR_INVALID_AUTH_CREDENTIALS');
  else
    expect(responseOrError.status()).toBe(401);
  await context.close();
});

it('should fail with correct credentials and mismatching hostname', async ({ browser, server, failsOn401 }) => {
  server.setAuth('/empty.html', 'user', 'pass');
  const hostname = new URL(server.PREFIX).hostname;
  const origin = server.PREFIX.replace(hostname, 'mismatching-hostname');
  const context = await browser.newContext({
    httpCredentials: { username: 'user', password: 'pass', origin: origin }
  });
  const page = await context.newPage();
  const responseOrError = await page.goto(server.EMPTY_PAGE).catch(e => e);
  if (failsOn401)
    expect(responseOrError.message).toContain('net::ERR_INVALID_AUTH_CREDENTIALS');
  else
    expect(responseOrError.status()).toBe(401);
  await context.close();
});

it('should fail with correct credentials and mismatching port', async ({ browser, server, failsOn401 }) => {
  server.setAuth('/empty.html', 'user', 'pass');
  const origin = server.PREFIX.replace(server.PORT.toString(), (server.PORT + 1).toString());
  const context = await browser.newContext({
    httpCredentials: { username: 'user', password: 'pass', origin: origin }
  });
  const page = await context.newPage();
  const responseOrError = await page.goto(server.EMPTY_PAGE).catch(e => e);
  if (failsOn401)
    expect(responseOrError.message).toContain('net::ERR_INVALID_AUTH_CREDENTIALS');
  else
    expect(responseOrError.status()).toBe(401);
  await context.close();
});
