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

const {FFOX, CHROMIUM, WEBKIT} = require('./utils').testOptions(browserType);

describe('BrowserContext', function() {
  it('should work across sessions', async ({browserType, defaultBrowserOptions}) => {
    const browserServer = await browserType.launchServer(defaultBrowserOptions);
    const browser1 = await browserType.connect({ wsEndpoint: browserServer.wsEndpoint() });
    expect(browser1.contexts().length).toBe(0);
    await browser1.newContext();
    expect(browser1.contexts().length).toBe(1);

    const browser2 = await browserType.connect({ wsEndpoint: browserServer.wsEndpoint() });
    expect(browser2.contexts().length).toBe(0);
    await browser2.newContext();
    expect(browser2.contexts().length).toBe(1);

    expect(browser1.contexts().length).toBe(1);

    await browser1.close();
    await browser2.close();

    await browserServer._checkLeaks();
    await browserServer.close();
  });
});

describe('Browser.Events.disconnected', function() {
  it.slow()('should be emitted when: browser gets closed, disconnected or underlying websocket gets closed', async ({browserType, defaultBrowserOptions}) => {
    const browserServer = await browserType.launchServer(defaultBrowserOptions);
    const originalBrowser = await browserType.connect({ wsEndpoint: browserServer.wsEndpoint() });
    const wsEndpoint = browserServer.wsEndpoint();
    const remoteBrowser1 = await browserType.connect({ wsEndpoint });
    const remoteBrowser2 = await browserType.connect({ wsEndpoint });

    let disconnectedOriginal = 0;
    let disconnectedRemote1 = 0;
    let disconnectedRemote2 = 0;
    originalBrowser.on('disconnected', () => ++disconnectedOriginal);
    remoteBrowser1.on('disconnected', () => ++disconnectedRemote1);
    remoteBrowser2.on('disconnected', () => ++disconnectedRemote2);

    await Promise.all([
      new Promise(f => remoteBrowser2.on('disconnected', f)),
      remoteBrowser2.close(),
    ]);

    expect(disconnectedOriginal).toBe(0);
    expect(disconnectedRemote1).toBe(0);
    expect(disconnectedRemote2).toBe(1);

    await Promise.all([
      new Promise(f => remoteBrowser1.on('disconnected', f)),
      new Promise(f => originalBrowser.on('disconnected', f)),
      browserServer.close(),
    ]);

    expect(disconnectedOriginal).toBe(1);
    expect(disconnectedRemote1).toBe(1);
    expect(disconnectedRemote2).toBe(1);
  });
});

describe('browserType.connect', function() {
  it('should be able to connect multiple times to the same browser', async({browserType, defaultBrowserOptions}) => {
    const browserServer = await browserType.launchServer(defaultBrowserOptions);
    const browser1 = await browserType.connect({ wsEndpoint: browserServer.wsEndpoint() });
    const browser2 = await browserType.connect({ wsEndpoint: browserServer.wsEndpoint() });
    const page1 = await browser1.newPage();
    expect(await page1.evaluate(() => 7 * 8)).toBe(56);
    browser1.close();

    const page2 = await browser2.newPage();
    expect(await page2.evaluate(() => 7 * 6)).toBe(42, 'original browser should still work');
    await browser2.close();
    await browserServer._checkLeaks();
    await browserServer.close();
  });
  it('should not be able to close remote browser', async({browserType, defaultBrowserOptions}) => {
    const browserServer = await browserType.launchServer(defaultBrowserOptions);
    {
      const remote = await browserType.connect({ wsEndpoint: browserServer.wsEndpoint() });
      await remote.newContext();
      await remote.close();
    }
    {
      const remote = await browserType.connect({ wsEndpoint: browserServer.wsEndpoint() });
      await remote.newContext();
      await remote.close();
    }
    await browserServer._checkLeaks();
    await browserServer.close();
  });
});
