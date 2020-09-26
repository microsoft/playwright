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

import { it, expect, describe } from './fixtures';

describe('lauch server', (suite, { wire }) => {
  suite.skip(wire);
}, () => {
  it('should work', async ({browserType, defaultBrowserOptions}) => {
    const browserServer = await browserType.launchServer(defaultBrowserOptions);
    expect(browserServer.wsEndpoint()).not.toBe(null);
    await browserServer.close();
  });

  it('should work with port', async ({browserType, defaultBrowserOptions, testWorkerIndex}) => {
    const browserServer = await browserType.launchServer({ ...defaultBrowserOptions, port: 8800 + testWorkerIndex });
    expect(browserServer.wsEndpoint()).toContain(String(8800 + testWorkerIndex));
    await browserServer.close();
  });

  it('should fire "close" event during kill', async ({browserType, defaultBrowserOptions}) => {
    const order = [];
    const browserServer = await browserType.launchServer(defaultBrowserOptions);
    const closedPromise = new Promise(f => browserServer.on('close', () => {
      order.push('closed');
      f();
    }));
    await Promise.all([
      browserServer.kill().then(() => order.push('killed')),
      closedPromise,
    ]);
    expect(order).toEqual(['closed', 'killed']);
  });

  it('should return child_process instance', async ({browserType, defaultBrowserOptions}) => {
    const browserServer = await browserType.launchServer(defaultBrowserOptions);
    expect(browserServer.process().pid).toBeGreaterThan(0);
    await browserServer.close();
  });

  it('should fire close event', async ({browserType, defaultBrowserOptions}) => {
    const browserServer = await browserType.launchServer(defaultBrowserOptions);
    const [result] = await Promise.all([
      // @ts-expect-error The signal parameter is not documented.
      new Promise(f => browserServer.on('close', (exitCode, signal) => f({ exitCode, signal }))),
      browserServer.close(),
    ]);
    expect(result['exitCode']).toBe(0);
    expect(result['signal']).toBe(null);
  });
});
