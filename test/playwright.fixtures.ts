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
import util from 'util';
import childProcess from 'child_process';
import type { LaunchOptions, BrowserType, Browser, BrowserContext, Page, Frame, BrowserServer, BrowserContextOptions } from '../index';
import { TestServer } from '../utils/testserver';
import { Connection } from '../lib/client/connection';
import { Transport } from '../lib/protocol/transport';
import { installCoverageHooks } from './coverage';
import { fixtures as baseFixtures } from '@playwright/test-runner';
import assert from 'assert';

const mkdtempAsync = util.promisify(fs.mkdtemp);
const removeFolderAsync = util.promisify(require('rimraf'));

type PlaywrightParameters = {
  platform: 'win32' | 'linux' | 'darwin'
  browserName: string;
};

type PlaywrightWorkerFixtures = {
  asset: (path: string) => string;
  defaultBrowserOptions: LaunchOptions;
  golden: (path: string) => string;
  playwright: typeof import('../index');
  browserType: BrowserType<Browser>;
  browser: Browser;
  httpService: {server: TestServer, httpsServer: TestServer}
  domain: void;
  toImpl: (rpcObject: any) => any;
  isChromium: boolean;
  isFirefox: boolean;
  isWebKit: boolean;
  isWindows: boolean;
  isMac: boolean;
  isLinux: boolean;
  expectedSSLError: string;
  requireIsolatedPlaywright: () => typeof import ('../index')
};

type PlaywrightTestFixtures = {
  context: BrowserContext;
  server: TestServer;
  page: Page;
  httpsServer: TestServer;
  browserServer: BrowserServer;
  testOutputDir: string;
  createUserDataDir: () => Promise<string>;
  launchPersistent: (options?: Parameters<BrowserType<Browser>['launchPersistentContext']>[1]) => Promise<{context: BrowserContext, page: Page}>;
};

const fixtures = baseFixtures
    .declareParameters<PlaywrightParameters>()
    .declareWorkerFixtures<PlaywrightWorkerFixtures>()
    .declareTestFixtures<PlaywrightTestFixtures>();
const { defineTestFixture, defineWorkerFixture, defineParameter, generateParametrizedTests } = fixtures;

export const playwrightFixtures = fixtures;
export const it = fixtures.it;
export const fit = fixtures.fit;
export const xit = fixtures.xit;
export const describe = fixtures.describe;
export const fdescribe = fixtures.fdescribe;
export const xdescribe = fixtures.xdescribe;
export const beforeEach = fixtures.beforeEach;
export const afterEach = fixtures.afterEach;
export const beforeAll = fixtures.beforeAll;
export const afterAll = fixtures.afterAll;
export const expect = fixtures.expect;

export const options = {
  CHROMIUM: (parameters: PlaywrightParameters) => parameters.browserName === 'chromium',
  FIREFOX: (parameters: PlaywrightParameters) => parameters.browserName === 'firefox',
  WEBKIT: (parameters: PlaywrightParameters) => parameters.browserName === 'webkit',
  MAC: (parameters: PlaywrightParameters) => parameters.platform === 'darwin',
  LINUX: (parameters: PlaywrightParameters) => parameters.platform === 'linux',
  WIN: (parameters: PlaywrightParameters) => parameters.platform === 'win32',
  HEADLESS: !!valueFromEnv('HEADLESS', true),
  WIRE: !!process.env.PWWIRE,
  SLOW_MO: valueFromEnv('SLOW_MO', 0),
  TRACING: valueFromEnv('TRACING', false),
};

defineWorkerFixture('httpService', async ({parallelIndex}, test) => {
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

const getExecutablePath = browserName => {
  if (browserName === 'chromium' && process.env.CRPATH)
    return process.env.CRPATH;
  if (browserName === 'firefox' && process.env.FFPATH)
    return process.env.FFPATH;
  if (browserName === 'webkit' && process.env.WKPATH)
    return process.env.WKPATH;
};

defineWorkerFixture('defaultBrowserOptions', async ({browserName}, runTest, config) => {
  const executablePath = getExecutablePath(browserName);
  if (executablePath)
    console.error(`Using executable at ${executablePath}`);
  await runTest({
    handleSIGINT: false,
    slowMo: options.SLOW_MO,
    headless: options.HEADLESS,
    executablePath,
    artifactsPath: config.outputDir,
  });
});

defineWorkerFixture('playwright', async ({browserName, parallelIndex, platform}, test) => {
  assert(platform); // Depend on platform to generate all tests.
  const {coverage, uninstall} = installCoverageHooks(browserName);
  if (options.WIRE) {
    require('../lib/utils/utils').setUnderTest();
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
    const playwright = require('../index');
    await test(playwright);
    await teardownCoverage();
  }

  async function teardownCoverage() {
    uninstall();
    const coveragePath = path.join(__dirname, 'coverage-report', parallelIndex + '.json');
    const coverageJSON = [...coverage.keys()].filter(key => coverage.get(key));
    await fs.promises.mkdir(path.dirname(coveragePath), { recursive: true });
    await fs.promises.writeFile(coveragePath, JSON.stringify(coverageJSON, undefined, 2), 'utf8');
  }
});

defineWorkerFixture('requireIsolatedPlaywright', async ({}, test) => {
  await test(() => {
    const oldCache = {...require.cache};
    for (const name in require.cache)
      delete require.cache[name];
    const playwright = require('../index');
    for (const name in require.cache)
      delete require.cache[name];
    for (const name in oldCache)
      require.cache[name] = oldCache[name];
    return playwright;
  });
});

defineWorkerFixture('toImpl', async ({playwright}, test) => {
  await test((playwright as any)._toImpl);
});

defineWorkerFixture('browserType', async ({playwright, browserName}, test) => {
  const browserType = playwright[browserName];
  await test(browserType);
});

defineParameter('browserName', 'Browser type name', '');

defineParameter('platform', 'Operating system', process.platform as ('win32' | 'linux' | 'darwin'));

generateParametrizedTests(
    'browserName',
    process.env.BROWSER ? [process.env.BROWSER] : ['chromium', 'webkit', 'firefox']);

generateParametrizedTests(
    'platform',
    process.env.PWTESTREPORT ? ['win32', 'darwin', 'linux'] : [process.platform as ('win32' | 'linux' | 'darwin')]);

defineWorkerFixture('isChromium', async ({browserName}, test) => {
  await test(browserName === 'chromium');
});

defineWorkerFixture('isFirefox', async ({browserName}, test) => {
  await test(browserName === 'firefox');
});

defineWorkerFixture('isWebKit', async ({browserName}, test) => {
  await test(browserName === 'webkit');
});

defineWorkerFixture('isWindows', async ({platform}, test) => {
  await test(platform === 'win32');
});

defineWorkerFixture('isMac', async ({platform}, test) => {
  await test(platform === 'darwin');
});

defineWorkerFixture('isLinux', async ({platform}, test) => {
  await test(platform === 'linux');
});

defineWorkerFixture('browser', async ({browserType, defaultBrowserOptions}, test) => {
  const browser = await browserType.launch(defaultBrowserOptions);
  await test(browser);
  if (browser.contexts().length !== 0) {
    console.warn(`\nWARNING: test did not close all created contexts! ${new Error().stack}\n`);
    await Promise.all(browser.contexts().map(context => context.close())).catch(e => void 0);
  }
  await browser.close();
});

defineWorkerFixture('asset', async ({}, test) => {
  await test(p => path.join(__dirname, `assets`, p));
});

defineWorkerFixture('golden', async ({browserName}, test) => {
  await test(p => path.join(browserName, p));
});

defineWorkerFixture('expectedSSLError', async ({browserName, platform}, runTest) => {
  let expectedSSLError: string;
  if (browserName === 'chromium') {
    expectedSSLError = 'net::ERR_CERT_AUTHORITY_INVALID';
  } else if (browserName === 'webkit') {
    if (platform === 'darwin')
      expectedSSLError = 'The certificate for this server is invalid';
    else if (platform === 'win32')
      expectedSSLError = 'SSL peer certificate or SSH remote key was not OK';
    else
      expectedSSLError = 'Unacceptable TLS certificate';
  } else {
    expectedSSLError = 'SSL_ERROR_UNKNOWN';
  }
  await runTest(expectedSSLError);
});

defineTestFixture('testOutputDir', async ({}, runTest, info) => {
  const { spec, config } = info;
  const relativePath = path.relative(config.testDir, spec.file).replace(/\.spec\.[jt]s/, '');
  const sanitizedTitle = spec.title.replace(/[^\w\d]+/g, '_');
  const testOutputDir = path.join(config.outputDir, relativePath, sanitizedTitle);
  await fs.promises.mkdir(testOutputDir, { recursive: true });
  await runTest(testOutputDir);
  const files = await fs.promises.readdir(testOutputDir);
  if (!files.length) {
    // Do not leave an empty useless directory.
    // This might throw. See https://github.com/GoogleChrome/puppeteer/issues/2778
    await removeFolderAsync(testOutputDir).catch(e => {});
  }
});

defineTestFixture('context', async ({browser, testOutputDir}, runTest, info) => {
  const { config } = info;
  const contextOptions: BrowserContextOptions = {
    relativeArtifactsPath: path.relative(config.outputDir, testOutputDir),
    recordTrace: !!options.TRACING,
    // TODO: enable videos. Currently, long videos are slowly processed by Chromium
    // and (sometimes) Firefox, which causes test timeouts.
    // recordVideos: !!options.TRACING,
  };
  const context = await browser.newContext(contextOptions);
  await runTest(context);
  await context.close();
});

defineTestFixture('page', async ({context, testOutputDir}, runTest, info) => {
  const page = await context.newPage();
  await runTest(page);
  const { testRun } = info;
  if (testRun.status === 'failed' || testRun.status === 'timedOut')
    await page.screenshot({ timeout: 5000, path: path.join(testOutputDir, 'test-failed.png') });
});

defineTestFixture('createUserDataDir', async ({testOutputDir}, runTest, info) => {
  let counter = 0;
  const dirs: string[] = [];
  async function createUserDataDir() {
    const dir = path.join(testOutputDir, `user-data-dir-${counter++}`);
    dirs.push(dir);
    await fs.promises.mkdir(dir, { recursive: true });
    return dir;
  }
  await runTest(createUserDataDir);
  // Remove user data dirs, because we cannot upload them as test result artifacts.
  // - Firefox removes lock file later, repsumably from another watchdog process?
  // - WebKit has circular symlinks that makes CI go crazy.
  await Promise.all(dirs.map(dir => removeFolderAsync(dir).catch(e => {})));
});

defineTestFixture('launchPersistent', async ({createUserDataDir, defaultBrowserOptions, browserType}, test) => {
  let context;
  async function launchPersistent(options) {
    if (context)
      throw new Error('can only launch one persitent context');
    const userDataDir = await createUserDataDir();
    context = await browserType.launchPersistentContext(userDataDir, {...defaultBrowserOptions, ...options});
    const page = context.pages()[0];
    return {context, page};
  }
  await test(launchPersistent);
  if (context)
    await context.close();
});

defineTestFixture('server', async ({httpService}, test) => {
  httpService.server.reset();
  await test(httpService.server);
});

defineTestFixture('httpsServer', async ({httpService}, test) => {
  httpService.httpsServer.reset();
  await test(httpService.httpsServer);
});

defineTestFixture('tmpDir', async ({}, test) => {
  const tmpDir = await mkdtempAsync(path.join(os.tmpdir(), 'playwright-test-'));
  await test(tmpDir);
  await removeFolderAsync(tmpDir).catch(e => {});
});

function valueFromEnv(name, defaultValue) {
  if (!(name in process.env))
    return defaultValue;
  return JSON.parse(process.env[name]);
}

export async function attachFrame(page: Page, frameId: string, url: string): Promise<Frame> {
  const handle = await page.evaluateHandle(async ({ frameId, url }) => {
    const frame = document.createElement('iframe');
    frame.src = url;
    frame.id = frameId;
    document.body.appendChild(frame);
    await new Promise(x => frame.onload = x);
    return frame;
  }, { frameId, url });
  return handle.asElement().contentFrame();
}

export async function detachFrame(page: Page, frameId: string) {
  await page.evaluate(frameId => {
    document.getElementById(frameId).remove();
  }, frameId);
}

export async function verifyViewport(page: Page, width: number, height: number) {
  expect(page.viewportSize().width).toBe(width);
  expect(page.viewportSize().height).toBe(height);
  expect(await page.evaluate('window.innerWidth')).toBe(width);
  expect(await page.evaluate('window.innerHeight')).toBe(height);
}
