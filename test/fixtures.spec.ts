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

import { folio, RemoteServer } from './remoteServer.fixture';
import { execSync } from 'child_process';
import path from 'path';

type FixturesFixtures = {
  connectedRemoteServer: RemoteServer;
};
const fixtures = folio.extend<FixturesFixtures>();

fixtures.connectedRemoteServer.init(async ({browserType, remoteServer, server}, run) => {
  const browser = await browserType.connect({ wsEndpoint: remoteServer.wsEndpoint() });
  const page = await browser.newPage();
  await page.goto(server.EMPTY_PAGE);
  await run(remoteServer);
  await browser.close();
});

const { it, describe, expect } = fixtures.build();

async function waitForProcessExit(pid: number | string) {
  while (true) {
    try {
      process.kill(+pid, 0);
    } catch (e) {
      // Exception means no such process.
      return;
    }
    await new Promise(f => setTimeout(f, 100));
  }
}

it('should close the browser when the node process closes', test => {
  test.slow();
}, async ({connectedRemoteServer, isWindows}) => {
  if (isWindows)
    execSync(`taskkill /pid ${connectedRemoteServer.child().pid} /T /F`);
  else
    process.kill(connectedRemoteServer.child().pid);
  await connectedRemoteServer.childExitStatus();
  await waitForProcessExit(connectedRemoteServer.browserPid());
  await waitForProcessExit(connectedRemoteServer.watchdogPid());
});

describe('process launcher', (suite, { platform }) => {
  suite.skip(platform === 'win32', 'Cannot reliably send signals on Windows.');
  suite.slow();
}, () => {
  it('should report browser close signal', async ({connectedRemoteServer}) => {
    process.kill(-connectedRemoteServer.browserPid(), 'SIGTERM');
    expect(await connectedRemoteServer.out('exitCode')).toBe('null');
    expect(await connectedRemoteServer.out('signal')).toBe('SIGTERM');
    process.kill(connectedRemoteServer.child().pid);
    await connectedRemoteServer.childExitStatus();
  });

  it('should report browser close signal 2', async ({connectedRemoteServer}) => {
    process.kill(-connectedRemoteServer.browserPid(), 'SIGKILL');
    expect(await connectedRemoteServer.out('exitCode')).toBe('null');
    expect(await connectedRemoteServer.out('signal')).toBe('SIGKILL');
    process.kill(connectedRemoteServer.child().pid);
    await connectedRemoteServer.childExitStatus();
  });

  it('should close the browser on SIGINT', async ({connectedRemoteServer}) => {
    process.kill(connectedRemoteServer.child().pid, 'SIGINT');
    expect(await connectedRemoteServer.childExitStatus()).toEqual({ exitCode: null, signal: 'SIGINT' });
    await waitForProcessExit(connectedRemoteServer.browserPid());
    await waitForProcessExit(connectedRemoteServer.watchdogPid());
  });

  it('should close the browser on SIGTERM', async ({connectedRemoteServer}) => {
    process.kill(connectedRemoteServer.child().pid, 'SIGTERM');
    expect(await connectedRemoteServer.childExitStatus()).toEqual({ exitCode: null, signal: 'SIGTERM' });
    await waitForProcessExit(connectedRemoteServer.browserPid());
    await waitForProcessExit(connectedRemoteServer.watchdogPid());
  });

  it('should close the browser on SIGKILL', async ({connectedRemoteServer}) => {
    process.kill(connectedRemoteServer.child().pid, 'SIGKILL');
    expect(await connectedRemoteServer.childExitStatus()).toEqual({ exitCode: null, signal: 'SIGKILL' });
    await waitForProcessExit(connectedRemoteServer.browserPid());
    await waitForProcessExit(connectedRemoteServer.watchdogPid());
  });

  it('should close the browser on process.exit', async ({connectedRemoteServer}) => {
    // We send SIGHUP, child process catches it and does process.exit(123).
    process.kill(connectedRemoteServer.child().pid, 'SIGHUP');
    expect(await connectedRemoteServer.childExitStatus()).toEqual({ exitCode: 123, signal: null });
    await waitForProcessExit(connectedRemoteServer.browserPid());
    await waitForProcessExit(connectedRemoteServer.watchdogPid());
  });
});

it('caller file path', async ({}) => {
  const stackTrace = require(path.join(__dirname, '..', 'lib', 'utils', 'stackTrace'));
  const callme = require('./fixtures/callback');
  const filePath = callme(() => {
    return stackTrace.getCallerFilePath(path.join(__dirname, 'fixtures') + path.sep);
  });
  expect(filePath).toBe(__filename);
});
