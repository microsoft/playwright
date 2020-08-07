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
const playwrightImpl = require('../../index');

const { TestServer } = require('../../utils/testserver/');
const { Connection } = require('../../lib/rpc/client/connection');
const { Transport } = require('../../lib/rpc/transport');
const { setupInProcess } = require('../../lib/rpc/inprocess');
const { setUnderTest } = require('../../lib/helper');
setUnderTest();

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

  global.registerWorkerFixture('defaultBrowserOptions', async({}, test) => {
    let executablePath = undefined;
    if (browserName === 'chromium' && process.env.CRPATH)
      executablePath = process.env.CRPATH;
    if (browserName === 'firefox' && process.env.FFPATH)
      executablePath = process.env.FFPATH;
    if (browserName === 'webkit' && process.env.WKPATH)
      executablePath = process.env.WKPATH;
    if (executablePath)
      console.error(`Using executable at ${executablePath}`);
    await test({
      handleSIGINT: false,
      slowMo: valueFromEnv('SLOW_MO', 0),
      headless: !!valueFromEnv('HEADLESS', true),
      executablePath
    });
  });

  global.registerWorkerFixture('playwright', async({}, test) => {
    if (process.env.PWCHANNEL === 'wire') {
      const connection = new Connection();
      const spawnedProcess = childProcess.fork(path.join(__dirname, '..', '..', 'lib', 'rpc', 'server'), [], {
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
    } else if (process.env.PWCHANNEL) {
      const playwright = setupInProcess(playwrightImpl);
      await test(playwright);
    } else {
      const playwright = playwrightImpl;
      playwright._toImpl = x => x;
      await test(playwright);
    }
  });

  global.registerFixture('toImpl', async ({playwright}, test) => {
    await test(playwright._toImpl);
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
