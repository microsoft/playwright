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

const path = require('path');
const childProcess = require('child_process');
const fs = require('fs');
const os = require('os');
const {promisify} = require('util');
const mkdtempAsync = promisify(fs.mkdtemp);

const playwright = require('../../index');
const { TestServer } = require('../../utils/testserver/');
const { DispatcherConnection } = require('../../lib/rpc/server/dispatcher');
const { Connection } = require('../../lib/rpc/client/connection');
const { Transport } = require('../../lib/rpc/transport');
const { PlaywrightDispatcher } = require('../../lib/rpc/server/playwrightDispatcher');
const { setUseApiName } = require('../../lib/progress');

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

  global.registerWorkerFixture('defaultBrowserOptions', async({}, test) => {
    await test({
      handleSIGINT: false,
      slowMo: valueFromEnv('SLOW_MO', 0),
      headless: !!valueFromEnv('HEADLESS', true),
    });
  });

  global.registerWorkerFixture('playwright', async({}, test) => {
    Error.stackTraceLimit = 15;
    if (process.env.PWCHANNEL) {
      setUseApiName(false);
      const connection = new Connection();
      let toImpl;
      let spawnedProcess;
      let expectExit;
      if (process.env.PWCHANNEL === 'wire') {
        spawnedProcess = childProcess.fork(path.join(__dirname, '..', '..', 'lib', 'rpc', 'server'), [], {
          stdio: 'pipe',
          detached: process.platform !== 'win32',
        });
        spawnedProcess.once('exit', (exitCode, signal) => {
          spawnedProcess = undefined;
          if (!expectExit)
            throw new Error(`Server closed with exitCode=${exitCode} signal=${signal}`);
        });
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
        const exited = new Promise(f => spawnedProcess.once('exit', f));
        expectExit = true;
        spawnedProcess.kill();
        await exited;
      }
      return;
    }
    playwright.toImpl = x => x;
    await test(playwright);
  });

  global.registerFixture('toImpl', async ({playwright}, test) => {
    await test(playwright.toImpl);
  });

  global.registerWorkerFixture('browserType', async ({playwright}, test) => {
    await test(playwright[process.env.BROWSER || 'chromium']);
  });
  
  global.registerWorkerFixture('browser', async ({browserType, defaultBrowserOptions}, test) => {
    const browser = await browserType.launch(defaultBrowserOptions);
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

  global.registerFixture('userDataDir', async ({}, test) => {
    const userDataDir = await mkdtempAsync(path.join(os.tmpdir(), 'playwright_dev_profile-'));
    try {
      await test(userDataDir);
    } finally {
      removeFolderAsync(userDataDir).catch(e => {});
    }
  });

  global.registerFixture('launchPersistent', async ({userDataDir, defaultBrowserOptions, browserType}, test) => {
    let context;
    async function launchPersistent(options) {
      if (context)
        throw new Error('can only launch one persitent context');
      context = await browserType.launchPersistentContext(userDataDir, {...defaultBrowserOptions, ...options});
      const page = context.pages()[0];
      return {context, page};
    }
    try {
      await test(launchPersistent);
    } finally {
      if (context)
        await context.close();
    }
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
