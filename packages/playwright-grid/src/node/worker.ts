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

import debug from 'debug';
import WebSocket from 'ws';
import { DispatcherConnection, RootDispatcher, PlaywrightDispatcher, createPlaywright, serverSideCallMetadata, SocksProxy } from 'playwright-core/lib/server';
import { gracefullyCloseAll } from 'playwright-core/lib/utils';
import type { Playwright } from 'playwright-core/lib/server';

const workerId = process.env.PLAYWRIGHT_GRID_WORKER_ID!;
const log = debug('pw:grid:worker@' + workerId);

class Worker {
  constructor() {
    log('worker created');
    const dispatcherConnection = new DispatcherConnection();
    let browserName: 'chromium' | 'webkit' | 'firefox';
    let launchOptions: any;
    let proxyPattern: string | undefined;
    let socksProxy: SocksProxy | undefined;

    const dispose = async () => {
      dispatcherConnection.onmessage = () => {};
      // eslint-disable-next-line no-restricted-properties
      setTimeout(() => process.exit(0), 30000);
      await Promise.all([
        socksProxy?.close(),
        gracefullyCloseAll(),
      ]).catch(() => {});
      // eslint-disable-next-line no-restricted-properties
      process.exit(0);
    };

    const ws = new WebSocket(process.env.PLAYWRIGHT_GRID_ENDPOINT + `/registerWorker?nodeId=${process.env.PLAYWRIGHT_GRID_NODE_ID}&workerId=${workerId}`, {
      headers: {
        'x-playwright-access-key': process.env.PLAYWRIGHT_GRID_ACCESS_KEY!,
      }
    });
    dispatcherConnection.onmessage = message => ws.send(JSON.stringify(message));
    ws.on('upgrade', response => {
      const headers: Record<string, string> = {};
      for (let i = 0; i < response.rawHeaders.length; i += 2)
        headers[response.rawHeaders[i]] = response.rawHeaders[i + 1];

      browserName = headers['x-playwright-browser'] as any || 'chromium';
      launchOptions = JSON.parse(headers['x-playwright-launch-options'] || '{}');
      proxyPattern = headers['x-playwright-proxy'] || '';

      log({ browserName, launchOptions, proxyPattern });
    });
    ws.once('open', () => {
      log('worker opened');
      new RootDispatcher(dispatcherConnection, async (rootScope, { sdkLanguage }) => {
        const playwright = createPlaywright({ sdkLanguage });
        if (proxyPattern)
          socksProxy = await createOwnedSocksProxy(proxyPattern, playwright);
        const browser = await playwright[browserName].launch(serverSideCallMetadata(), launchOptions);
        return new PlaywrightDispatcher(rootScope, playwright, socksProxy, browser);
      });
    });
    ws.on('message', message => dispatcherConnection.dispatch(JSON.parse(message.toString())));
    ws.on('error', error => {
      log('socket error');
      dispose();
    });
    ws.on('close', async () => {
      log('worker deleted');
      dispose();
    });
  }
}

async function createOwnedSocksProxy(proxyPattern: string, playwright: Playwright): Promise<SocksProxy | undefined> {
  if (!proxyPattern)
    return;
  const socksProxy = new SocksProxy();
  socksProxy.setPattern(proxyPattern);
  playwright.options.socksProxyPort = await socksProxy.listen(0);
  log(`started socks proxy on port ${playwright.options.socksProxyPort}`);
  return socksProxy;
}

new Worker();
