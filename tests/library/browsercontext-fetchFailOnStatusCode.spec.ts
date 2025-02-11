/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
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

import { browserTest as it, expect } from '../config/browserTest';

it('should throw when apiRequestFailsOnErrorStatus is set to true inside BrowserContext options', async ({ browser, server }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/34204' });
  const context = await browser.newContext({ apiRequestFailsOnErrorStatus: true });
  server.setRoute('/empty.html', (req, res) => {
    res.writeHead(404, { 'Content-Length': 10, 'Content-Type': 'text/plain' });
    res.end('Not found.');
  });
  const error = await context.request.fetch(server.EMPTY_PAGE).catch(e => e);
  expect(error.message).toContain('404 Not Found');
  await context.close();
});

it('should not throw when failOnStatusCode is set to false inside BrowserContext options', async ({ browser, server }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/34204' });
  const context = await browser.newContext({ apiRequestFailsOnErrorStatus: false });
  server.setRoute('/empty.html', (req, res) => {
    res.writeHead(404, { 'Content-Length': 10, 'Content-Type': 'text/plain' });
    res.end('Not found.');
  });
  const error = await context.request.fetch(server.EMPTY_PAGE).catch(e => e);
  expect(error.message).toBeUndefined();
  await context.close();
});

it('should throw when apiRequestFailsOnErrorStatus is set to true inside browserType.launchPersistentContext options', async ({ browserType, server, createUserDataDir }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/34204' });
  const userDataDir = await createUserDataDir();
  const context = await browserType.launchPersistentContext(userDataDir, { apiRequestFailsOnErrorStatus: true });
  server.setRoute('/empty.html', (req, res) => {
    res.writeHead(404, { 'Content-Length': 10, 'Content-Type': 'text/plain' });
    res.end('Not found.');
  });
  const error = await context.request.fetch(server.EMPTY_PAGE).catch(e => e);
  expect(error.message).toContain('404 Not Found');
  await context.close();
});

it('should not throw when apiRequestFailsOnErrorStatus is set to false inside browserType.launchPersistentContext options', async ({ browserType, server, createUserDataDir }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/34204' });
  const userDataDir = await createUserDataDir();
  const context = await browserType.launchPersistentContext(userDataDir, { apiRequestFailsOnErrorStatus: false });
  server.setRoute('/empty.html', (req, res) => {
    res.writeHead(404, { 'Content-Length': 10, 'Content-Type': 'text/plain' });
    res.end('Not found.');
  });
  const error = await context.request.fetch(server.EMPTY_PAGE).catch(e => e);
  expect(error.message).toBeUndefined();
  await context.close();
});
