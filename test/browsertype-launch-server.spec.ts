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
import http from 'http';

describe('launch server', (suite, { wire }) => {
  suite.skip(wire);
}, () => {
  it('should work', async ({browserType, browserOptions}) => {
    const browserServer = await browserType.launchServer(browserOptions);
    expect(browserServer.wsEndpoint()).not.toBe(null);
    await browserServer.close();
  });

  it('should work with port', async ({browserType, browserOptions, testWorkerIndex}) => {
    const browserServer = await browserType.launchServer({ ...browserOptions, port: 8800 + testWorkerIndex });
    expect(browserServer.wsEndpoint()).toContain(String(8800 + testWorkerIndex));
    await browserServer.close();
  });

  it('should fire "close" event during kill', async ({browserType, browserOptions}) => {
    const order = [];
    const browserServer = await browserType.launchServer(browserOptions);
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

  it('should return child_process instance', async ({browserType, browserOptions}) => {
    const browserServer = await browserType.launchServer(browserOptions);
    expect(browserServer.process().pid).toBeGreaterThan(0);
    await browserServer.close();
  });

  it('should fire close event', async ({browserType, browserOptions}) => {
    const browserServer = await browserType.launchServer(browserOptions);
    const [result] = await Promise.all([
      // @ts-expect-error The signal parameter is not documented.
      new Promise(f => browserServer.on('close', (exitCode, signal) => f({ exitCode, signal }))),
      browserServer.close(),
    ]);
    expect(result['exitCode']).toBe(0);
    expect(result['signal']).toBe(null);
  });

  it('should add user-agent to websocket request', async ({ browserType, server}) => {
    const getUserAgent = () => new Promise(async resolve => {
      server.setRoute('/websocket', async (req, res) => {
        resolve(req.headers['user-agent']);
      });
      browserType.launchServer({
        cdpWebsocketEndpoint: server.PREFIX + '/websocket'
      });
    });
    const ua = await getUserAgent();
    expect(ua).toContain('playwright/');
  });

  it('should allow using an existing cdp endpoint', async ({ testWorkerIndex, browserType, server}) => {
    const fetchUrl = (url: string): Promise<string> => new Promise((resolve, reject) => {
      http.get(url, resp => {
        let data = '';
        resp.on('data', chunk => { data += chunk; });
        resp.on('end', () => { resolve(data); });
      }).on('error', (err: Error) => { reject(err); });
    });
    const debuggingPort = 8100 + testWorkerIndex;
    await browserType.launchServer({
      args: [`--remote-debugging-port=${debuggingPort}`]
    });
    const version = await fetchUrl(`http://localhost:${debuggingPort}/json/version`);
    const cdpWebsocketEndpoint = JSON.parse(version).webSocketDebuggerUrl;
    const browserServer = await browserType.launchServer({ cdpWebsocketEndpoint });
    const wsEndpoint = browserServer.wsEndpoint();
    const browser = await browserType.connect({ wsEndpoint });
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(server.EMPTY_PAGE);
    expect(page.url()).toContain('empty.html');
    const answer = await page.evaluate(() => 6 * 7);
    expect(answer).toBe(42);
  });
});
