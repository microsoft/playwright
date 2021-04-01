/**
 * Copyright 2019 Google Inc. All rights reserved.
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

import { folio } from './remoteServer.fixture';
import { execSync } from 'child_process';
import path from 'path';
import * as stackTrace from '../src/utils/stackTrace';
import { setUnderTest } from '../src/utils/utils';
import type { Browser } from '../index';

const { it, describe, expect, beforeEach, afterEach } = folio;

it('should close the browser when the node process closes', test => {
  test.slow();
}, async ({browserType, remoteServer, isWindows, server}) => {
  const browser = await browserType.connect({ wsEndpoint: remoteServer.wsEndpoint() });
  const page = await browser.newPage();
  await page.goto(server.EMPTY_PAGE);
  if (isWindows)
    execSync(`taskkill /pid ${remoteServer.child().pid} /T /F`);
  else
    process.kill(remoteServer.child().pid);
  const exitCode = await remoteServer.childExitCode();
  await browser.close();
  // We might not get browser exitCode in time when killing the parent node process,
  // so we don't check it here.
  expect(exitCode).toBe(isWindows ? 1 : 0);
});

describe('signals', (suite, { platform, headful }) => {
  suite.skip(platform === 'win32' || headful);
  suite.slow();
}, () => {
  let browser: Browser;

  beforeEach(async ({ browserType, server, remoteServer }) => {
    browser = await browserType.connect({ wsEndpoint: remoteServer.wsEndpoint() });
    const page = await browser.newPage();
    await page.goto(server.EMPTY_PAGE);
  });

  afterEach(async () => {
    await browser.close();
  });

  it('should report browser close signal', async ({remoteServer}) => {
    const pid = await remoteServer.out('pid');
    process.kill(-pid, 'SIGTERM');
    expect(await remoteServer.out('exitCode')).toBe('null');
    expect(await remoteServer.out('signal')).toBe('SIGTERM');
    process.kill(remoteServer.child().pid);
    await remoteServer.childExitCode();
  });

  it('should report browser close signal 2', async ({remoteServer}) => {
    const pid = await remoteServer.out('pid');
    process.kill(-pid, 'SIGKILL');
    expect(await remoteServer.out('exitCode')).toBe('null');
    expect(await remoteServer.out('signal')).toBe('SIGKILL');
    process.kill(remoteServer.child().pid);
    await remoteServer.childExitCode();
  });

  it('should close the browser on SIGINT', (test, { browserChannel }) => {
    test.fixme(!!browserChannel, 'Uncomment on roll');
  }, async ({remoteServer}) => {
    process.kill(remoteServer.child().pid, 'SIGINT');
    expect(await remoteServer.out('exitCode')).toBe('0');
    expect(await remoteServer.out('signal')).toBe('null');
    expect(await remoteServer.childExitCode()).toBe(130);
  });

  it('should close the browser on SIGTERM', (test, { browserChannel }) => {
    test.fixme(!!browserChannel, 'Uncomment on roll');
  }, async ({remoteServer}) => {
    process.kill(remoteServer.child().pid, 'SIGTERM');
    expect(await remoteServer.out('exitCode')).toBe('0');
    expect(await remoteServer.out('signal')).toBe('null');
    expect(await remoteServer.childExitCode()).toBe(0);
  });

  it('should close the browser on SIGHUP', (test, { browserChannel }) => {
    test.fixme(!!browserChannel, 'Uncomment on roll');
  }, async ({remoteServer}) => {
    process.kill(remoteServer.child().pid, 'SIGHUP');
    expect(await remoteServer.out('exitCode')).toBe('0');
    expect(await remoteServer.out('signal')).toBe('null');
    expect(await remoteServer.childExitCode()).toBe(0);
  });
});

describe('stalling signals', (suite, { platform, headful }) => {
  suite.skip(platform === 'win32' || headful);
  suite.slow();
}, () => {
  let browser: Browser;

  beforeEach(async ({ browserType, server, stallingRemoteServer }) => {
    browser = await browserType.connect({ wsEndpoint: stallingRemoteServer.wsEndpoint() });
    const page = await browser.newPage();
    await page.goto(server.EMPTY_PAGE);
  });

  afterEach(async () => {
    await browser.close();
  });

  it('should kill the browser on double SIGINT', async ({stallingRemoteServer}) => {
    process.kill(stallingRemoteServer.child().pid, 'SIGINT');
    await stallingRemoteServer.out('stalled');
    process.kill(stallingRemoteServer.child().pid, 'SIGINT');
    expect(await stallingRemoteServer.out('exitCode')).toBe('null');
    expect(await stallingRemoteServer.out('signal')).toBe('SIGKILL');
    expect(await stallingRemoteServer.childExitCode()).toBe(130);
  });

  it('should kill the browser on SIGINT + SIGTERM', async ({stallingRemoteServer}) => {
    process.kill(stallingRemoteServer.child().pid, 'SIGINT');
    await stallingRemoteServer.out('stalled');
    process.kill(stallingRemoteServer.child().pid, 'SIGTERM');
    expect(await stallingRemoteServer.out('exitCode')).toBe('null');
    expect(await stallingRemoteServer.out('signal')).toBe('SIGKILL');
    expect(await stallingRemoteServer.childExitCode()).toBe(0);
  });

  it('should kill the browser on SIGTERM + SIGINT', async ({stallingRemoteServer}) => {
    process.kill(stallingRemoteServer.child().pid, 'SIGTERM');
    await stallingRemoteServer.out('stalled');
    process.kill(stallingRemoteServer.child().pid, 'SIGINT');
    expect(await stallingRemoteServer.out('exitCode')).toBe('null');
    expect(await stallingRemoteServer.out('signal')).toBe('SIGKILL');
    expect(await stallingRemoteServer.childExitCode()).toBe(130);
  });
});

it('caller file path', async ({}) => {
  setUnderTest();
  const callme = require('./fixtures/callback');
  const filePath = callme(() => {
    return stackTrace.getCallerFilePath(path.join(__dirname, 'fixtures') + path.sep);
  });
  expect(filePath).toBe(__filename);
});
