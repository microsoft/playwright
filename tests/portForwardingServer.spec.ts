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
import net from 'net';

import { contextTest as it, expect } from './config/browserTest';
import type { LaunchOptions, ConnectOptions } from '../index';

it.fixme(({platform, browserName}) => platform === 'darwin' && browserName === 'webkit');

it.beforeEach(() => {
  delete process.env.PW_TEST_PROXY_TARGET;
});

function startTestServer() {
  const server = http.createServer((req: http.IncomingMessage, res: http.ServerResponse) => {
    res.end('<html><body>from-retargeted-server</body></html>');
  }).listen(0);
  return {
    testServerPort: (server.address() as net.AddressInfo).port,
    stopTestServer: () => server.close()
  };
}

it('should forward non-forwarded requests', async ({ mode, browserType, browserOptions, server }, workerInfo) => {
  it.skip(mode !== 'default');
  let reachedOriginalTarget = false;
  server.setRoute('/foo.html', async (req, res) => {
    reachedOriginalTarget = true;
    res.end('<html><body>original-target</body></html>');
  });
  const browserServer = await browserType.launchServer({
    ...browserOptions,
    _acceptForwardedPorts: true
  } as LaunchOptions);
  const browser = await browserType.connect({
    wsEndpoint: browserServer.wsEndpoint(),
    _forwardPorts: []
  } as ConnectOptions);
  const page = await browser.newPage();
  await page.goto(server.PREFIX + '/foo.html');
  expect(await page.content()).toContain('original-target');
  expect(reachedOriginalTarget).toBe(true);
  await browserServer.close();
});

it('should proxy local requests', async ({ mode, browserType, browserOptions, server }, workerInfo) => {
  it.skip(mode !== 'default');
  const {testServerPort, stopTestServer} = startTestServer();
  process.env.PW_TEST_PROXY_TARGET = testServerPort.toString();
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
  stopTestServer();
});

it('should lead to the error page for forwarded requests when the connection is refused', async ({ mode, browserType, browserOptions, browserName, isWindows}, workerInfo) => {
  it.skip(mode !== 'default');
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
  const response = await page.goto(`http://localhost:${examplePort}`);
  expect(response.status()).toBe(502);
  await page.waitForSelector('text=Connection error');
  await browserServer.close();
});

it('should lead to the error page for non-forwarded requests when the connection is refused', async ({ mode, browserName, browserType, browserOptions, isWindows}, workerInfo) => {
  it.skip(mode !== 'default');
  process.env.PW_TEST_PROXY_TARGET = '50001';
  const browserServer = await browserType.launchServer({
    ...browserOptions,
    _acceptForwardedPorts: true
  } as LaunchOptions);
  const browser = await browserType.connect({
    wsEndpoint: browserServer.wsEndpoint(),
    _forwardPorts: []
  } as ConnectOptions);
  const page = await browser.newPage();
  const response = await page.goto(`http://localhost:44123/non-existing-url`);
  expect(response.status()).toBe(502);
  await page.waitForSelector('text=Connection error');

  await browserServer.close();
});

it('should not allow connecting a second client when _acceptForwardedPorts is used', async ({ mode, browserType, browserOptions }, workerInfo) => {
  it.skip(mode !== 'default');
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

it('should should not allow to connect when the server does not allow port-forwarding', async ({ mode, browserType, browserOptions }, workerInfo) => {
  it.skip(mode !== 'default');
  const browserServer = await browserType.launchServer({
    ...browserOptions,
    _acceptForwardedPorts: false
  } as LaunchOptions);

  await expect(browserType.connect({
    wsEndpoint: browserServer.wsEndpoint(),
    _forwardPorts: []
  } as ConnectOptions)).rejects.toThrowError('browserType.connect: Port forwarding needs to be enabled when launching the server via BrowserType.launchServer.');
  await expect(browserType.connect({
    wsEndpoint: browserServer.wsEndpoint(),
    _forwardPorts: [1234]
  } as ConnectOptions)).rejects.toThrowError('browserType.connect: Port forwarding needs to be enabled when launching the server via BrowserType.launchServer.');

  await browserServer.close();
});

it('should proxy local requests', async ({ getPlaywright, mode, browserName, server, browserOptions }, workerInfo) => {
  it.skip(mode !== 'service');
  let reachedOriginalTarget = false;
  server.setRoute('/foo.html', async (req, res) => {
    reachedOriginalTarget = true;
    res.end('<html><body></body></html>');
  });
  const {testServerPort, stopTestServer} = startTestServer();
  process.env.PW_TEST_PROXY_TARGET = testServerPort.toString();
  const examplePort = 20_000 + workerInfo.workerIndex * 3;
  const playwright = await getPlaywright({
    acceptForwardedPorts: true,
    forwardPorts: [examplePort],
  });
  const browser = await playwright[browserName].launch(browserOptions);
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${examplePort}/foo.html`);
  expect(await page.content()).toContain('from-retargeted-server');
  expect(reachedOriginalTarget).toBe(false);
  await browser.close();
  stopTestServer();
});