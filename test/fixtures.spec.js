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

const path = require('path');
const {spawn, execSync} = require('child_process');
const {FFOX, CHROMIUM, WEBKIT, WIN, LINUX} = require('./utils').testOptions(browserType);

async function testSignal(state, action, exitOnClose) {
  const options = Object.assign({}, state.defaultBrowserOptions, {
    handleSIGINT: true,
    handleSIGTERM: true,
    handleSIGHUP: true,
    executablePath: state.browserType.executablePath(),
  });
  const res = spawn('node', [path.join(__dirname, 'fixtures', 'closeme.js'), state.playwrightPath, state.browserType.name(), JSON.stringify(options), exitOnClose ? 'true' : '']);
  let wsEndPointCallback;
  const wsEndPointPromise = new Promise(x => wsEndPointCallback = x);
  let output = '';
  let browserExitCode = 'none';
  let browserSignal = 'none';
  let browserPid;
  res.stdout.on('data', data => {
    output += data.toString();
    // Uncomment to debug these tests.
    // console.log(data.toString());
    let match = output.match(/browserWS:(.+):browserWS/);
    if (match)
      wsEndPointCallback(match[1]);
    match = output.match(/browserClose:([^:]+):([^:]+):browserClose/);
    if (match) {
      browserExitCode = match[1];
      browserSignal = match[2];
    }
    match = output.match(/browserPid:([^:]+):browserPid/);
    if (match)
      browserPid = +match[1];
  });
  res.on('error', (...args) => console.log("ERROR", ...args));
  const browser = await state.browserType.connect({ wsEndpoint: await wsEndPointPromise });
  const promises = [
    new Promise(resolve => browser.once('disconnected', resolve)),
    new Promise(resolve => res.on('exit', resolve)),
  ];
  action(res, browserPid);
  const [, exitCode] = await Promise.all(promises);
  return { exitCode, browserSignal, browserExitCode, output };
}

describe('Fixtures', function() {
  it.slow()('should close the browser when the node process closes', async state => {
    const result = await testSignal(state, child => {
      if (WIN)
        execSync(`taskkill /pid ${child.pid} /T /F`);
      else
        process.kill(child.pid);
    });
    expect(result.exitCode).toBe(WIN ? 1 : 0);
    // We might not get browser exitCode in time when killing the parent node process,
    // so we don't check it here.
  });

  describe.skip(WIN)('signals', () => {
    // Cannot reliably send signals on Windows.
    it.slow()('should report browser close signal', async state => {
      const result = await testSignal(state, (child, browserPid) => process.kill(browserPid), true);
      expect(result.exitCode).toBe(0);
      expect(result.browserExitCode).toBe('null');
      expect(result.browserSignal).toBe('SIGTERM');
    });
    it.slow()('should report browser close signal 2', async state => {
      const result = await testSignal(state, (child, browserPid) => process.kill(browserPid, 'SIGKILL'), true);
      expect(result.exitCode).toBe(0);
      expect(result.browserExitCode).toBe('null');
      expect(result.browserSignal).toBe('SIGKILL');
    });
    it.slow()('should close the browser on SIGINT', async state => {
      const result = await testSignal(state, child => process.kill(child.pid, 'SIGINT'));
      expect(result.exitCode).toBe(130);
      expect(result.browserExitCode).toBe('0');
      expect(result.browserSignal).toBe('null');
    });
    it.slow()('should close the browser on SIGTERM', async state => {
      const result = await testSignal(state, child => process.kill(child.pid, 'SIGTERM'));
      expect(result.exitCode).toBe(0);
      expect(result.browserExitCode).toBe('0');
      expect(result.browserSignal).toBe('null');
    });
    it.slow()('should close the browser on SIGHUP', async state => {
      const result = await testSignal(state, child => process.kill(child.pid, 'SIGHUP'));
      expect(result.exitCode).toBe(0);
      expect(result.browserExitCode).toBe('0');
      expect(result.browserSignal).toBe('null');
    });
    it.slow()('should kill the browser on double SIGINT', async state => {
      const result = await testSignal(state, child => {
        process.kill(child.pid, 'SIGINT');
        process.kill(child.pid, 'SIGINT');
      });
      expect(result.exitCode).toBe(130);
      // TODO: ideally, we would expect the SIGKILL on the browser from
      // force kill, but that's racy with sending two signals.
    });
    // TODO: flaky - https://app.circleci.com/pipelines/github/microsoft/playwright/582/workflows/b49033ce-fe20-4029-b665-13fb331f842e/jobs/579
    it.slow().fail(FFOX && LINUX)('should kill the browser on SIGINT + SIGTERM', async state => {
      const result = await testSignal(state, child => {
        process.kill(child.pid, 'SIGINT');
        process.kill(child.pid, 'SIGTERM');
      });
      expect(result.exitCode).toBe(130);
      // TODO: ideally, we would expect the SIGKILL on the browser from
      // force kill, but that's racy with sending two signals.
    });
    // TODO: flaky!
    // - firefox: https://github.com/microsoft/playwright/pull/1911/checks?check_run_id=607148951
    // - chromium: https://travis-ci.com/github/microsoft/playwright/builds/161356178
    it.slow().fail((FFOX || CHROMIUM) && LINUX)('should kill the browser on SIGTERM + SIGINT', async state => {
      const result = await testSignal(state, child => {
        process.kill(child.pid, 'SIGTERM');
        process.kill(child.pid, 'SIGINT');
      });
      expect(result.exitCode).toBe(130);
      // TODO: ideally, we would expect the SIGKILL on the browser from
      // force kill, but that's racy with sending two signals.
    });
  });
});
