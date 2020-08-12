/**
 * Copyright Microsoft Corporation. All rights reserved.
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

import path from 'path';
import fs from 'fs';
import childProcess from 'child_process';
import { LaunchOptions, BrowserType, Browser, BrowserContext, Page, BrowserServer } from '../index';
import { TestServer } from '../utils/testserver/';
import { Connection } from '../lib/rpc/client/connection';
import { Transport } from '../lib/rpc/transport';
import { setUnderTest } from '../lib/helper';
import { installCoverageHooks } from './runner/coverage';
import { valueFromEnv } from './runner/utils';

setUnderTest(); // Note: we must call setUnderTest before requiring Playwright

const browserName = process.env.BROWSER || 'chromium';

declare global {
  interface WorkerState {
    parallelIndex: number;
    http_server: {server: TestServer, httpsServer: TestServer};
    defaultBrowserOptions: LaunchOptions;
    playwright: typeof import('../index');
    browserType: BrowserType<Browser>;
    browser: Browser;
  }
  interface FixtureState {
    toImpl: (rpcObject: any) => any;
    context: BrowserContext;
    server: TestServer;
    page: Page;
    httpsServer: TestServer;
    browserServer: BrowserServer;
  }  
}

registerWorkerFixture('parallelIndex', async ({}, test) => {
  await test(parseInt(process.env.JEST_WORKER_ID, 10) - 1);
});

registerWorkerFixture('http_server', async ({parallelIndex}, test) => {
  const assetsPath = path.join(__dirname, 'assets');
  const cachedPath = path.join(__dirname, 'assets', 'cached');

  const port = 8907 + parallelIndex * 2;
  const server = await TestServer.create(assetsPath, port);
  server.enableHTTPCache(cachedPath);

  const httpsPort = port + 1;
  const httpsServer = await TestServer.createHTTPS(assetsPath, httpsPort);
  httpsServer.enableHTTPCache(cachedPath);

  await test({server, httpsServer});

  await Promise.all([
    server.stop(),
    httpsServer.stop(),
  ]);
});

registerWorkerFixture('defaultBrowserOptions', async({}, test) => {
  let executablePath = undefined;
  if (browserName === 'chromium' && process.env.CRPATH)
    executablePath = process.env.CRPATH;
  if (browserName === 'firefox' && process.env.FFPATH)
    executablePath = process.env.FFPATH;
  if (browserName === 'webkit' && process.env.WKPATH)
    executablePath = process.env.WKPATH;
  if (executablePath)
    console.error(`Using executable at ${executablePath}`);
  await test({
    handleSIGINT: false,
    slowMo: valueFromEnv('SLOW_MO', 0),
    headless: !!valueFromEnv('HEADLESS', true),
    executablePath
  });
});

registerWorkerFixture('playwright', async({parallelIndex}, test) => {
  const {coverage, uninstall} = installCoverageHooks(browserName);
  if (process.env.PWCHANNEL === 'wire') {
    const connection = new Connection();
    const spawnedProcess = childProcess.fork(path.join(__dirname, '..', 'lib', 'rpc', 'server'), [], {
      stdio: 'pipe',
      detached: true,
    });
    spawnedProcess.unref();
    const onExit = (exitCode, signal) => {
      throw new Error(`Server closed with exitCode=${exitCode} signal=${signal}`);
    };
    spawnedProcess.on('exit', onExit);
    const transport = new Transport(spawnedProcess.stdin, spawnedProcess.stdout);
    connection.onmessage = message => transport.send(JSON.stringify(message));
    transport.onmessage = message => connection.dispatch(JSON.parse(message));
    const playwrightObject = await connection.waitForObjectWithKnownName('Playwright');
    await test(playwrightObject);
    spawnedProcess.removeListener('exit', onExit);
    spawnedProcess.stdin.destroy();
    spawnedProcess.stdout.destroy();
    spawnedProcess.stderr.destroy();
    await teardownCoverage();
  } else {
    await test(require('../index'))
    await teardownCoverage();
  }

  async function teardownCoverage() {
    uninstall();
    const coveragePath = path.join(path.join(__dirname, 'output-' + browserName), 'coverage', parallelIndex + '.json');
    const coverageJSON = [...coverage.keys()].filter(key => coverage.get(key));
    await fs.promises.mkdir(path.dirname(coveragePath), { recursive: true });
    await fs.promises.writeFile(coveragePath, JSON.stringify(coverageJSON, undefined, 2), 'utf8');
  }

});

registerFixture('toImpl', async ({playwright}, test) => {
  await test((playwright as any)._toImpl);
});

registerWorkerFixture('browserType', async ({playwright}, test) => {
  await test(playwright[process.env.BROWSER || 'chromium']);
});

registerWorkerFixture('browser', async ({browserType, defaultBrowserOptions}, test) => {
  const browser = await browserType.launch(defaultBrowserOptions);
  await test(browser);
  if (browser.contexts().length !== 0) {
    console.warn(`\nWARNING: test did not close all created contexts! ${new Error().stack}\n`);
    await Promise.all(browser.contexts().map(context => context.close())).catch(e => void 0);
  }
  await browser.close();
});

registerFixture('context', async ({browser}, test) => {
  const context = await browser.newContext();
  await test(context);
  await context.close();
});

registerFixture('page', async ({context}, test) => {
  const page = await context.newPage();
  await test(page);
});

registerFixture('server', async ({http_server}, test) => {
  http_server.server.reset();
  await test(http_server.server);
});

registerFixture('httpsServer', async ({http_server}, test) => {
  http_server.httpsServer.reset();
  await test(http_server.httpsServer);
});
