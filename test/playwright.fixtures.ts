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

import fs from 'fs';
import path from 'path';
import os from 'os';
import childProcess from 'child_process';
import type { LaunchOptions, BrowserType, Browser, BrowserContext, Page, BrowserServer } from '../index';
import { TestServer } from '../utils/testserver';
import { Connection } from '../lib/client/connection';
import { Transport } from '../lib/protocol/transport';
import { setUnderTest } from '../lib/utils/utils';
import { installCoverageHooks } from './coverage';
import { parameters, registerFixture, registerWorkerFixture } from '../test-runner';
import {mkdtempAsync, removeFolderAsync} from './utils';

export const options = {
  CHROMIUM: parameters.browserName === 'chromium',
  FIREFOX: parameters.browserName === 'firefox',
  WEBKIT: parameters.browserName === 'webkit',
  HEADLESS : !!valueFromEnv('HEADLESS', true),
  WIRE: !!process.env.PWWIRE,
  SLOW_MO: valueFromEnv('SLOW_MO', 0),
}

declare global {
  interface WorkerState {
    asset: (path: string) => string;
    defaultBrowserOptions: LaunchOptions;
    golden: (path: string) => string;
    playwright: typeof import('../index');
    browserType: BrowserType<Browser>;
    browser: Browser;
    httpService: {server: TestServer, httpsServer: TestServer}
    toImpl: (rpcObject: any) => any;
  }
  interface TestState {
    context: BrowserContext;
    server: TestServer;
    page: Page;
    httpsServer: TestServer;
    browserServer: BrowserServer;
    launchPersistent: (options?: Parameters<BrowserType<Browser>['launchPersistentContext']>[1]) => Promise<{context: BrowserContext, page: Page}>;
  }
  interface FixtureParameters {
    browserName: string;
  }
}

declare global {
  const MAC: boolean;
  const LINUX: boolean;
  const WIN: boolean;
}
const platform = os.platform();
global['MAC'] = platform === 'darwin';
global['LINUX'] = platform === 'linux';
global['WIN'] = platform === 'win32';

registerWorkerFixture('httpService', async ({}, test) => {
  const assetsPath = path.join(__dirname, 'assets');
  const cachedPath = path.join(__dirname, 'assets', 'cached');

  const port = 8907 + parameters.parallelIndex * 2;
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

const getExecutablePath = (browserName) => {
  if (browserName === 'chromium' && process.env.CRPATH)
    return process.env.CRPATH;
  if (browserName === 'firefox' && process.env.FFPATH)
    return process.env.FFPATH;
  if (browserName === 'webkit' && process.env.WKPATH)
    return process.env.WKPATH;
}

registerWorkerFixture('defaultBrowserOptions', async({browserName}, test) => {
  let executablePath = getExecutablePath(browserName);

  if (executablePath)
    console.error(`Using executable at ${executablePath}`);
  await test({
    handleSIGINT: false,
    slowMo: options.SLOW_MO,
    headless: options.HEADLESS,
    executablePath
  });
});

registerWorkerFixture('playwright', async({browserName}, test) => {
  const playwrightCacheEntry = require.cache[require.resolve('../index')];
  if (playwrightCacheEntry)
    throw new Error('Could not set playwright to test mode because it was required directly from ' + playwrightCacheEntry.parent.id);
  setUnderTest(); // Note: we must call setUnderTest before requiring Playwright

  const {coverage, uninstall} = installCoverageHooks(browserName);
  if (options.WIRE) {
    const connection = new Connection();
    const spawnedProcess = childProcess.fork(path.join(__dirname, '..', 'lib', 'server.js'), [], {
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
    const coveragePath = path.join(__dirname, 'coverage-report', parameters.parallelIndex + '.json');
    const coverageJSON = [...coverage.keys()].filter(key => coverage.get(key));
    await fs.promises.mkdir(path.dirname(coveragePath), { recursive: true });
    await fs.promises.writeFile(coveragePath, JSON.stringify(coverageJSON, undefined, 2), 'utf8');
  }

});

registerWorkerFixture('toImpl', async ({playwright}, test) => {
  await test((playwright as any)._toImpl);
});

registerWorkerFixture('browserType', async ({playwright, browserName}, test) => {
  const browserType = playwright[browserName];
  await test(browserType);
});

registerWorkerFixture('browserName', async ({}, test) => {
  await test('chromium');
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

registerWorkerFixture('asset', async ({}, test) => {
  await test(p => path.join(__dirname, `assets`, p));
});

registerWorkerFixture('golden', async ({browserName}, test) => {
  await test(p => path.join(browserName, p));
});

registerFixture('context', async ({browser}, test) => {
  const context = await browser.newContext();
  await test(context);
  await context.close();
});

registerFixture('page', async ({context}, runTest, info) => {
  const page = await context.newPage();
  await runTest(page);
  const { test, config, result } = info;
  if (result.status === 'failed' || result.status === 'timedOut') {
    const relativePath = path.relative(config.testDir, test.file).replace(/\.spec\.[jt]s/, '');
    const sanitizedTitle = test.title.replace(/[^\w\d]+/g, '_');
    const assetPath = path.join(config.outputDir, relativePath, sanitizedTitle) + '-failed.png';
    await page.screenshot({ path: assetPath });
  }
});

registerFixture('launchPersistent', async ({tmpDir, defaultBrowserOptions, browserType}, test) => {
  let context;
  async function launchPersistent(options) {
    if (context)
      throw new Error('can only launch one persitent context');
    context = await browserType.launchPersistentContext(tmpDir, {...defaultBrowserOptions, ...options});
    const page = context.pages()[0];
    return {context, page};
  }
  await test(launchPersistent);
  if (context)
    await context.close();
});

registerFixture('server', async ({httpService}, test) => {
  httpService.server.reset();
  await test(httpService.server);
});

registerFixture('httpsServer', async ({httpService}, test) => {
  httpService.httpsServer.reset();
  await test(httpService.httpsServer);
});

registerFixture('tmpDir', async ({}, test) => {
  const tmpDir = await mkdtempAsync(path.join(os.tmpdir(), 'playwright-test-'));
  await test(tmpDir);
  await removeFolderAsync(tmpDir).catch(e => {});
});

function valueFromEnv(name, defaultValue) {
  if (!(name in process.env))
    return defaultValue;
  return JSON.parse(process.env[name]);
}
