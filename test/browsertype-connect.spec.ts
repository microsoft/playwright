/**
 * Copyright 2017 Google Inc. All rights reserved.
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

import { options } from './playwright.fixtures';
import utils from './utils';
import './remoteServer.fixture';

it.skip(options.WIRE).slow()('should be able to reconnect to a browser', async({browserType, defaultBrowserOptions, server}) => {
  const browserServer = await browserType.launchServer(defaultBrowserOptions);
  {
    const browser = await browserType.connect({ wsEndpoint: browserServer.wsEndpoint() });
    const browserContext = await browser.newContext();
    const page = await browserContext.newPage();
    await page.goto(server.EMPTY_PAGE);
    await browser.close();
  }
  {
    const browser = await browserType.connect({ wsEndpoint: browserServer.wsEndpoint() });
    const browserContext = await browser.newContext();
    const page = await browserContext.newPage();
    await page.goto(server.EMPTY_PAGE);
    await browser.close();
  }
  await browserServer.close();
});

it.skip(options.WIRE)('should connect to a remote server', async({ browserType, remoteServer }) => {
  const browser = await browserType.connect({ wsEndpoint: remoteServer.wsEndpoint() });
  const page = await browser.newPage();
  expect(await page.evaluate('2 + 3')).toBe(5);
  await browser.close();
});

it.skip(options.WIRE).fail(options.CHROMIUM && WIN).slow()('should handle exceptions during connect', async({browserType, defaultBrowserOptions}) => {
  const browserServer = await browserType.launchServer(defaultBrowserOptions);
  const __testHookBeforeCreateBrowser = () => { throw new Error('Dummy') };
  const error = await browserType.connect({ wsEndpoint: browserServer.wsEndpoint(), __testHookBeforeCreateBrowser } as any).catch(e => e);
  await browserServer.close();
  expect(error.message).toContain('Dummy');
});

it.skip(options.WIRE)('should set the browser connected state', async ({browserType, defaultBrowserOptions}) => {
  const browserServer = await browserType.launchServer(defaultBrowserOptions);
  const remote = await browserType.connect({ wsEndpoint: browserServer.wsEndpoint() });
  expect(remote.isConnected()).toBe(true);
  await remote.close();
  expect(remote.isConnected()).toBe(false);
  await browserServer.close();
});

it.skip(options.WIRE)('should throw when used after isConnected returns false', async({browserType, defaultBrowserOptions}) => {
  const browserServer = await browserType.launchServer(defaultBrowserOptions);
  const remote = await browserType.connect({ wsEndpoint: browserServer.wsEndpoint() });
  const page = await remote.newPage();
  await Promise.all([
    browserServer.close(),
    new Promise(f => remote.once('disconnected', f)),
  ]);
  expect(remote.isConnected()).toBe(false);
  const error = await page.evaluate('1 + 1').catch(e => e) as Error;
  expect(error.message).toContain('has been closed');
});

it.skip(options.WIRE)('should respect selectors', async({playwright, browserType, defaultBrowserOptions}) => {
  const mycss = () => ({
    create(root, target) {},
    query(root, selector) {
      return root.querySelector(selector);
    },
    queryAll(root: HTMLElement, selector: string) {
      return Array.from(root.querySelectorAll(selector));
    }
  });
  await utils.registerEngine(playwright, 'mycss', mycss);

  const browserServer = await browserType.launchServer(defaultBrowserOptions);
  const browser = await browserType.connect({ wsEndpoint: browserServer.wsEndpoint() });
  const page = await browser.newPage();
  await page.setContent(`<div>hello</div>`);
  expect(await page.innerHTML('css=div')).toBe('hello');
  expect(await page.innerHTML('mycss=div')).toBe('hello');
  await browserServer.close();
});

it.skip(options.WIRE).fail(true)('should respect selectors when connected remotely', async({ playwright, browserType, remoteServer }) => {
  const mycss = () => ({
    create(root, target) {},
    query(root, selector) {
      return root.querySelector(selector);
    },
    queryAll(root: HTMLElement, selector: string) {
      return Array.from(root.querySelectorAll(selector));
    }
  });
  await utils.registerEngine(playwright, 'mycss', mycss);

  const browser = await browserType.connect({ wsEndpoint: remoteServer.wsEndpoint() });
  const page = await browser.newPage();
  await page.setContent(`<div>hello</div>`);
  expect(await page.innerHTML('css=div')).toBe('hello');
  expect(await page.innerHTML('mycss=div')).toBe('hello');
  await browser.close();
});
