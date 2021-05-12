/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import http from 'http';

import { contextTest as it, expect } from './config/browserTest';
import type { LaunchOptions, ConnectOptions } from '../index';

it.describe.only('forwarding proxy', () => {
  it.skip(({ mode}) => mode !== 'default');

  let targetTestServer: http.Server;
  let port!: number;
  it.beforeAll(async (_, test) => {
    port = 30_000 + test.workerIndex * 4;
    targetTestServer = http.createServer((req: http.IncomingMessage, res: http.ServerResponse) => {
      res.end('<html><body>from-retargeted-server</body></html>');
    }).listen(port);
  });

  it.beforeEach(() => {
    delete process.env.PW_TEST_PROXY_TARGET;
  });

  it.afterAll(() => {
    targetTestServer.close();
  });

  it('should proxy local requests', async ({browserType, browserOptions, server}, workerInfo) => {
    process.env.PW_TEST_PROXY_TARGET = port.toString();
    let reachedOriginalTarget = false;
    server.setRoute('/foo.html', async (req, res) => {
      reachedOriginalTarget = true;
      res.end('<html><body></body></html>');
    });
    const examplePort = 20_000 + workerInfo.workerIndex * 3;
    const browserServer = await browserType.launchServer({
      ...browserOptions,
      _acceptForwardedPorts: true
    } as LaunchOptions);
    const browser = await browserType.connect({
      wsEndpoint: browserServer.wsEndpoint(),
      _forwardPorts: [examplePort]
    } as ConnectOptions);
    const page = await browser.newPage();
    await page.goto(`http://localhost:${examplePort}/foo.html`);
    expect(await page.content()).toContain('from-retargeted-server');
    expect(reachedOriginalTarget).toBe(false);
    await browserServer.close();
  });

  it('should lead to a request failure if the proxied target will timeout', async ({browserType, browserOptions}, workerInfo) => {
    process.env.PW_TEST_PROXY_TARGET = '50001';
    const browserServer = await browserType.launchServer({
      ...browserOptions,
      _acceptForwardedPorts: true
    } as LaunchOptions);
    const examplePort = 20_000 + workerInfo.workerIndex * 3;
    const browser = await browserType.connect({
      wsEndpoint: browserServer.wsEndpoint(),
      _forwardPorts: [examplePort]
    } as ConnectOptions);
    const page = await browser.newPage();
    const failedRequests = [];
    page.on('requestfailed', request => failedRequests.push(request));
    await expect(page.goto(`http://localhost:${examplePort}`)).rejects.toThrowError();
    expect(failedRequests.length).toBe(1);
    expect(failedRequests[0].failure().errorText).toBeTruthy();
    await browserServer.close();
  });

  it('should not allow connecting a second client when _acceptForwardedPorts is used', async ({browserType, browserOptions}, workerInfo) => {
    const browserServer = await browserType.launchServer({
      ...browserOptions,
      _acceptForwardedPorts: true
    } as LaunchOptions);
    const examplePort = 20_000 + workerInfo.workerIndex * 3;

    const browser1 = await browserType.connect({
      wsEndpoint: browserServer.wsEndpoint(),
      _forwardPorts: [examplePort]
    } as ConnectOptions);
    await expect(browserType.connect({
      wsEndpoint: browserServer.wsEndpoint(),
      _forwardPorts: [examplePort]
    } as ConnectOptions)).rejects.toThrowError('browserType.connect: WebSocket server disconnected (1005)');
    await browser1.close();
    const browser2 = await browserType.connect({
      wsEndpoint: browserServer.wsEndpoint(),
      _forwardPorts: [examplePort]
    } as ConnectOptions);
    await browser2.close();

    await browserServer.close();
  });
});

