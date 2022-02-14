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

import childProcess from 'child_process';
import http from 'http';
import path from 'path';
import net from 'net';

import { contextTest, expect } from './config/browserTest';
import type { Page, Browser } from 'playwright-core';

class OutOfProcessPlaywrightServer {
  private _driverProcess: childProcess.ChildProcess;
  private _receivedPortPromise: Promise<string>;

  constructor(port: number, proxyPort: number) {
    this._driverProcess = childProcess.fork(path.join(__dirname, '..', 'packages', 'playwright-core', 'lib', 'cli', 'cli.js'), ['run-server', port.toString()], {
      stdio: 'pipe',
      detached: true,
      env: {
        ...process.env,
        PW_SOCKS_PROXY_PORT: '1'
      }
    });
    this._driverProcess.unref();
    this._receivedPortPromise = new Promise<string>((resolve, reject) => {
      this._driverProcess.stdout.on('data', (data: Buffer) => {
        const prefix = 'Listening on ';
        const line = data.toString();
        if (line.startsWith(prefix))
          resolve(line.substr(prefix.length));
      });
      this._driverProcess.stderr.on('data', (data: Buffer) => {
        console.log(data.toString());
      });
      this._driverProcess.on('exit', () => reject());
    });
  }
  async kill() {
    const waitForExit = new Promise<void>(resolve => this._driverProcess.on('exit', () => resolve()));
    this._driverProcess.kill('SIGKILL');
    await waitForExit;
  }
  public async wsEndpoint(): Promise<string> {
    return await this._receivedPortPromise;
  }
}

const it = contextTest.extend<{ pageFactory: (redirectPortForTest?: number) => Promise<Page> }>({
  pageFactory: async ({ browserType, browserName, channel }, run, testInfo) => {
    const playwrightServers: OutOfProcessPlaywrightServer[] = [];
    const browsers: Browser[] = [];
    await run(async (redirectPortForTest?: number): Promise<Page> => {
      const server = new OutOfProcessPlaywrightServer(0, 3200 + testInfo.workerIndex);
      playwrightServers.push(server);
      const browser = await browserType.connect({
        wsEndpoint: await server.wsEndpoint() + '?proxy=*&browser=' + (channel || browserName),
        __testHookRedirectPortForwarding: redirectPortForTest,
      } as any);
      browsers.push(browser);
      return await browser.newPage();
    });
    for (const playwrightServer of playwrightServers)
      await playwrightServer.kill();
    await Promise.all(browsers.map(async browser => {
      if (browser.isConnected())
        await new Promise(f => browser.once('disconnected', f));
    }));
  },
});

it.fixme(({ platform, browserName }) => browserName === 'webkit' && platform === 'win32');
it.skip(({ mode }) => mode !== 'default');

async function startTestServer() {
  const server = http.createServer((req: http.IncomingMessage, res: http.ServerResponse) => {
    res.end('<html><body>from-retargeted-server</body></html>');
  });
  await new Promise<void>(resolve => server.listen(0, resolve));
  return {
    testServerPort: (server.address() as net.AddressInfo).port,
    stopTestServer: () => server.close()
  };
}

it('should forward non-forwarded requests', async ({ pageFactory, server }) => {
  let reachedOriginalTarget = false;
  server.setRoute('/foo.html', async (req, res) => {
    reachedOriginalTarget = true;
    res.end('<html><body>original-target</body></html>');
  });
  const page = await pageFactory();
  await page.goto(server.PREFIX + '/foo.html');
  expect(await page.content()).toContain('original-target');
  expect(reachedOriginalTarget).toBe(true);
});

it('should proxy localhost requests #smoke', async ({ pageFactory, server, browserName, platform }, workerInfo) => {
  it.skip(browserName === 'webkit' && platform === 'darwin');
  const { testServerPort, stopTestServer } = await startTestServer();
  let reachedOriginalTarget = false;
  server.setRoute('/foo.html', async (req, res) => {
    reachedOriginalTarget = true;
    res.end('<html><body></body></html>');
  });
  const examplePort = 20_000 + workerInfo.workerIndex * 3;
  const page = await pageFactory(testServerPort);
  await page.goto(`http://localhost:${examplePort}/foo.html`);
  expect(await page.content()).toContain('from-retargeted-server');
  expect(reachedOriginalTarget).toBe(false);
  stopTestServer();
});

it('should proxy localhost requests from fetch api', async ({ pageFactory, server, browserName, platform }, workerInfo) => {
  it.skip(browserName === 'webkit' && platform === 'darwin');

  const { testServerPort, stopTestServer } = await startTestServer();
  let reachedOriginalTarget = false;
  server.setRoute('/foo.html', async (req, res) => {
    reachedOriginalTarget = true;
    res.end('<html><body></body></html>');
  });
  const examplePort = 20_000 + workerInfo.workerIndex * 3;
  const page = await pageFactory(testServerPort);
  const response = await page.request.get(`http://localhost:${examplePort}/foo.html`);
  expect(response.status()).toBe(200);
  expect(await response.text()).toContain('from-retargeted-server');
  expect(reachedOriginalTarget).toBe(false);
  stopTestServer();
});

it('should proxy local.playwright requests', async ({ pageFactory, server, browserName }, workerInfo) => {
  const { testServerPort, stopTestServer } = await startTestServer();
  let reachedOriginalTarget = false;
  server.setRoute('/foo.html', async (req, res) => {
    reachedOriginalTarget = true;
    res.end('<html><body></body></html>');
  });
  const examplePort = 20_000 + workerInfo.workerIndex * 3;
  const page = await pageFactory(testServerPort);
  await page.goto(`http://local.playwright:${examplePort}/foo.html`);
  expect(await page.content()).toContain('from-retargeted-server');
  expect(reachedOriginalTarget).toBe(false);
  stopTestServer();
});

it('should lead to the error page for forwarded requests when the connection is refused', async ({ pageFactory, browserName }, workerInfo) => {
  const examplePort = 20_000 + workerInfo.workerIndex * 3;
  const page = await pageFactory();
  const error = await page.goto(`http://localhost:${examplePort}`).catch(e => e);
  if (browserName === 'chromium')
    expect(error.message).toContain('net::ERR_SOCKS_CONNECTION_FAILED at http://localhost:20');
  else if (browserName === 'webkit')
    expect(error.message).toBeTruthy();
  else if (browserName === 'firefox')
    expect(error.message.includes('NS_ERROR_NET_RESET') || error.message.includes('NS_ERROR_CONNECTION_REFUSED')).toBe(true);
});
