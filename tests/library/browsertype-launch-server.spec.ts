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

import { playwrightTest as it, expect } from '../config/browserTest';

it.describe('launch server', () => {
  it.skip(({ mode }) => mode !== 'default');

  it('should work', async ({ browserType }) => {
    const browserServer = await browserType.launchServer();
    expect(browserServer.wsEndpoint()).not.toBe(null);
    await browserServer.close();
  });

  it('should work with host', async ({ browserType }) => {
    const host = '0.0.0.0';
    const browserServer = await browserType.launchServer({ host });
    expect(browserServer.wsEndpoint()).toContain(String(host));
    await browserServer.close();
  });

  it('should work with port', async ({ browserType }, testInfo) => {
    const port = 8800 + testInfo.workerIndex;
    const browserServer = await browserType.launchServer({ port });
    expect(browserServer.wsEndpoint()).toContain(String(port));
    await browserServer.close();
  });

  it('should work with wsPath', async ({ browserType }) => {
    const wsPath = '/unguessable-token';
    const browserServer = await browserType.launchServer({ wsPath });
    expect(browserServer.wsEndpoint()).toMatch(/:\d+\/unguessable-token$/);
    await browserServer.close();
  });

  it('should work when wsPath is missing leading slash', async ({ browserType }) => {
    const wsPath = 'unguessable-token';
    const browserServer = await browserType.launchServer({ wsPath });
    expect(browserServer.wsEndpoint()).toMatch(/:\d+\/unguessable-token$/);
    await browserServer.close();
  });

  it('should default to random wsPath', async ({ browserType }) => {
    const browserServer = await browserType.launchServer();
    expect(browserServer.wsEndpoint()).toMatch(/:\d+\/[a-f\d]{32}$/);
    await browserServer.close();
  });

  it('should provide an error when ws endpoint is incorrect', async ({ browserType }) => {
    const browserServer = await browserType.launchServer();
    const error = await browserType.connect({ wsEndpoint: browserServer.wsEndpoint() + '-foo' }).catch(e => e);
    await browserServer.close();
    expect(error.message).toContain('400 Bad Request');
  });

  it('should fire "close" event during kill', async ({ browserType }) => {
    const order = [];
    const browserServer = await browserType.launchServer();
    const closedPromise = new Promise<void>(f => browserServer.on('close', () => {
      order.push('closed');
      f();
    }));
    await Promise.all([
      browserServer.kill().then(() => order.push('killed')),
      closedPromise,
    ]);
    expect(order).toEqual(['closed', 'killed']);
  });

  it('should return child_process instance', async ({ browserType }) => {
    const browserServer = await browserType.launchServer();
    expect(browserServer.process().pid).toBeGreaterThan(0);
    await browserServer.close();
  });

  it('should fire close event', async ({ browserType }) => {
    const browserServer = await browserType.launchServer();
    const [result] = await Promise.all([
      // @ts-expect-error The signal parameter is not documented.
      new Promise(f => browserServer.on('close', (exitCode, signal) => f({ exitCode, signal }))),
      browserServer.close(),
    ]);
    expect(result['exitCode']).toBe(0);
    expect(result['signal']).toBe(null);
  });

  it('should log protocol', async ({ browserType }) => {
    const logs: string[] = [];
    const logger = {
      isEnabled(name: string) {
        return true;
      },
      log(name: string, severity: string, message: string) {
        logs.push(`${name}:${severity}:${message}`);
      }
    };

    const browserServer = await browserType.launchServer({ logger });
    await browserServer.close();

    expect(logs.some(log => log.startsWith('protocol:verbose:SEND ►'))).toBe(true);
    expect(logs.some(log => log.startsWith('protocol:verbose:◀ RECV'))).toBe(true);
  });
});
