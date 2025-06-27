/**
 * Copyright 2019 Google Inc. All rights reserved.
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

import { playwrightTest as it, expect } from '../../config/browserTest';

it('should throw with remote-debugging-pipe argument', async ({ browserType, mode }) => {
  it.skip(mode !== 'default');

  const options: any = {};
  options.args = ['--remote-debugging-pipe'].concat(options.args || []);
  const error = await browserType.launchServer(options).catch(e => e);
  expect(error.message).toContain('Playwright manages remote debugging connection itself');
});

it('should not throw with remote-debugging-port argument', async ({ browserType, mode }) => {
  it.skip(mode !== 'default');

  const options: any = {};
  options.args = ['--remote-debugging-port=0'].concat(options.args || []);
  const browser = await browserType.launchServer(options);
  await browser.close();
});

it('should open devtools when "devtools: true" option is given', async ({ browserType, mode, platform, channel }) => {
  it.skip(mode !== 'default' || platform === 'win32' || !!channel);

  let devtoolsCallback;
  const devtoolsPromise = new Promise(f => devtoolsCallback = f);
  const __testHookForDevTools = devtools => devtools.__testHookOnBinding = parsed => {
    if (parsed.method === 'getPreferences')
      devtoolsCallback();
  };
  const browser = await browserType.launch({ headless: false, devtools: true, __testHookForDevTools } as any);
  const context = await browser.newContext();
  await Promise.all([
    devtoolsPromise,
    context.newPage()
  ]);
  await browser.close();
});

it('should not create pages automatically', async ({ browserType }) => {
  const browser = await browserType.launch();
  const browserSession = await browser.newBrowserCDPSession();
  const targets = [];
  browserSession.on('Target.targetCreated', async ({ targetInfo }) => {
    if (targetInfo.type !== 'browser')
      targets.push(targetInfo);
  });
  await browserSession.send('Target.setDiscoverTargets', { discover: true });
  await browser.newContext();
  await browser.close();
  expect(targets.length).toBe(0);
});
