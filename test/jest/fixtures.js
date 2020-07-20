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


/** @typedef {import('../..').Browser} Browser */
/** @typedef {import('../..').BrowserType} BrowserType */
/** @typedef {import('../..').BrowserServer} BrowserServer */
/** @typedef {import('../..').BrowserContext} BrowserContext */

const path = require('path');
const childProcess = require('child_process');

const playwright = require('../../index');
const { TestServer } = require('../../utils/testserver/');
const { DispatcherConnection } = require('../../lib/rpc/server/dispatcher');
const { Connection } = require('../../lib/rpc/client/connection');
const { Transport } = require('../../lib/rpc/transport');
const { PlaywrightDispatcher } = require('../../lib/rpc/server/playwrightDispatcher');
const { setUseApiName } = require('../../lib/progress');

const browserName = process.env.BROWSER || 'chromium';

module.exports = function registerFixtures(global) {
  global.registerWorkerFixture('parallelIndex', async ({}, test) => {
    await test(process.env.JEST_WORKER_ID - 1);
  });
  global.registerWorkerFixture('http_server', async ({parallelIndex}, test) => {
    const assetsPath = path.join(__dirname, '..', 'assets');
    const cachedPath = path.join(__dirname, '..', 'assets', 'cached');

    const port = 8907 + parallelIndex * 2;
    const server = await TestServer.create(assetsPath, port);
    server.enableHTTPCache(cachedPath);
    server.PORT = port;
    server.PREFIX = `http://localhost:${port}`;
    server.CROSS_PROCESS_PREFIX = `http://127.0.0.1:${port}`;
    server.EMPTY_PAGE = `http://localhost:${port}/empty.html`;

    const httpsPort = port + 1;
    const httpsServer = await TestServer.createHTTPS(assetsPath, httpsPort);
    httpsServer.enableHTTPCache(cachedPath);
    httpsServer.PORT = httpsPort;
    httpsServer.PREFIX = `https://localhost:${httpsPort}`;
    httpsServer.CROSS_PROCESS_PREFIX = `https://127.0.0.1:${httpsPort}`;
    httpsServer.EMPTY_PAGE = `https://localhost:${httpsPort}/empty.html`;

    await test({server, httpsServer});

    await Promise.all([
      server.stop(),
      httpsServer.stop(),
    ]);
  });

  const defaultBrowserOptions = (function () {
    let executablePath = undefined;
    if (browserName === 'chromium' && process.env.CRPATH)
      executablePath = process.env.CRPATH;
    if (browserName === 'firefox' && process.env.FFPATH)
      executablePath = process.env.FFPATH;
    if (browserName === 'webkit' && process.env.WKPATH)
      executablePath = process.env.WKPATH;
    if (executablePath)
      console.error(`Using executable at ${executablePath}`);
    return {
      handleSIGINT: false,
      slowMo: valueFromEnv('SLOW_MO', 0),
      headless: !!valueFromEnv('HEADLESS', true),
      executablePath
    };
  })();

  global.registerWorkerFixture('playwright', async({}, test) => {
    Error.stackTraceLimit = 15;
    if (process.env.PWCHANNEL) {
      setUseApiName(false);
      const connection = new Connection();
      let toImpl;
      let spawnedProcess;
      let onExit;
      if (process.env.PWCHANNEL === 'wire') {
        spawnedProcess = childProcess.fork(path.join(__dirname, '..', '..', 'lib', 'rpc', 'server'), [], {
          stdio: 'pipe',
          detached: true,
        });
        spawnedProcess.unref();
        onExit = (exitCode, signal) => {
          throw new Error(`Server closed with exitCode=${exitCode} signal=${signal}`);
        };
        spawnedProcess.on('exit', onExit);
        const transport = new Transport(spawnedProcess.stdin, spawnedProcess.stdout);
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
        new PlaywrightDispatcher(dispatcherConnection.rootDispatcher(), playwright);
        toImpl = x => dispatcherConnection._dispatchers.get(x._guid)._object;
      }

      const playwrightObject = await connection.waitForObjectWithKnownName('playwright');
      playwrightObject.toImpl = toImpl;
      await test(playwrightObject);
      if (spawnedProcess) {
        spawnedProcess.removeListener('exit', onExit);
        spawnedProcess.stdin.destroy();
        spawnedProcess.stdout.destroy();
        spawnedProcess.stderr.destroy();
      }
    } else {
      playwright.toImpl = x => x;
      await test(playwright);
    }
  });

  global.registerFixture('toImpl', async ({playwright}, test) => {
    await test(playwright.toImpl);
  });

  /** @type {Set<Set<Browser|BrowserServer|BrowserContext>>} */
  const allClosables = new Set();

  process.on('SIGINT', () => {
    const promises = [];
    for (const closables of allClosables) {
      for (const closable of closables)
        promises.push(closable.close());
    }
    Promise.all(promises).then(() => process.exit(130));
  });

  global.registerWorkerFixture('browserType', async ({playwright}, test) => {
    /** @type {BrowserType} */
    const browserType = playwright[process.env.BROWSER || 'chromium'];
    /** @type {Set<Browser|BrowserServer|BrowserContext>} */
    const closables = new Set();
    /** @type {BrowserType} */
    const wrapper = {
      ...browserType,
      async connect(options) {
        const browser = await browserType.connect(options);
        closables.add(browser);
        browser.on('disconnected', () => closables.delete(browser));
        return browser;
      },
      executablePath() {
        return browserType.executablePath();
      },
      async launch(options) {
        const browser = await browserType.launch(launchOptions(options));
        closables.add(browser);
        browser.on('disconnected', () => closables.delete(browser));
        return browser;
      },
      async launchPersistentContext(userDataDir, options) {
        const context = await browserType.launchPersistentContext(userDataDir, launchOptions(options));
        closables.add(context);
        context.on('close', () => closables.delete(context));
        return context;
      },
      async launchServer(options) {
        const server = await browserType.launchServer(launchOptions(options));
        closables.add(server);
        server.on('close', () => closables.delete(server));
        return server;
      },
      name() {
        return browserName;
      }
    };
    allClosables.add(closables);
    wrapper._defaultArgs = (options, ...args) => {
      return browserType._defaultArgs(launchOptions(options), ...args);
    };
    try {
      await test(wrapper);
    } finally {
      for (const browser of closables)
        await browser.close();
      allClosables.delete(closables);
    }

    function launchOptions(options) {
      return {...defaultBrowserOptions, ...options};
    }
  });

  global.registerWorkerFixture('browser', async ({browserType}, test) => {
    const browser = await browserType.launch();
    try {
      await test(browser);
      if (browser.contexts().length !== 0) {
        console.warn(`\nWARNING: test did not close all created contexts! ${new Error().stack}\n`);
        await Promise.all(browser.contexts().map(context => context.close()));
      }
    } finally {
      await browser.close();
    }
  });

  global.registerFixture('context', async ({browser}, test) => {
    const context = await browser.newContext();
    try {
      await test(context);
    } finally {
      await context.close();
    }
  });

  global.registerFixture('page', async ({context}, test) => {
    const page = await context.newPage();
    await test(page);
  });

  global.registerFixture('server', async ({http_server}, test) => {
    http_server.server.reset();
    await test(http_server.server);
  });

  global.registerFixture('httpsServer', async ({http_server}, test) => {
    http_server.httpsServer.reset();
    await test(http_server.httpsServer);
  });
}

function valueFromEnv(name, defaultValue) {
  if (!(name in process.env))
    return defaultValue;
  return JSON.parse(process.env[name]);
}
