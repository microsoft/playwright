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

import { expect, playwrightTest } from '../config/browserTest';
import type { Browser, BrowserContext, BrowserServer, ConnectOptions, Page } from 'playwright-core';

type ExtraFixtures = {
  remoteServer: BrowserServer;
  connect: (wsEndpoint: string, options?: ConnectOptions) => Promise<Browser>,
};
const test = playwrightTest.extend<ExtraFixtures>({
  remoteServer: async ({ browserType }, use) => {
    const server = await browserType.launchServer({ _sharedBrowser: true } as any);
    await use(server);
    await server.close();
  },
  connect: async ({ browserType }, use) => {
    let browser: Browser | undefined;
    await use(async (wsEndpoint, options = {}) => {
      browser = await browserType.connect(wsEndpoint, options);
      return browser;
    });
    await browser?.close();
  },
});

test.slow(true, 'All connect tests are slow');
test.skip(({ mode }) => mode.startsWith('service'));

test('should connect two clients', async ({ connect, remoteServer, server }) => {
  const browserA = await connect(remoteServer.wsEndpoint());
  expect(browserA.contexts().length).toBe(0);
  const contextA1 = await browserA.newContext();
  const pageA1 = await contextA1.newPage();
  await pageA1.goto(server.EMPTY_PAGE);

  const browserB = await connect(remoteServer.wsEndpoint());
  expect(browserB.contexts().length).toBe(1);
  const contextB1 = browserB.contexts()[0];
  expect(contextB1.pages().length).toBe(1);
  const pageB1 = contextB1.pages()[0];
  await expect(pageB1).toHaveURL(server.EMPTY_PAGE);

  const contextEventPromise = new Promise<BrowserContext>(f => browserA.on('context', f));
  const contextB2 = await browserB.newContext({ baseURL: server.PREFIX });
  expect(browserB.contexts()).toEqual([contextB1, contextB2]);
  const contextA2 = await contextEventPromise;
  expect(browserA.contexts()).toEqual([contextA1, contextA2]);

  const pageEventPromise = new Promise<Page>(f => contextB2.on('page', f));
  const pageA2 = await contextA2.newPage();
  const pageB2 = await pageEventPromise;
  await pageA2.goto('/frames/frame.html');
  await expect(pageB2).toHaveURL('/frames/frame.html');
});
