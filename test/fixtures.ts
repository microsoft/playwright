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

import assert from 'assert';
import childProcess from 'child_process';
import fs from 'fs';
import path from 'path';
import util from 'util';
import os from 'os';
import type { Browser, BrowserContext, BrowserType, Page } from '../index';
import { Connection } from '../lib/client/connection';
import { Transport } from '../lib/protocol/transport';
import { installCoverageHooks } from './coverage';
import { folio as httpFolio } from './http.fixtures';
import { folio as playwrightFolio } from './playwright.fixtures';
export { expect, config } from 'folio';

const removeFolderAsync = util.promisify(require('rimraf'));
const mkdtempAsync = util.promisify(fs.mkdtemp);

const getExecutablePath = browserName => {
  if (browserName === 'chromium' && process.env.CRPATH)
    return process.env.CRPATH;
  if (browserName === 'firefox' && process.env.FFPATH)
    return process.env.FFPATH;
  if (browserName === 'webkit' && process.env.WKPATH)
    return process.env.WKPATH;
};

type WireParameters = {
  wire: boolean;
};
type WorkerFixtures = {
  toImpl: (rpcObject: any) => any;
};
type TestFixtures = {
  createUserDataDir: () => Promise<string>;
  launchPersistent: (options?: Parameters<BrowserType<Browser>['launchPersistentContext']>[1]) => Promise<{ context: BrowserContext, page: Page }>;
};

const fixtures = playwrightFolio.union(httpFolio).extend<TestFixtures, WorkerFixtures, WireParameters>();

fixtures.wire.initParameter('Wire testing mode', !!process.env.PWWIRE);

fixtures.createUserDataDir.init(async ({ }, run) => {
  const dirs: string[] = [];
  async function createUserDataDir() {
  // We do not put user data dir in testOutputPath,
  // because we do not want to upload them as test result artifacts.
  //
  // Additionally, it is impossible to upload user data dir after test run:
  // - Firefox removes lock file later, presumably from another watchdog process?
  // - WebKit has circular symlinks that makes CI go crazy.
    const dir = await mkdtempAsync(path.join(os.tmpdir(), 'playwright-test-'));
    dirs.push(dir);
    return dir;
  }
  await run(createUserDataDir);
  await Promise.all(dirs.map(dir => removeFolderAsync(dir).catch(e => { })));
});

fixtures.launchPersistent.init(async ({ createUserDataDir, browserOptions, browserType }, run) => {
  let context;
  async function launchPersistent(options) {
    if (context)
      throw new Error('can only launch one persitent context');
    const userDataDir = await createUserDataDir();
    context = await browserType.launchPersistentContext(userDataDir, { ...browserOptions, ...options });
    const page = context.pages()[0];
    return { context, page };
  }
  await run(launchPersistent);
  if (context)
    await context.close();
});

fixtures.browserOptions.override(async ({ browserName, headful, slowMo }, run) => {
  const executablePath = getExecutablePath(browserName);
  if (executablePath)
    console.error(`Using executable at ${executablePath}`);
  await run({
    executablePath,
    handleSIGINT: false,
    slowMo,
    headless: !headful,
  });
});

fixtures.playwright.override(async ({ browserName, testWorkerIndex, platform, wire }, run) => {
  assert(platform); // Depend on platform to generate all tests.
  const { coverage, uninstall } = installCoverageHooks(browserName);
  if (wire) {
    require('../lib/utils/utils').setUnderTest();
    const connection = new Connection();
    const spawnedProcess = childProcess.fork(path.join(__dirname, '..', 'lib', 'driver.js'), ['serve'], {
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
    await run(playwrightObject);
    spawnedProcess.removeListener('exit', onExit);
    spawnedProcess.stdin.destroy();
    spawnedProcess.stdout.destroy();
    spawnedProcess.stderr.destroy();
    await teardownCoverage();
  } else {
    const playwright = require('../index');
    await run(playwright);
    await teardownCoverage();
  }

  async function teardownCoverage() {
    uninstall();
    const coveragePath = path.join(__dirname, 'coverage-report', testWorkerIndex + '.json');
    const coverageJSON = [...coverage.keys()].filter(key => coverage.get(key));
    await fs.promises.mkdir(path.dirname(coveragePath), { recursive: true });
    await fs.promises.writeFile(coveragePath, JSON.stringify(coverageJSON, undefined, 2), 'utf8');
  }
});

fixtures.toImpl.init(async ({ playwright }, run) => {
  await run((playwright as any)._toImpl);
}, { scope: 'worker' });

fixtures.testParametersPathSegment.override(async ({ browserName }, run) => {
  await run(browserName);
});

export const folio = fixtures.build();

folio.generateParametrizedTests(
    'platform',
    process.env.PWTESTREPORT ? ['win32', 'darwin', 'linux'] : [process.platform as ('win32' | 'linux' | 'darwin')]);

export const it = folio.it;
export const fit = folio.fit;
export const test = folio.test;
export const xit = folio.xit;
export const describe = folio.describe;
export const beforeEach = folio.beforeEach;
export const afterEach = folio.afterEach;
export const beforeAll = folio.beforeAll;
export const afterAll = folio.afterAll;
