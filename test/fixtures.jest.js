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
const {FFOX, CHROMIUM, WEBKIT, WIN, LINUX, HEADLESS, CHANNEL} = testOptions;

const playwrightPath = path.join(__dirname, '..');

class Wrapper {
  constructor(browserType, defaultBrowserOptions, extraOptions) {
    this._output = new Map();
    this._outputCallback = new Map();
    this._launchTwo = extraOptions && extraOptions.launchTwo;

    this._browserType = browserType;
    const launchOptions = {...defaultBrowserOptions,
      handleSIGINT: true,
      handleSIGTERM: true,
      handleSIGHUP: true,
      executablePath: browserType.executablePath(),
      logger: undefined,
    };
    const options = {
      playwrightPath,
      browserTypeName: browserType.name(),
      launchOptions,
      ...extraOptions,
    };
    this._child = spawn('node', [path.join(__dirname, 'fixtures', 'closeme.js'), JSON.stringify(options)]);
    this._child.on('error', (...args) => console.log("ERROR", ...args));
    this._exitPromise = new Promise(resolve => this._child.on('exit', resolve));

    let outputString = '';
    this._child.stdout.on('data', data => {
      outputString += data.toString();
      // Uncomment to debug.
      // console.log(data.toString());
      let match;
      while (match = outputString.match(/\(([^()]+)=>([^()]+)\)/)) {
        const key = match[1];
        const value = match[2];
        this._addOutput(key, value);
        outputString = outputString.substring(match.index + match[0].length);
      }
    });
  }

  _addOutput(key, value) {
    this._output.set(key, value);
    const cb = this._outputCallback.get(key);
    this._outputCallback.delete(key);
    if (cb)
      cb();
  }

  async out(key) {
    if (!this._output.has(key))
      await new Promise(f => this._outputCallback.set(key, f));
    return this._output.get(key);
  }

  async connect() {
    const promises = [];
    promises.push((await this._connect('wsEndpoint')).promise);
    if (this._launchTwo)
      promises.push((await this._connect('wsEndpoint2')).promise);
    this._exitAndDisconnectPromise = Promise.all([
      this._exitPromise,
      ...promises,
    ]).then(([exitCode]) => exitCode);
  }

  async _connect(key) {
    const wsEndpoint = await this.out(key);
    const browser = await this._browserType.connect({ wsEndpoint });
    return { promise: new Promise(resolve => browser.once('disconnected', resolve)) };
  }

  child() {
    return this._child;
  }

  async childExitCode() {
    return await this._exitAndDisconnectPromise;
  }
}

registerFixture('wrapper', async ({browserType, defaultBrowserOptions}, test) => {
  const wrapper = new Wrapper(browserType, defaultBrowserOptions);
  await wrapper.connect();
  await test(wrapper);
});

registerFixture('stallingWrapper', async ({browserType, defaultBrowserOptions}, test) => {
  const wrapper = new Wrapper(browserType, defaultBrowserOptions, { stallOnClose: true });
  await wrapper.connect();
  await test(wrapper);
});

registerFixture('doubleWrapper', async ({browserType, defaultBrowserOptions}, test) => {
  const wrapper = new Wrapper(browserType, defaultBrowserOptions, { launchTwo: true });
  await wrapper.connect();
  await test(wrapper);
});

describe('Fixtures', function() {
  it.slow()('should close the browser when the node process closes', async ({wrapper}) => {
    if (WIN)
      execSync(`taskkill /pid ${wrapper.child().pid} /T /F`);
    else
      process.kill(wrapper.child().pid);
    expect(await wrapper.childExitCode()).toBe(WIN ? 1 : 0);
    // We might not get browser exitCode in time when killing the parent node process,
    // so we don't check it here.
  });

  describe.skip(WIN || !HEADLESS)('signals', () => {
    // Cannot reliably send signals on Windows.
    it.slow()('should report browser close signal', async ({wrapper}) => {
      const pid = await wrapper.out('pid');
      process.kill(-pid, 'SIGTERM');
      expect(await wrapper.out('exitCode')).toBe('null');
      expect(await wrapper.out('signal')).toBe('SIGTERM');
      process.kill(wrapper.child().pid);
      await wrapper.childExitCode();
    });
    it.slow()('should report browser close signal 2', async ({wrapper}) => {
      const pid = await wrapper.out('pid');
      process.kill(-pid, 'SIGKILL');
      expect(await wrapper.out('exitCode')).toBe('null');
      expect(await wrapper.out('signal')).toBe('SIGKILL');
      process.kill(wrapper.child().pid);
      await wrapper.childExitCode();
    });
    it.slow()('should close the browser on SIGINT', async ({wrapper}) => {
      process.kill(wrapper.child().pid, 'SIGINT');
      expect(await wrapper.out('exitCode')).toBe('0');
      expect(await wrapper.out('signal')).toBe('null');
      expect(await wrapper.childExitCode()).toBe(130);
    });
    it.fail(!CHANNEL).slow()('should close two browsers on SIGINT', async ({doubleWrapper}) => {
      const wrapper = doubleWrapper;
      process.kill(wrapper.child().pid, 'SIGINT');
      expect(await wrapper.out('exitCode')).toBe('0');
      expect(await wrapper.out('signal')).toBe('null');
      expect(await wrapper.out('exitCode2')).toBe('0');
      expect(await wrapper.out('signal2')).toBe('null');
      expect(await wrapper.childExitCode()).toBe(130);
    });
    it.slow()('should close the browser on SIGTERM', async ({wrapper}) => {
      process.kill(wrapper.child().pid, 'SIGTERM');
      expect(await wrapper.out('exitCode')).toBe('0');
      expect(await wrapper.out('signal')).toBe('null');
      expect(await wrapper.childExitCode()).toBe(0);
    });
    it.fail(!CHANNEL).slow()('should close two browsers on SIGTERM', async ({doubleWrapper}) => {
      const wrapper = doubleWrapper;
      process.kill(wrapper.child().pid, 'SIGTERM');
      expect(await wrapper.out('exitCode')).toBe('0');
      expect(await wrapper.out('signal')).toBe('null');
      expect(await wrapper.out('exitCode2')).toBe('0');
      expect(await wrapper.out('signal2')).toBe('null');
      expect(await wrapper.childExitCode()).toBe(0);
    });
    it.slow()('should close the browser on SIGHUP', async ({wrapper}) => {
      process.kill(wrapper.child().pid, 'SIGHUP');
      expect(await wrapper.out('exitCode')).toBe('0');
      expect(await wrapper.out('signal')).toBe('null');
      expect(await wrapper.childExitCode()).toBe(0);
    });
    it.slow()('should kill the browser on double SIGINT', async ({stallingWrapper}) => {
      const wrapper = stallingWrapper;
      process.kill(wrapper.child().pid, 'SIGINT');
      await wrapper.out('stalled');
      process.kill(wrapper.child().pid, 'SIGINT');
      expect(await wrapper.out('exitCode')).toBe('null');
      expect(await wrapper.out('signal')).toBe('SIGKILL');
      expect(await wrapper.childExitCode()).toBe(130);
    });
    it.slow()('should kill the browser on SIGINT + SIGTERM', async ({stallingWrapper}) => {
      const wrapper = stallingWrapper;
      process.kill(wrapper.child().pid, 'SIGINT');
      await wrapper.out('stalled');
      process.kill(wrapper.child().pid, 'SIGTERM');
      expect(await wrapper.out('exitCode')).toBe('null');
      expect(await wrapper.out('signal')).toBe('SIGKILL');
      expect(await wrapper.childExitCode()).toBe(0);
    });
    it.slow()('should kill the browser on SIGTERM + SIGINT', async ({stallingWrapper}) => {
      const wrapper = stallingWrapper;
      process.kill(wrapper.child().pid, 'SIGTERM');
      await wrapper.out('stalled');
      process.kill(wrapper.child().pid, 'SIGINT');
      expect(await wrapper.out('exitCode')).toBe('null');
      expect(await wrapper.out('signal')).toBe('SIGKILL');
      expect(await wrapper.childExitCode()).toBe(130);
    });
  });
});

describe('StackTrace', () => {
  it('caller file path', async ({}) => {
    const stackTrace = require(path.join(playwrightPath, 'lib', 'utils', 'stackTrace'));
    const callme = require('./fixtures/callback');
    const filePath = callme(() => {
      return stackTrace.getCallerFilePath(path.join(__dirname, 'fixtures') + path.sep);
    });
    expect(filePath).toBe(__filename);
  });
});
