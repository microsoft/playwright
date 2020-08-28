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
import { options } from './playwright.fixtures';
import './remoteServer.fixture';

import { execSync } from 'child_process';
import path from 'path';

it('should close the browser when the node process closes', test => {
  test.slow();
}, async ({remoteServer}) => {
  if (WIN)
    execSync(`taskkill /pid ${remoteServer.child().pid} /T /F`);
  else
    process.kill(remoteServer.child().pid);
  expect(await remoteServer.childExitCode()).toBe(WIN ? 1 : 0);
  // We might not get browser exitCode in time when killing the parent node process,
  // so we don't check it here.
});

describe.skip(WIN || !options.HEADLESS).slow()('fixtures', () => {
  // Cannot reliably send signals on Windows.
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

  it('should close the browser on SIGINT', async ({remoteServer}) => {
    process.kill(remoteServer.child().pid, 'SIGINT');
    expect(await remoteServer.out('exitCode')).toBe('0');
    expect(await remoteServer.out('signal')).toBe('null');
    expect(await remoteServer.childExitCode()).toBe(130);
  });

  it('should close the browser on SIGTERM', async ({remoteServer}) => {
    process.kill(remoteServer.child().pid, 'SIGTERM');
    expect(await remoteServer.out('exitCode')).toBe('0');
    expect(await remoteServer.out('signal')).toBe('null');
    expect(await remoteServer.childExitCode()).toBe(0);
  });

  it('should close the browser on SIGHUP', async ({remoteServer}) => {
    process.kill(remoteServer.child().pid, 'SIGHUP');
    expect(await remoteServer.out('exitCode')).toBe('0');
    expect(await remoteServer.out('signal')).toBe('null');
    expect(await remoteServer.childExitCode()).toBe(0);
  });

  it('should kill the browser on double SIGINT', async ({stallingRemoteServer}) => {
    const remoteServer = stallingRemoteServer;
    process.kill(remoteServer.child().pid, 'SIGINT');
    await remoteServer.out('stalled');
    process.kill(remoteServer.child().pid, 'SIGINT');
    expect(await remoteServer.out('exitCode')).toBe('null');
    expect(await remoteServer.out('signal')).toBe('SIGKILL');
    expect(await remoteServer.childExitCode()).toBe(130);
  });

  it('should kill the browser on SIGINT + SIGTERM', async ({stallingRemoteServer}) => {
    const remoteServer = stallingRemoteServer;
    process.kill(remoteServer.child().pid, 'SIGINT');
    await remoteServer.out('stalled');
    process.kill(remoteServer.child().pid, 'SIGTERM');
    expect(await remoteServer.out('exitCode')).toBe('null');
    expect(await remoteServer.out('signal')).toBe('SIGKILL');
    expect(await remoteServer.childExitCode()).toBe(0);
  });

  it('should kill the browser on SIGTERM + SIGINT', async ({stallingRemoteServer}) => {
    const remoteServer = stallingRemoteServer;
    process.kill(remoteServer.child().pid, 'SIGTERM');
    await remoteServer.out('stalled');
    process.kill(remoteServer.child().pid, 'SIGINT');
    expect(await remoteServer.out('exitCode')).toBe('null');
    expect(await remoteServer.out('signal')).toBe('SIGKILL');
    expect(await remoteServer.childExitCode()).toBe(130);
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
