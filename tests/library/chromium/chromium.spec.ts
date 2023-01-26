/**
 * Copyright 2018 Google Inc. All rights reserved.
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

import { contextTest as test, expect } from '../../config/browserTest';
import { playwrightTest } from '../../config/browserTest';
import http from 'http';
import fs from 'fs';
import { getUserAgent } from '../../../packages/playwright-core/lib/utils/userAgent';
import { suppressCertificateWarning } from '../../config/utils';

test('should create a worker from a service worker', async ({ page, server }) => {
  const [worker] = await Promise.all([
    page.context().waitForEvent('serviceworker'),
    page.goto(server.PREFIX + '/serviceworkers/empty/sw.html')
  ]);
  expect(await worker.evaluate(() => self.toString())).toBe('[object ServiceWorkerGlobalScope]');
});

test('should create a worker from service worker with noop routing', async ({ context, page, server }) => {
  await context.route('**', route => route.continue());
  const [worker] = await Promise.all([
    page.context().waitForEvent('serviceworker'),
    page.goto(server.PREFIX + '/serviceworkers/empty/sw.html')
  ]);
  expect(await worker.evaluate(() => self.toString())).toBe('[object ServiceWorkerGlobalScope]');
});

test('should emit new service worker on update', async ({ context, page, server }) => {
  let version = 0;
  server.setRoute('/worker.js', (req, res) => {
    res.writeHead(200, 'OK', { 'Content-Type': 'text/javascript' });
    res.write(`self.PW_VERSION = ${version++};`);
    res.end();
  });

  server.setRoute('/home', (req, res) => {
    res.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Service Worker Update Demo</title>
        </head>
        <body>
          <button id="update" disabled>update service worker</button>
          <script>
            const updateBtn = document.getElementById('update');
            updateBtn.addEventListener('click', evt => {
              evt.preventDefault();
              registration.then(r => r.update());
            });

            const registration = new Promise(r => navigator.serviceWorker.register('/worker.js').then(r));
            registration.then(() => updateBtn.disabled = false);
          </script>
        </body>
      </html>
    `);
    res.end();
  });

  const [sw] = await Promise.all([
    context.waitForEvent('serviceworker'),
    page.goto(server.PREFIX + '/home'),
  ]);

  await expect.poll(() => sw.evaluate(() => self['PW_VERSION'])).toBe(0);

  const [updatedSW] = await Promise.all([
    context.waitForEvent('serviceworker'),
    page.click('#update'),
  ]);

  await expect.poll(() => updatedSW.evaluate(() => self['PW_VERSION'])).toBe(1);
});

test.describe('http credentials', () => {
  test.use({ httpCredentials: { username: 'user',  password: 'pass' } });

  test('httpCredentials', async ({ context, page, server }) => {
    server.setAuth('/serviceworkers/fetch/sw.html', 'user', 'pass');
    server.setAuth('/empty.html', 'user', 'pass');
    const [worker] = await Promise.all([
      context.waitForEvent('serviceworker'),
      page.goto(server.PREFIX + '/serviceworkers/fetch/sw.html')
    ]);

    await page.evaluate(() => window['activationPromise']);
    expect(await worker.evaluate(() => fetch('/empty.html').then(r => r.status))).toBe(200);
  });
});

test('serviceWorkers() should return current workers', async ({ page, server }) => {
  const context = page.context();
  const [worker1] = await Promise.all([
    context.waitForEvent('serviceworker'),
    page.goto(server.PREFIX + '/serviceworkers/empty/sw.html')
  ]);
  let workers = context.serviceWorkers();
  expect(workers.length).toBe(1);

  const [worker2] = await Promise.all([
    context.waitForEvent('serviceworker'),
    page.goto(server.CROSS_PROCESS_PREFIX + '/serviceworkers/empty/sw.html')
  ]);
  workers = context.serviceWorkers();
  expect(workers.length).toBe(2);
  expect(workers).toContain(worker1);
  expect(workers).toContain(worker2);
});

test('should not create a worker from a shared worker', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  let serviceWorkerCreated;
  page.context().once('serviceworker', () => serviceWorkerCreated = true);
  await page.evaluate(() => {
    new SharedWorker('data:text/javascript,console.log("hi")');
  });
  expect(serviceWorkerCreated).not.toBeTruthy();
});

test('Page.route should work with intervention headers', async ({ server, page }) => {
  server.setRoute('/intervention', (req, res) => res.end(`
    <script>
      document.write('<script src="${server.CROSS_PROCESS_PREFIX}/intervention.js">' + '</scr' + 'ipt>');
    </script>
  `));
  server.setRedirect('/intervention.js', '/redirect.js');
  let serverRequest = null;
  server.setRoute('/redirect.js', (req, res) => {
    serverRequest = req;
    res.end('console.log(1);');
  });

  await page.route('*', route => route.continue());
  await page.goto(server.PREFIX + '/intervention');
  // Check for feature URL substring rather than https://www.chromestatus.com to
  // make it work with Edgium.
  expect(serverRequest.headers.intervention).toContain('feature/5718547946799104');
});

playwrightTest('should close service worker together with the context', async ({ browserType, server }) => {
  const browser = await browserType.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  const [worker] = await Promise.all([
    context.waitForEvent('serviceworker'),
    page.goto(server.PREFIX + '/serviceworkers/empty/sw.html')
  ]);
  const messages = [];
  context.on('close', () => messages.push('context'));
  worker.on('close', () => messages.push('worker'));
  await context.close();
  expect(messages.join('|')).toBe('worker|context');
  await browser.close();
});

playwrightTest('should connect to an existing cdp session', async ({ browserType }, testInfo) => {
  const port = 9339 + testInfo.workerIndex;
  const browserServer = await browserType.launch({
    args: ['--remote-debugging-port=' + port]
  });
  try {
    const cdpBrowser = await browserType.connectOverCDP({
      endpointURL: `http://127.0.0.1:${port}/`,
    });
    const contexts = cdpBrowser.contexts();
    expect(contexts.length).toBe(1);
    await cdpBrowser.close();
  } finally {
    await browserServer.close();
  }
});

playwrightTest('should cleanup artifacts dir after connectOverCDP disconnects due to ws close', async ({ browserType, toImpl, mode }, testInfo) => {
  const port = 9339 + testInfo.workerIndex;
  const browserServer = await browserType.launch({
    args: ['--remote-debugging-port=' + port]
  });
  const cdpBrowser = await browserType.connectOverCDP({
    endpointURL: `http://127.0.0.1:${port}/`,
  });
  const dir = toImpl(cdpBrowser).options.artifactsDir;
  const exists1 = fs.existsSync(dir);
  await Promise.all([
    new Promise(f => cdpBrowser.on('disconnected', f)),
    browserServer.close()
  ]);
  const exists2 = fs.existsSync(dir);
  expect(exists1).toBe(true);
  expect(exists2).toBe(false);
});

playwrightTest('should connectOverCDP and manage downloads in default context', async ({ browserType, toImpl, mode, server }, testInfo) => {
  server.setRoute('/downloadWithFilename', (req, res) => {
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', 'attachment; filename=file.txt');
    res.end(`Hello world`);
  });

  const port = 9339 + testInfo.workerIndex;
  const browserServer = await browserType.launch({
    args: ['--remote-debugging-port=' + port]
  });

  try {
    const browser = await browserType.connectOverCDP({
      endpointURL: `http://127.0.0.1:${port}/`,
    });
    const page = await browser.contexts()[0].newPage();
    await page.setContent(`<a href="${server.PREFIX}/downloadWithFilename">download</a>`);

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('a')
    ]);
    expect(download.page()).toBe(page);
    expect(download.url()).toBe(`${server.PREFIX}/downloadWithFilename`);
    expect(download.suggestedFilename()).toBe(`file.txt`);

    const userPath = testInfo.outputPath('download.txt');
    await download.saveAs(userPath);
    expect(fs.existsSync(userPath)).toBeTruthy();
    expect(fs.readFileSync(userPath).toString()).toBe('Hello world');
  } finally {
    await browserServer.close();
  }
});

playwrightTest('should connect to an existing cdp session twice', async ({ browserType, server }, testInfo) => {
  const port = 9339 + testInfo.workerIndex;
  const browserServer = await browserType.launch({
    args: ['--remote-debugging-port=' + port]
  });
  try {
    const cdpBrowser1 = await browserType.connectOverCDP({
      endpointURL: `http://127.0.0.1:${port}/`,
    });
    const cdpBrowser2 = await browserType.connectOverCDP({
      endpointURL: `http://127.0.0.1:${port}/`,
    });
    const contexts1 = cdpBrowser1.contexts();
    expect(contexts1.length).toBe(1);
    const [context1] = contexts1;
    const page1 = await context1.newPage();
    await page1.goto(server.EMPTY_PAGE);

    const contexts2 = cdpBrowser2.contexts();
    expect(contexts2.length).toBe(1);
    const [context2] = contexts2;
    const page2 = await context2.newPage();
    await page2.goto(server.EMPTY_PAGE);

    expect(context1.pages().length).toBe(2);
    expect(context2.pages().length).toBe(2);

    await cdpBrowser1.close();
    await cdpBrowser2.close();
  } finally {
    await browserServer.close();
  }
});

playwrightTest('should connect to existing page with iframe and navigate', async ({ browserType, server }, testInfo) => {
  const port = 9339 + testInfo.workerIndex;
  const browserServer = await browserType.launch({
    args: ['--remote-debugging-port=' + port]
  });
  try {
    {
      const context1 = await browserServer.newContext();
      const page = await context1.newPage();
      await page.goto(server.PREFIX + '/frames/one-frame.html');
    }
    const cdpBrowser = await browserType.connectOverCDP(`http://127.0.0.1:${port}/`);
    const contexts = cdpBrowser.contexts();
    expect(contexts.length).toBe(1);
    await contexts[0].pages()[0].goto(server.EMPTY_PAGE);
    await cdpBrowser.close();
  } finally {
    await browserServer.close();
  }
});

playwrightTest('should connect to existing service workers', async ({ browserType, server }, testInfo) => {
  const port = 9339 + testInfo.workerIndex;
  const browserServer = await browserType.launch({
    args: ['--remote-debugging-port=' + port]
  });
  try {
    const cdpBrowser1 = await browserType.connectOverCDP({
      endpointURL: `http://127.0.0.1:${port}`,
    });
    const context = cdpBrowser1.contexts()[0];
    const page = await cdpBrowser1.contexts()[0].newPage();
    const [worker] = await Promise.all([
      context.waitForEvent('serviceworker'),
      page.goto(server.PREFIX + '/serviceworkers/empty/sw.html')
    ]);
    expect(await worker.evaluate(() => self.toString())).toBe('[object ServiceWorkerGlobalScope]');
    await cdpBrowser1.close();

    const cdpBrowser2 = await browserType.connectOverCDP({
      endpointURL: `http://127.0.0.1:${port}`,
    });
    const context2 = cdpBrowser2.contexts()[0];
    expect(context2.serviceWorkers().length).toBe(1);
    await cdpBrowser2.close();
  } finally {
    await browserServer.close();
  }
});

playwrightTest('should connect over a ws endpoint', async ({ browserType, server }, testInfo) => {
  const port = 9339 + testInfo.workerIndex;
  const browserServer = await browserType.launch({
    args: ['--remote-debugging-port=' + port]
  });
  try {
    const json = await new Promise<string>((resolve, reject) => {
      http.get(`http://127.0.0.1:${port}/json/version/`, resp => {
        let data = '';
        resp.on('data', chunk => data += chunk);
        resp.on('end', () => resolve(data));
      }).on('error', reject);
    });
    const cdpBrowser = await browserType.connectOverCDP({
      endpointURL: JSON.parse(json).webSocketDebuggerUrl,
    });
    const contexts = cdpBrowser.contexts();
    expect(contexts.length).toBe(1);
    await cdpBrowser.close();

    // also connect with the depercreated wsEndpoint option
    const cdpBrowser2 = await browserType.connectOverCDP({
      wsEndpoint: JSON.parse(json).webSocketDebuggerUrl,
    });
    const contexts2 = cdpBrowser2.contexts();
    expect(contexts2.length).toBe(1);
    await cdpBrowser2.close();
  } finally {
    await browserServer.close();
  }
});

playwrightTest('should send extra headers with connect request', async ({ browserType, server }, testInfo) => {
  {
    const [request] = await Promise.all([
      server.waitForWebSocketConnectionRequest(),
      browserType.connectOverCDP({
        wsEndpoint: `ws://localhost:${server.PORT}/ws`,
        headers: {
          'User-Agent': 'Playwright',
          'foo': 'bar',
        },
        timeout: 100,
      }).catch(() => {})
    ]);
    expect(request.headers['user-agent']).toBe('Playwright');
    expect(request.headers['foo']).toBe('bar');
  }
  {
    const [request] = await Promise.all([
      server.waitForWebSocketConnectionRequest(),
      browserType.connectOverCDP({
        endpointURL: `ws://localhost:${server.PORT}/ws`,
        headers: {
          'User-Agent': 'Playwright',
          'foo': 'bar',
        },
        timeout: 100,
      }).catch(() => {})
    ]);
    expect(request.headers['user-agent']).toBe('Playwright');
    expect(request.headers['foo']).toBe('bar');
  }
});

playwrightTest('should send default User-Agent header with connect request', async ({ browserType, server }, testInfo) => {
  {
    const [request] = await Promise.all([
      server.waitForWebSocketConnectionRequest(),
      browserType.connectOverCDP({
        wsEndpoint: `ws://localhost:${server.PORT}/ws`,
        headers: {
          'foo': 'bar',
        },
        timeout: 100,
      }).catch(() => {})
    ]);
    expect(request.headers['user-agent']).toBe(getUserAgent());
    expect(request.headers['foo']).toBe('bar');
  }
});

playwrightTest('should report all pages in an existing browser', async ({ browserType }, testInfo) => {
  const port = 9339 + testInfo.workerIndex;
  const browserServer = await browserType.launch({
    args: ['--remote-debugging-port=' + port]
  });
  try {
    const cdpBrowser = await browserType.connectOverCDP({
      endpointURL: `http://127.0.0.1:${port}/`,
    });
    const contexts = cdpBrowser.contexts();
    expect(contexts.length).toBe(1);
    for (let i = 0; i < 3; i++)
      await contexts[0].newPage();
    await cdpBrowser.close();

    const cdpBrowser2 = await browserType.connectOverCDP({
      endpointURL: `http://127.0.0.1:${port}/`,
    });
    expect(cdpBrowser2.contexts()[0].pages().length).toBe(3);

    await cdpBrowser2.close();
  } finally {
    await browserServer.close();
  }
});

playwrightTest('should connect via https', async ({ browserType, httpsServer, mode }, testInfo) => {
  test.skip(mode !== 'default'); // Out of process transport does not allow us to set env vars dynamically.
  const port = 9339 + testInfo.workerIndex;
  const browserServer = await browserType.launch({
    args: ['--remote-debugging-port=' + port]
  });
  const json = await new Promise<string>((resolve, reject) => {
    http.get(`http://127.0.0.1:${port}/json/version/`, resp => {
      let data = '';
      resp.on('data', chunk => data += chunk);
      resp.on('end', () => resolve(data));
    }).on('error', reject);
  });
  httpsServer.setRoute('/json/version/', (req, res) => {
    res.writeHead(200);
    res.end(json);
  });
  const oldValue = process.env['NODE_TLS_REJECT_UNAUTHORIZED'];
  // https://stackoverflow.com/a/21961005/552185
  process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';
  suppressCertificateWarning();
  try {
    const cdpBrowser = await browserType.connectOverCDP(`https://localhost:${httpsServer.PORT}/`);
    const contexts = cdpBrowser.contexts();
    expect(contexts.length).toBe(1);
    for (let i = 0; i < 3; i++)
      await contexts[0].newPage();
    await cdpBrowser.close();
  } finally {
    process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = oldValue;
    await browserServer.close();
  }
});

playwrightTest('should return valid browser from context.browser()', async ({ browserType }, testInfo) => {
  const port = 9339 + testInfo.workerIndex;
  const browserServer = await browserType.launch({
    args: ['--remote-debugging-port=' + port]
  });
  try {
    const cdpBrowser = await browserType.connectOverCDP({
      endpointURL: `http://127.0.0.1:${port}/`,
    });
    const contexts = cdpBrowser.contexts();
    expect(contexts.length).toBe(1);
    expect(contexts[0].browser()).toBe(cdpBrowser);

    const context2 = await cdpBrowser.newContext();
    expect(context2.browser()).toBe(cdpBrowser);

    await cdpBrowser.close();
  } finally {
    await browserServer.close();
  }
});

test('should report an expected error when the endpointURL returns a non-expected status code', async ({ browserType, server }) => {
  server.setRoute('/json/version/', (req, resp) => {
    resp.statusCode = 404;
    resp.end(JSON.stringify({
      webSocketDebuggerUrl: 'dont-use-me',
    }));
  });
  await expect(browserType.connectOverCDP({
    endpointURL: server.PREFIX,
  })).rejects.toThrowError(`browserType.connectOverCDP: Unexpected status 404 when connecting to ${server.PREFIX}/json/version/`);
});

test('should report an expected error when the endpoint URL JSON webSocketDebuggerUrl is undefined', async ({ browserType, server }) => {
  server.setRoute('/json/version/', (req, resp) => {
    resp.end(JSON.stringify({
      webSocketDebuggerUrl: undefined,
    }));
  });
  await expect(browserType.connectOverCDP({
    endpointURL: server.PREFIX,
  })).rejects.toThrowError('browserType.connectOverCDP: Invalid URL');
});

playwrightTest('should connect to an existing cdp session when passed as a first argument', async ({ browserType }, testInfo) => {
  const port = 9339 + testInfo.workerIndex;
  const browserServer = await browserType.launch({
    args: ['--remote-debugging-port=' + port]
  });
  try {
    const cdpBrowser = await browserType.connectOverCDP(`http://127.0.0.1:${port}/`);
    const contexts = cdpBrowser.contexts();
    expect(contexts.length).toBe(1);
    await cdpBrowser.close();
  } finally {
    await browserServer.close();
  }
});

playwrightTest('should use proxy with connectOverCDP', async ({ browserType, server }, testInfo) => {
  server.setRoute('/target.html', async (req, res) => {
    res.end('<html><title>Served by the proxy</title></html>');
  });
  const port = 9339 + testInfo.workerIndex;
  const browserServer = await browserType.launch({
    args: ['--remote-debugging-port=' + port, ...(process.platform === 'win32' ? ['--proxy-server=some-value'] : [])]
  });
  try {
    const cdpBrowser = await browserType.connectOverCDP(`http://127.0.0.1:${port}/`);
    const context = await cdpBrowser.newContext({
      proxy: { server: `localhost:${server.PORT}` }
    });
    const page = await context.newPage();
    await page.goto('http://non-existent.com/target.html');
    expect(await page.title()).toBe('Served by the proxy');
    await cdpBrowser.close();
  } finally {
    await browserServer.close();
  }
});

playwrightTest('should be able to connect via localhost', async ({ browserType }, testInfo) => {
  const port = 9339 + testInfo.workerIndex;
  const browserServer = await browserType.launch({
    args: ['--remote-debugging-port=' + port]
  });
  try {
    const cdpBrowser = await browserType.connectOverCDP(`http://localhost:${port}`);
    const contexts = cdpBrowser.contexts();
    expect(contexts.length).toBe(1);
    await cdpBrowser.close();
  } finally {
    await browserServer.close();
  }
});

playwrightTest('should pass args with spaces', async ({ browserType, createUserDataDir }, testInfo) => {
  const browser = await browserType.launchPersistentContext(await createUserDataDir(), {
    args: ['--user-agent=I am Foo']
  });
  const page = await browser.newPage();
  const userAgent = await page.evaluate(() => navigator.userAgent);
  await browser.close();
  expect(userAgent).toBe('I am Foo');
});

test.describe('should emit page-level network events with service worker fetch handler', () => {
  test.describe('when not using routing', () => {
    test('successful request', async ({ page, server }) => {
      await page.goto(server.PREFIX + '/serviceworkers/fetchdummy/sw.html');
      await page.evaluate(() => window['activationPromise']);

      const [pageReq, pageResp, /* pageFinished */, swResponse] = await Promise.all([
        page.waitForEvent('request'),
        page.waitForEvent('response'),
        page.waitForEvent('requestfinished'),
        page.evaluate(() => window['fetchDummy']('foo')),
      ]);
      expect(swResponse).toBe('responseFromServiceWorker:foo');
      expect(pageReq.url()).toMatch(/fetchdummy\/foo$/);
      expect(pageReq.serviceWorker()).toBe(null);
      expect(pageResp.fromServiceWorker()).toBe(true);
      expect(pageResp).toBe(await pageReq.response());
      expect((await pageReq.response()).fromServiceWorker()).toBe(true);
    });

    test('failed request', async ({ page, server }) => {
      await page.goto(server.PREFIX + '/serviceworkers/fetchdummy/sw.html');
      await page.evaluate(() => window['activationPromise']);

      const [pageReq] = await Promise.all([
        page.waitForEvent('request'),
        page.waitForEvent('requestfailed'),
        page.evaluate(() => window['fetchDummy']('error')).catch(e => e),
      ]);
      expect(pageReq.url()).toMatch(/fetchdummy\/error$/);
      expect(pageReq.failure().errorText).toMatch(/net::ERR_FAILED/);
      expect(pageReq.serviceWorker()).toBe(null);
      expect(await pageReq.response()).toBe(null);
    });
  });

  test.describe('when routing', () => {
    test('successful request', async ({ page, server, context }) => {
      await context.route('**', route => route.continue());
      await page.route('**', route => route.continue());
      await page.goto(server.PREFIX + '/serviceworkers/fetchdummy/sw.html');
      await page.evaluate(() => window['activationPromise']);

      const [result, pageResp] = await Promise.all([
        page.waitForEvent('request', { timeout: 750 }).catch(e => 'timeout'),
        page.evaluate(() => window['fetchDummy']('foo')),
      ]);
      expect(result).toBe('timeout');
      expect(pageResp).toBeTruthy();
    });

    test('failed request', async ({ page, server, context }) => {
      await context.route('**', route => route.continue());
      let markFailureIfPageRoutesARequestAlreadyHandledByServiceWorker = false;
      await page.route('**', route => {
        if (route.request().url().endsWith('foo'))
          markFailureIfPageRoutesARequestAlreadyHandledByServiceWorker = true;
        route.continue();
      });
      await page.goto(server.PREFIX + '/serviceworkers/fetchdummy/sw.html');
      await page.evaluate(() => window['activationPromise']);

      const [pageReq] = await Promise.all([
        page.waitForEvent('request'),
        page.waitForEvent('requestfailed'),
        page.evaluate(() => window['fetchDummy']('error')).catch(e => e),
      ]);
      expect(pageReq.url()).toMatch(/fetchdummy\/error$/);
      expect(pageReq.failure().errorText).toMatch(/net::ERR_FAILED/);
      expect(pageReq.serviceWorker()).toBe(null);
      expect(await pageReq.response()).toBe(null);
      expect(markFailureIfPageRoutesARequestAlreadyHandledByServiceWorker).toBe(false);
    });
  });
});

test.describe('PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS=1', () => {
  test.skip(({ mode }) => mode !== 'default', 'Cannot set env variables in non-default');
  test.beforeAll(() => process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS = '1');
  test.afterAll(() => delete process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS);

  test('serviceWorker(), and fromServiceWorker() work', async ({ context, page, server }) => {
    const [worker, html, main, inWorker] = await Promise.all([
      context.waitForEvent('serviceworker'),
      context.waitForEvent('request', r => r.url().endsWith('/sw.html')),
      context.waitForEvent('request', r => r.url().endsWith('/sw.js')),
      context.waitForEvent('request', r => r.url().endsWith('/request-from-within-worker.txt')),
      page.goto(server.PREFIX + '/serviceworkers/fetch/sw.html')
    ]);

    expect(html.frame()).toBeTruthy();
    expect(html.serviceWorker()).toBe(null);
    expect((await html.response()).fromServiceWorker()).toBe(false);

    expect(main.frame).toThrow();
    expect(main.serviceWorker()).toBe(worker);
    expect((await main.response()).fromServiceWorker()).toBe(false);

    expect(inWorker.frame).toThrow();
    expect(inWorker.serviceWorker()).toBe(worker);
    expect((await inWorker.response()).fromServiceWorker()).toBe(false);

    await page.evaluate(() => window['activationPromise']);
    const [innerSW, innerPage] = await Promise.all([
      context.waitForEvent('request', r => r.url().endsWith('/inner.txt') && !!r.serviceWorker()),
      context.waitForEvent('request', r => r.url().endsWith('/inner.txt') && !r.serviceWorker()),
      page.evaluate(() => fetch('/inner.txt')),
    ]);
    expect(innerPage.serviceWorker()).toBe(null);
    expect((await innerPage.response()).fromServiceWorker()).toBe(true);

    expect(innerSW.serviceWorker()).toBe(worker);
    expect((await innerSW.response()).fromServiceWorker()).toBe(false);
  });

  test('should intercept service worker requests (main and within)', async ({ context, page, server }) => {
    await context.route('**/request-from-within-worker', route =>
      route.fulfill({
        contentType: 'application/json',
        status: 200,
        body: '"intercepted!"',
      })
    );

    await context.route('**/sw.js', route =>
      route.fulfill({
        contentType: 'text/javascript',
        status: 200,
        body: `
            self.contentPromise = new Promise(res => fetch('/request-from-within-worker').then(r => r.json()).then(res));
          `,
      })
    );

    const [sw] = await Promise.all([
      context.waitForEvent('serviceworker'),
      context.waitForEvent('response', r => r.url().endsWith('/request-from-within-worker')),
      context.waitForEvent('request', r => r.url().endsWith('sw.js') && !!r.serviceWorker()),
      context.waitForEvent('response', r => r.url().endsWith('sw.js') && !r.fromServiceWorker()),
      page.goto(server.PREFIX + '/serviceworkers/empty/sw.html'),
    ]);

    await expect(sw.evaluate(() => self['contentPromise'])).resolves.toBe('intercepted!');
  });

  test('should report failure (due to content-type) of main service worker request', async ({ server, page, context, browserMajorVersion }) => {
    test.skip(browserMajorVersion < 104, 'Requires http://crrev.com/1012503 or later.');
    server.setRoute('/serviceworkers/fetch/sw.js', (req, res) => {
      res.writeHead(200, 'OK', { 'Content-Type': 'text/html' });
      res.write(`console.log('hi from sw');`);
      res.end();
    });
    const [, main] = await Promise.all([
      server.waitForRequest('/serviceworkers/fetch/sw.js'),
      context.waitForEvent('request', r => r.url().endsWith('sw.js')),
      page.goto(server.PREFIX + '/serviceworkers/fetch/sw.html'),
    ]);
      // This will timeout today
    await main.response();
  });

  test('should report failure (due to redirect) of main service worker request', async ({ server, page, context, browserMajorVersion }) => {
    test.skip(browserMajorVersion < 104, 'Requires http://crrev.com/1012503 or later.');
    server.setRedirect('/serviceworkers/empty/sw.js', '/dev/null');
    const [, main] = await Promise.all([
      server.waitForRequest('/serviceworkers/empty/sw.js'),
      context.waitForEvent('request', r => r.url().endsWith('sw.js')),
      page.goto(server.PREFIX + '/serviceworkers/empty/sw.html'),
    ]);
      // This will timeout today
    const resp = await main.response();
    expect(resp.status()).toBe(302);
  });

  test('should intercept service worker importScripts', async ({ context, page, server }) => {
    await context.route('**/import.js', route =>
      route.fulfill({
        contentType: 'text/javascript',
        status: 200,
        body: 'self.exportedValue = 47;',
      })
    );

    await context.route('**/sw.js', route =>
      route.fulfill({
        contentType: 'text/javascript',
        status: 200,
        body: `
            importScripts('/import.js');
            self.importedValue = self.exportedValue;
          `,
      })
    );

    const [sw] = await Promise.all([
      context.waitForEvent('serviceworker'),
      context.waitForEvent('response', r => r.url().endsWith('/import.js')),
      page.goto(server.PREFIX + '/serviceworkers/empty/sw.html'),
    ]);

    await expect(sw.evaluate(() => self['importedValue'])).resolves.toBe(47);
  });

  test('should report intercepted service worker requests in HAR', async ({ pageWithHar, server }) => {
    const { context, page, getLog } = await pageWithHar();
    await context.route('**/request-from-within-worker', route =>
      route.fulfill({
        contentType: 'application/json',
        headers: {
          'x-pw-test': 'request-within-worker',
        },
        status: 200,
        body: '"intercepted!"',
      })
    );

    await context.route('**/sw.js', route =>
      route.fulfill({
        contentType: 'text/javascript',
        headers: {
          'x-pw-test': 'intercepted-main',
        },
        status: 200,
        body: `
            self.contentPromise = new Promise(res => fetch('/request-from-within-worker').then(r => r.json()).then(res));
          `,
      })
    );

    const [sw] = await Promise.all([
      context.waitForEvent('serviceworker'),
      context.waitForEvent('response', r => r.url().endsWith('/request-from-within-worker')),
      page.goto(server.PREFIX + '/serviceworkers/empty/sw.html'),
    ]);

    await expect(sw.evaluate(() => self['contentPromise'])).resolves.toBe('intercepted!');

    const log = await getLog();
    {
      const sw = log.entries.filter(e => e.request.url.endsWith('sw.js'));
      expect.soft(sw).toHaveLength(1);
      expect.soft(sw[0].response.headers.filter(v => v.name === 'x-pw-test')).toEqual([{ name: 'x-pw-test', value: 'intercepted-main' }]);
    }
    {
      const req = log.entries.filter(e => e.request.url.endsWith('request-from-within-worker'));
      expect.soft(req).toHaveLength(1);
      expect.soft(req[0].response.headers.filter(v => v.name === 'x-pw-test')).toEqual([{ name: 'x-pw-test', value: 'request-within-worker' }]);
      expect.soft(req[0].response.content.text).toBe('"intercepted!"');
    }
  });

  test('should intercept only serviceworker request, not page', async ({ context, page, server }) => {
    await context.route('**/data.json', async route => {
      if (route.request().serviceWorker()) {
        return route.fulfill({
          contentType: 'text/plain',
          status: 200,
          body: 'from sw',
        });
      } else {
        return route.continue();
      }
    });

    const [sw] = await Promise.all([
      context.waitForEvent('serviceworker'),
      page.goto(server.PREFIX + '/serviceworkers/fetch/sw.html'),
    ]);
    await page.evaluate(() => window['activationPromise']);
    const response = await page.evaluate(() => fetch('/data.json').then(r => r.text()));
    const [url] = await sw.evaluate(() => self['intercepted']);
    expect(url).toMatch(/\/data\.json$/);
    expect(response).toBe('from sw');
  });

  test('should produce network events, routing, and annotations for Service Worker', async ({ page, context, server }) => {
    server.setRoute('/index.html', (req, res) => {
      res.write(`
        <script>
          window.registrationPromise = navigator.serviceWorker.register('/transparent-service-worker.js');
        </script>
      `);
      res.end();
    });
    server.setRoute('/transparent-service-worker.js', (req, res) => {
      res.writeHead(200, 'OK', { 'Content-Type': 'text/javascript' });
      res.write(`
        self.addEventListener("fetch", (event) => {
          // actually make the request
          const responsePromise = fetch(event.request);
          // send it back to the page
          event.respondWith(responsePromise);
        });

        self.addEventListener("activate", (event) => {
          event.waitUntil(clients.claim());
        });
      `);
      res.end();
    });

    const routed = [];
    const formatRequest = async ([scope, r]: ['page' | 'context', any]) => `| ${(scope === 'page' ? '[`event: Page.request`]' : '[`event: BrowserContext.request`]').padEnd('[`event: BrowserContext.request`]'.length, ' ')} | ${r.serviceWorker() ? 'Service [Worker]' : '[Frame]'.padEnd('Service [Worker]'.length, ' ')} | ${r.url().split('/').pop().padEnd(30, ' ')} | ${(routed.includes(r) ? 'Yes' : '').padEnd('Routed'.length, ' ')} | ${((await r.response()).fromServiceWorker() ? 'Yes' : '').padEnd('[`method: Response.fromServiceWorker`]'.length, ' ')} |`;
    await context.route('**', async route => {
      routed.push(route.request());
      await route.continue();
    });
    await page.route('**', async route => {
      routed.push(route.request());
      await route.continue();
    });
    const requests = [];
    page.on('request', r => requests.push(['page', r]));
    context.on('request', r => requests.push(['context', r]));

    const [sw] = await Promise.all([
      context.waitForEvent('serviceworker'),
      page.goto(server.PREFIX + '/index.html'),
    ]);

    await expect.poll(() => sw.evaluate(() => (self as any).registration.active?.state)).toBe('activated');

    await page.evaluate(() => fetch('/data.json'));

    expect([
      '| Event                             | Owner            | URL                            | Routed | [`method: Response.fromServiceWorker`] |',
      ...await Promise.all(requests.map(formatRequest))])
        .toEqual([
          '| Event                             | Owner            | URL                            | Routed | [`method: Response.fromServiceWorker`] |',
          '| [`event: BrowserContext.request`] | [Frame]          | index.html                     | Yes    |                                        |',
          '| [`event: Page.request`]           | [Frame]          | index.html                     | Yes    |                                        |',
          '| [`event: BrowserContext.request`] | Service [Worker] | transparent-service-worker.js  | Yes    |                                        |',
          '| [`event: BrowserContext.request`] | Service [Worker] | data.json                      | Yes    |                                        |',
          '| [`event: BrowserContext.request`] | [Frame]          | data.json                      |        | Yes                                    |',
          '| [`event: Page.request`]           | [Frame]          | data.json                      |        | Yes                                    |',
        ]);
  });

  test('should produce network events, routing, and annotations for Service Worker (advanced)', async ({ page, context, server }) => {
    server.setRoute('/index.html', (req, res) => {
      res.write(`
        <script>
          window.registrationPromise = navigator.serviceWorker.register('/complex-service-worker.js');
        </script>
      `);
      res.end();
    });
    server.setRoute('/complex-service-worker.js', (req, res) => {
      res.writeHead(200, 'OK', { 'Content-Type': 'text/javascript' });
      res.write(`
        self.addEventListener("install", function (event) {
          event.waitUntil(
            caches.open("v1").then(function (cache) {
              // 1. Pre-fetches and caches /addressbook.json
              return cache.add("/addressbook.json");
            })
          );
        });

        // Opt to handle FetchEvent's from the page
        self.addEventListener("fetch", (event) => {
          event.respondWith(
            (async () => {
              // 1. Try to first serve directly from caches
              let response = await caches.match(event.request);
              if (response) return response;

              // 2. Re-write request for /foo to /bar
              if (event.request.url.endsWith("foo")) return fetch("./bar");

              // 3. Prevent tracker.js from being retrieved, and returns a placeholder response
              if (event.request.url.endsWith("tracker.js"))
                return new Response('conosole.log("no trackers!")', {
                  status: 200,
                  headers: { "Content-Type": "text/javascript" },
                });

              // 4. Otherwise, fallthrough, perform the fetch and respond
              return fetch(event.request);
            })()
          );
        });

        self.addEventListener("activate", (event) => {
          event.waitUntil(clients.claim());
        });
      `);
      res.end();
    });
    server.setRoute('/addressbook.json', (req, res) => {
      res.write('{}');
      res.end();
    });

    const routed = [];
    const formatRequest = async ([scope, r]: ['page' | 'context', any]) => `| ${(scope === 'page' ? '[`event: Page.request`]' : '[`event: BrowserContext.request`]').padEnd('[`event: BrowserContext.request`]'.length, ' ')} | ${r.serviceWorker() ? 'Service [Worker]' : '[Frame]'.padEnd('Service [Worker]'.length, ' ')} | ${r.url().split('/').pop().padEnd(30, ' ')} | ${(routed.includes(r) ? 'Yes' : '').padEnd('Routed'.length, ' ')} | ${((await r.response()).fromServiceWorker() ? 'Yes' : '').padEnd('[`method: Response.fromServiceWorker`]'.length, ' ')} |`;
    await context.route('**', async route => {
      routed.push(route.request());
      await route.continue();
    });
    await page.route('**', async route => {
      routed.push(route.request());
      await route.continue();
    });
    const requests = [];
    page.on('request', r => requests.push(['page', r]));
    context.on('request', r => requests.push(['context', r]));

    const [sw] = await Promise.all([
      context.waitForEvent('serviceworker'),
      page.goto(server.PREFIX + '/index.html'),
    ]);

    await expect.poll(() => sw.evaluate(() => (self as any).registration.active?.state)).toBe('activated');

    await page.evaluate(() => fetch('/addressbook.json'));
    await page.evaluate(() => fetch('/foo'));
    await page.evaluate(() => fetch('/tracker.js'));
    await page.evaluate(() => fetch('/fallthrough.txt'));

    expect([
      '| Event                             | Owner            | URL                            | Routed | [`method: Response.fromServiceWorker`] |',
      ...await Promise.all(requests.map(formatRequest))])
        .toEqual([
          '| Event                             | Owner            | URL                            | Routed | [`method: Response.fromServiceWorker`] |',
          '| [`event: BrowserContext.request`] | [Frame]          | index.html                     | Yes    |                                        |',
          '| [`event: Page.request`]           | [Frame]          | index.html                     | Yes    |                                        |',
          '| [`event: BrowserContext.request`] | Service [Worker] | complex-service-worker.js      | Yes    |                                        |',
          '| [`event: BrowserContext.request`] | Service [Worker] | addressbook.json               | Yes    |                                        |',
          '| [`event: BrowserContext.request`] | [Frame]          | addressbook.json               |        | Yes                                    |',
          '| [`event: Page.request`]           | [Frame]          | addressbook.json               |        | Yes                                    |',
          '| [`event: BrowserContext.request`] | Service [Worker] | bar                            | Yes    |                                        |',
          '| [`event: BrowserContext.request`] | [Frame]          | foo                            |        | Yes                                    |',
          '| [`event: Page.request`]           | [Frame]          | foo                            |        | Yes                                    |',
          '| [`event: BrowserContext.request`] | [Frame]          | tracker.js                     |        | Yes                                    |',
          '| [`event: Page.request`]           | [Frame]          | tracker.js                     |        | Yes                                    |',
          '| [`event: BrowserContext.request`] | Service [Worker] | fallthrough.txt                | Yes    |                                        |',
          '| [`event: BrowserContext.request`] | [Frame]          | fallthrough.txt                |        | Yes                                    |',
          '| [`event: Page.request`]           | [Frame]          | fallthrough.txt                |        | Yes                                    |']);
  });

  test('should intercept service worker update requests', async ({ context, page, server }) => {
    test.fixme();
    test.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/14711' });

    let version = 0;
    server.setRoute('/worker.js', (req, res) => {
      res.writeHead(200, 'OK', { 'Content-Type': 'text/javascript' });
      res.write(`self.PW_VERSION = ${version++};`);
      res.end();
    });

    server.setRoute('/home', (req, res) => {
      res.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Service Worker Update Demo</title>
          </head>
          <body>
            <button id="update" disabled>update service worker</button>
            <script>
              const updateBtn = document.getElementById('update');
              updateBtn.addEventListener('click', evt => {
                evt.preventDefault();
                registration.then(r => r.update());
              });

              const registration = new Promise(r => navigator.serviceWorker.register('/worker.js').then(r));
              registration.then(() => updateBtn.disabled = false);
            </script>
          </body>
        </html>
      `);
      res.end();
    });

    const [sw] = await Promise.all([
      context.waitForEvent('serviceworker'),
      page.goto(server.PREFIX + '/home'),
    ]);

    await expect.poll(() => sw.evaluate(() => self['PW_VERSION'])).toBe(0);

    // Before triggering, let's intercept the update request
    await context.route('**/worker.js', async route => {
      await route.fulfill({
        status: 200,
        body: `self.PW_VERSION = "intercepted";`,
        contentType: 'text/javascript',
      });
    });

    const [updatedSW] = await Promise.all([
      context.waitForEvent('serviceworker'),
      // currently times out here
      context.waitForEvent('request', r => r.url().endsWith('worker.js')),
      page.click('#update'),
    ]);

    await expect.poll(() => updatedSW.evaluate(() => self['PW_VERSION'])).toBe('intercepted');
  });

  test('setOffline', async ({ context, page, server }) => {
    const [worker] = await Promise.all([
      context.waitForEvent('serviceworker'),
      page.goto(server.PREFIX + '/serviceworkers/fetch/sw.html')
    ]);

    await page.evaluate(() => window['activationPromise']);
    await context.setOffline(true);
    const [, error] = await Promise.all([
      context.waitForEvent('request', r => r.url().endsWith('/inner.txt') && !!r.serviceWorker()),
      worker.evaluate(() => fetch('/inner.txt').catch(e => `REJECTED: ${e}`)),
    ]);
    expect(error).toMatch(/REJECTED.*Failed to fetch/);
  });

  test.describe('should emit page-level network events with service worker fetch handler', () => {
    test.describe('when not using routing', () => {
      test('successful request', async ({ page, server }) => {
        await page.goto(server.PREFIX + '/serviceworkers/fetchdummy/sw.html');
        await page.evaluate(() => window['activationPromise']);

        const [pageReq, pageResp, /* pageFinished */, swResponse] = await Promise.all([
          page.waitForEvent('request'),
          page.waitForEvent('response'),
          page.waitForEvent('requestfinished'),
          page.evaluate(() => window['fetchDummy']('foo')),
        ]);
        expect(swResponse).toBe('responseFromServiceWorker:foo');
        expect(pageReq.url()).toMatch(/fetchdummy\/foo$/);
        expect(pageReq.serviceWorker()).toBe(null);
        expect(pageResp.fromServiceWorker()).toBe(true);
        expect(pageResp).toBe(await pageReq.response());
        expect((await pageReq.response()).fromServiceWorker()).toBe(true);
      });

      test('failed request', async ({ page, server }) => {
        await page.goto(server.PREFIX + '/serviceworkers/fetchdummy/sw.html');
        await page.evaluate(() => window['activationPromise']);

        const [pageReq] = await Promise.all([
          page.waitForEvent('request'),
          page.waitForEvent('requestfailed'),
          page.evaluate(() => window['fetchDummy']('error')).catch(e => e),
        ]);
        expect(pageReq.url()).toMatch(/fetchdummy\/error$/);
        expect(pageReq.failure().errorText).toMatch(/net::ERR_FAILED/);
        expect(pageReq.serviceWorker()).toBe(null);
        expect(await pageReq.response()).toBe(null);
      });
    });

    test.describe('when routing', () => {
      test('successful request', async ({ page, server, context }) => {
        await context.route('**', route => route.continue());
        let markFailureIfPageRoutesARequestAlreadyHandledByServiceWorker = false;
        await page.route('**', route => {
          if (route.request().url().endsWith('foo'))
            markFailureIfPageRoutesARequestAlreadyHandledByServiceWorker = true;
          route.continue();
        });
        await page.goto(server.PREFIX + '/serviceworkers/fetchdummy/sw.html');
        await page.evaluate(() => window['activationPromise']);

        const [pageReq, pageResp, /* pageFinished */, swResponse] = await Promise.all([
          page.waitForEvent('request'),
          page.waitForEvent('response'),
          page.waitForEvent('requestfinished'),
          page.evaluate(() => window['fetchDummy']('foo')),
        ]);
        expect(swResponse).toBe('responseFromServiceWorker:foo');
        expect(pageReq.url()).toMatch(/fetchdummy\/foo$/);
        expect(pageReq.serviceWorker()).toBe(null);
        expect(pageResp.fromServiceWorker()).toBe(true);
        expect(pageResp).toBe(await pageReq.response());
        expect((await pageReq.response()).fromServiceWorker()).toBe(true);
        expect(markFailureIfPageRoutesARequestAlreadyHandledByServiceWorker).toBe(false);
      });

      test('failed request', async ({ page, server, context }) => {
        await context.route('**', route => route.continue());
        let markFailureIfPageRoutesARequestAlreadyHandledByServiceWorker = false;
        await page.route('**', route => {
          if (route.request().url().endsWith('foo'))
            markFailureIfPageRoutesARequestAlreadyHandledByServiceWorker = true;
          route.continue();
        });
        await page.goto(server.PREFIX + '/serviceworkers/fetchdummy/sw.html');
        await page.evaluate(() => window['activationPromise']);

        const [pageReq] = await Promise.all([
          page.waitForEvent('request'),
          page.waitForEvent('requestfailed'),
          page.evaluate(() => window['fetchDummy']('error')).catch(e => e),
        ]);
        expect(pageReq.url()).toMatch(/fetchdummy\/error$/);
        expect(pageReq.failure().errorText).toMatch(/net::ERR_FAILED/);
        expect(pageReq.serviceWorker()).toBe(null);
        expect(await pageReq.response()).toBe(null);
        expect(markFailureIfPageRoutesARequestAlreadyHandledByServiceWorker).toBe(false);
      });
    });
  });

  test('setExtraHTTPHeaders', async ({ context, page, server }) => {
    const [worker] = await Promise.all([
      context.waitForEvent('serviceworker'),
      page.goto(server.PREFIX + '/serviceworkers/fetch/sw.html')
    ]);

    await page.evaluate(() => window['activationPromise']);
    await context.setExtraHTTPHeaders({ 'x-custom-header': 'custom!' });
    const requestPromise = server.waitForRequest('/inner.txt');
    await worker.evaluate(() => fetch('/inner.txt'));
    const req = await requestPromise;
    expect(req.headers['x-custom-header']).toBe('custom!');
  });
});