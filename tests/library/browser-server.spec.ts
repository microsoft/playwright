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
import { defaultRegistryDirectory } from '../../packages/playwright-core/lib/server/registry';

it.skip(({ mode }) => mode !== 'default');

function descriptorPath(browser: any) {
  return path.join(defaultRegistryDirectory, 'browsers', browser._guid);
}

it('should start and stop pipe server', async ({ browserType, browser }) => {
  const serverInfo = await (browser as any)._startServer('default', {});
  expect(serverInfo).toEqual(expect.objectContaining({
    pipeName: expect.stringMatching(/browser@.*\.sock/),
  }));

  const browser2 = await (browserType as any).connect(serverInfo);
  const page = await browser2.newPage();
  await page.goto('data:text/html,<h1>Hello via pipe</h1>');
  expect(await page.locator('h1').textContent()).toBe('Hello via pipe');
  await page.close();
  await browser2.close();
  await (browser as any)._stopServer();
});

it('should start and stop ws server', async ({ browserType, browser }) => {
  const serverInfo = await (browser as any)._startServer('default', { wsPath: 'test' });
  expect(serverInfo).toEqual(expect.objectContaining({
    pipeName: expect.stringMatching(/browser@.*\.sock/),
    wsEndpoint: expect.stringMatching(/^ws:\/\//),
  }));

  const browser2 = await browserType.connect(serverInfo.wsEndpoint);
  const page = await browser2.newPage();
  await page.goto('data:text/html,<h1>Hello</h1>');
  expect(await page.locator('h1').textContent()).toBe('Hello');
  await page.close();
  await browser2.close();
  await (browser as any)._stopServer();
});

it('should write descriptor on start and remove on stop', async ({ browser }) => {
  const file = descriptorPath(browser);
  expect(fs.existsSync(file)).toBe(false);

  const serverInfo = await (browser as any)._startServer('my-title', { wsPath: 'test' });

  const descriptor = JSON.parse(fs.readFileSync(file, 'utf-8'));
  expect(descriptor.title).toBe('my-title');
  expect(descriptor.version).toBeTruthy();
  expect(descriptor.browser.name).toBeTruthy();
  expect(descriptor.wsEndpoint).toBe(serverInfo.wsEndpoint);
  expect(descriptor.pipeName).toBe(serverInfo.pipeName);

  if (process.platform !== 'win32')
    expect(fs.existsSync(serverInfo.pipeName)).toBe(true);

  await (browser as any)._stopServer();
  expect(fs.existsSync(file)).toBe(false);
  if (process.platform !== 'win32')
    expect(fs.existsSync(serverInfo.pipeName)).toBe(false);
});
