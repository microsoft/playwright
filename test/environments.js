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

const utils = require('./utils');
const fs = require('fs');
const path = require('path');
const rm = require('rimraf').sync;
const childProcess = require('child_process');
const {TestServer} = require('../utils/testserver/');
const { DispatcherConnection } = require('../lib/rpc/server/dispatcher');
const { Connection } = require('../lib/rpc/client/connection');
const { Transport } = require('../lib/rpc/transport');
const { PlaywrightDispatcher } = require('../lib/rpc/server/playwrightDispatcher');
const { setUseApiName } = require('../lib/progress');

class ServerEnvironment {
  async beforeAll(state) {
    const assetsPath = path.join(__dirname, 'assets');
    const cachedPath = path.join(__dirname, 'assets', 'cached');

    const port = 8907 + state.parallelIndex * 2;
    state.server = await TestServer.create(assetsPath, port);
    state.server.enableHTTPCache(cachedPath);
    state.server.PORT = port;
    state.server.PREFIX = `http://localhost:${port}`;
    state.server.CROSS_PROCESS_PREFIX = `http://127.0.0.1:${port}`;
    state.server.EMPTY_PAGE = `http://localhost:${port}/empty.html`;

    const httpsPort = port + 1;
    state.httpsServer = await TestServer.createHTTPS(assetsPath, httpsPort);
    state.httpsServer.enableHTTPCache(cachedPath);
    state.httpsServer.PORT = httpsPort;
    state.httpsServer.PREFIX = `https://localhost:${httpsPort}`;
    state.httpsServer.CROSS_PROCESS_PREFIX = `https://127.0.0.1:${httpsPort}`;
    state.httpsServer.EMPTY_PAGE = `https://localhost:${httpsPort}/empty.html`;
  }

  async afterAll({server, httpsServer}) {
    await Promise.all([
      server.stop(),
      httpsServer.stop(),
    ]);
  }

  async beforeEach(state) {
    state.server.reset();
    state.httpsServer.reset();
  }
}

class DefaultBrowserOptionsEnvironment {
  constructor(defaultBrowserOptions, dumpLogOnFailure, playwrightPath) {
    this._defaultBrowserOptions = defaultBrowserOptions;
    this._dumpLogOnFailure = dumpLogOnFailure;
    this._playwrightPath = playwrightPath;
    this._loggerSymbol = Symbol('DefaultBrowserOptionsEnvironment.logger');
  }

  async beforeAll(state) {
    state[this._loggerSymbol] = utils.createTestLogger(this._dumpLogOnFailure, null, 'extra');
    state.defaultBrowserOptions = {
      ...this._defaultBrowserOptions,
      logger: state[this._loggerSymbol],
    };
    state.playwrightPath = this._playwrightPath;
  }

  async beforeEach(state, testRun) {
    state[this._loggerSymbol].setTestRun(testRun);
  }

  async afterEach(state) {
    state[this._loggerSymbol].setTestRun(null);
  }
}

// simulate globalSetup per browserType that happens only once regardless of TestWorker.
const hasBeenCleaned = new Set();

class GoldenEnvironment {
  async beforeAll(state) {
    const { OUTPUT_DIR, GOLDEN_DIR } = utils.testOptions(state.browserType);
    if (!hasBeenCleaned.has(state.browserType)) {
      hasBeenCleaned.add(state.browserType);
      if (fs.existsSync(OUTPUT_DIR))
        rm(OUTPUT_DIR);
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }
    state.golden = goldenName => ({ goldenPath: GOLDEN_DIR, outputPath: OUTPUT_DIR, goldenName });
  }

  async afterAll(state) {
    delete state.golden;
  }

  async afterEach(state, testRun) {
    if (state.browser && state.browser.contexts().length !== 0) {
      if (testRun.ok())
        console.warn(`\nWARNING: test "${testRun.test().fullName()}" (${testRun.test().location()}) did not close all created contexts!\n`);
      await Promise.all(state.browser.contexts().map(context => context.close()));
    }
  }
}

class TraceTestEnvironment {
  static enableForTest(test) {
    test.setTimeout(100000000);
    test.addEnvironment(new TraceTestEnvironment());
  }

  constructor() {
    this._session = null;
  }

  async beforeEach(state, testRun) {
    const t = testRun.test();
    const inspector = require('inspector');
    const fs = require('fs');
    const util = require('util');
    const url = require('url');
    const readFileAsync = util.promisify(fs.readFile.bind(fs));
    this._session = new inspector.Session();
    this._session.connect();
    const postAsync = util.promisify(this._session.post.bind(this._session));
    await postAsync('Debugger.enable');
    const setBreakpointCommands = [];
    const N = t.body().toString().split('\n').length;
    const location = t.location();
    const lines = (await readFileAsync(location.filePath(), 'utf8')).split('\n');
    for (let line = 0; line < N; ++line) {
      const lineNumber = line + location.lineNumber();
      setBreakpointCommands.push(postAsync('Debugger.setBreakpointByUrl', {
        url: url.pathToFileURL(location.filePath()),
        lineNumber,
        condition: `console.log('${String(lineNumber + 1).padStart(6, ' ')} | ' + ${JSON.stringify(lines[lineNumber])})`,
      }).catch(e => {}));
    }
    await Promise.all(setBreakpointCommands);
  }

  async afterEach() {
    this._session.disconnect();
  }
}

class PlaywrightEnvironment {
  constructor(playwright) {
    this._playwright = playwright;
    this.spawnedProcess = undefined;
    this.expectExit = false;
  }

  name() { return 'Playwright'; };

  async beforeAll(state) {
    if (process.env.PWCHANNEL) {
      setUseApiName(false);
      const connection = new Connection();
      if (process.env.PWCHANNEL === 'wire') {
        this.spawnedProcess = childProcess.fork(path.join(__dirname, '..', 'lib', 'rpc', 'server'), [], {
          stdio: 'pipe',
          detached: process.platform !== 'win32',
        });
        this.spawnedProcess.once('exit', (exitCode, signal) => {
          this.spawnedProcess = undefined;
          if (!this.expectExit)
            throw new Error(`Server closed with exitCode=${exitCode} signal=${signal}`);
        });
        process.on('exit', () => this._killProcess());
        const transport = new Transport(this.spawnedProcess.stdin, this.spawnedProcess.stdout);
        connection.onmessage = message => transport.send(JSON.stringify(message));
        transport.onmessage = message => connection.dispatch(JSON.parse(message));
      } else {
        const dispatcherConnection = new DispatcherConnection();
        dispatcherConnection.onmessage = async message => {
          setImmediate(() => connection.dispatch(message));
        };
        connection.onmessage = async message => {
          const result = await dispatcherConnection.dispatch(message);
          await new Promise(f => setImmediate(f));
          return result;
        };
        new PlaywrightDispatcher(dispatcherConnection.rootDispatcher(), this._playwright);
        state.toImpl = x => dispatcherConnection._dispatchers.get(x._guid)._object;
      }
      state.playwright = await connection.waitForObjectWithKnownName('playwright');
    } else {
      state.toImpl = x => x;
      state.playwright = this._playwright;
    }
  }

  async afterAll(state) {
    if (this.spawnedProcess) {
      const exited = new Promise(f => this.spawnedProcess.once('exit', f));
      this.expectExit = true;
      this.spawnedProcess.kill();
      await exited;
    }
    delete state.playwright;
  }

  _killProcess() {
    if (this.spawnedProcess && this.spawnedProcess.pid) {
      this.expectExit = true;
      try {
        if (process.platform === 'win32')
          childProcess.execSync(`taskkill /pid ${this.spawnedProcess.pid} /T /F`);
        else
          process.kill(-this.spawnedProcess.pid, 'SIGKILL');
      } catch (e) {
        // the process might have already stopped
      }
    }
  }
}

class BrowserTypeEnvironment {
  constructor(browserName) {
    this._browserName = browserName;
  }

  async beforeAll(state) {
    state.browserType = state.playwright[this._browserName];
  }

  async afterAll(state) {
    delete state.browserType;
  }
}

class BrowserEnvironment {
  constructor(launchOptions, dumpLogOnFailure) {
    this._launchOptions = launchOptions;
    this._dumpLogOnFailure = dumpLogOnFailure;
    this._loggerSymbol = Symbol('BrowserEnvironment.logger');
  }

  async beforeAll(state) {
    state[this._loggerSymbol] = utils.createTestLogger(this._dumpLogOnFailure);
    state.browser = await state.browserType.launch({
      ...this._launchOptions,
      logger: state[this._loggerSymbol],
    });
  }

  async afterAll(state) {
    await state.browser.close();
    delete state.browser;
  }

  async beforeEach(state, testRun) {
    state[this._loggerSymbol].setTestRun(testRun);
  }

  async afterEach(state, testRun) {
    state[this._loggerSymbol].setTestRun(null);
  }
}

class PageEnvironment {
  async beforeEach(state) {
    state.context = await state.browser.newContext();
    state.page = await state.context.newPage();
  }

  async afterEach(state) {
    await state.context.close();
    state.context = null;
    state.page = null;
  }
}

module.exports = {
  ServerEnvironment,
  GoldenEnvironment,
  TraceTestEnvironment,
  DefaultBrowserOptionsEnvironment,
  PlaywrightEnvironment,
  BrowserTypeEnvironment,
  BrowserEnvironment,
  PageEnvironment,
};
