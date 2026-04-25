/**
 * Copyright (c) Microsoft Corporation.
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

import fs from 'fs';
import path from 'path';

import { browserTest as it, expect } from '../config/browserTest';

it.skip(({ mode }) => mode !== 'default');

it.beforeEach(({}, testInfo) => {
  process.env.PLAYWRIGHT_SERVER_REGISTRY = testInfo.outputPath('registry');
});

it('should start and stop pipe server', async ({ browserType, browser }) => {
  const serverInfo = await browser.bind('default', {});
  expect(serverInfo).toEqual(expect.objectContaining({
    endpoint: expect.stringMatching(/browser@/),
  }));

  const browser2 = await browserType.connect(serverInfo.endpoint);
  const page = await browser2.newPage();
  await page.goto('data:text/html,<h1>Hello via pipe</h1>');
  expect(await page.locator('h1').textContent()).toBe('Hello via pipe');
  await page.close();
  await browser2.close();
  await browser.unbind();
});

it('should write descriptor on start and remove on stop', async ({ browser }) => {
  const serverInfo = await browser.bind('my-title', { wsPath: 'test' } as any);

  const registryDir = it.info().outputPath('registry');
  const fileName = fs.readdirSync(registryDir)[0];
  const file = path.join(registryDir, fileName);

  const descriptor = JSON.parse(fs.readFileSync(file, 'utf-8'));
  expect(descriptor.title).toBe('my-title');
  expect(descriptor.playwrightVersion).toBeTruthy();
  expect(descriptor.playwrightLib).toBeTruthy();
  expect(descriptor.browser.browserName).toBeTruthy();
  expect(descriptor.endpoint).toBe(serverInfo.endpoint);

  if (process.platform !== 'win32')
    expect(fs.existsSync(serverInfo.endpoint)).toBe(true);

  await browser.unbind();
  expect(fs.existsSync(file)).toBe(false);
  if (process.platform !== 'win32')
    expect(fs.existsSync(serverInfo.endpoint)).toBe(false);
});

it('should start ws server with host/port and produce well-formed endpoint', async ({ browserType, browser }) => {
  const serverInfo = await browser.bind('default', { host: 'localhost', port: 0 });
  expect(serverInfo.endpoint).toMatch(/^ws:\/\/localhost:\d+\/[a-f0-9]+$/);

  const browser2 = await browserType.connect(serverInfo.endpoint);
  const page = await browser2.newPage();
  await page.goto('data:text/html,<h1>Hello via ws</h1>');
  expect(await page.locator('h1').textContent()).toBe('Hello via ws');
  await page.close();
  await browser2.close();
  await browser.unbind();
});
