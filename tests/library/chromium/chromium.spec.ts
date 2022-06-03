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
import { getUserAgent } from '../../../packages/playwright-core/lib/common/userAgent';
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

test('serviceWorker(), and fulfilledByServiceWorker() work', async ({ context, page, server, browserMajorVersion }) => {
  test.skip(browserMajorVersion < 103, 'Requires fix from https://chromium-review.googlesource.com/c/chromium/src/+/3544685');

  const [worker, html, main, inWorker] = await Promise.all([
    context.waitForEvent('serviceworker'),
    context.waitForEvent('request', r => r.url().endsWith('/sw.html')),
    context.waitForEvent('request', r => r.url().endsWith('/sw.js')),
    context.waitForEvent('request', r => r.url().endsWith('/request-from-within-worker.txt')),
    page.goto(server.PREFIX + '/serviceworkers/fetch/sw.html')
  ]);
  const [inner] = await Promise.all([
    context.waitForEvent('request', r => r.url().endsWith('/inner.txt')),
    page.evaluate(() => fetch('/inner.txt')),
  ]);
  expect(html.frame()).toBeTruthy();
  expect(html.serviceWorker()).toBe(null);
  expect((await html.response()).fulfilledByServiceWorker()).toBe(false);

  expect(main.frame).toThrow();
  expect(main.serviceWorker()).toBe(worker);
  expect((await main.response()).fulfilledByServiceWorker()).toBe(false);

  expect(inner.frame()).toBeTruthy();
  expect(inner.serviceWorker()).toBe(null);
  expect((await inner.response()).fulfilledByServiceWorker()).toBe(true);

  expect(inWorker.frame).toThrow();
  expect(inWorker.serviceWorker()).toBe(worker);
  expect((await inWorker.response()).fulfilledByServiceWorker()).toBe(false);

  await page.evaluate(() => window['activationPromise']);
  const [innerSW, innerPage] = await Promise.all([
    context.waitForEvent('request', r => r.url().endsWith('/inner.txt') && !!r.serviceWorker()),
    context.waitForEvent('request', r => r.url().endsWith('/inner.txt') && !r.serviceWorker()),
    page.evaluate(() => fetch('/inner.txt')),
  ]);
  expect(innerPage.serviceWorker()).toBe(null);
  expect((await innerPage.response()).fulfilledByServiceWorker()).toBe(true);

  expect(innerSW.serviceWorker()).toBe(worker);
  expect((await innerSW.response()).fulfilledByServiceWorker()).toBe(false);
});

test('should intercept service worker requests (main and within)', async ({ context, page, server, browserMajorVersion }) => {
  test.skip(browserMajorVersion < 103, 'Requires fix from https://chromium-review.googlesource.com/c/chromium/src/+/3544685');

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

  const [ sw ] = await Promise.all([
    context.waitForEvent('serviceworker'),
    page.goto(server.PREFIX + '/serviceworkers/empty/sw.html'),
  ]);

  await expect(sw.evaluate(() => self['contentPromise'])).resolves.toBe('intercepted!');
});

test('should report failure (due to content-type) of main service worker request', async ({ server, page, context, browserMajorVersion }) => {
  test.fixme(true, 'crbug.com/1318727, Fixed in https://chromium-review.googlesource.com/c/chromium/src/+/3689949');
  test.skip(browserMajorVersion < 103, 'Requires fix from https://chromium-review.googlesource.com/c/chromium/src/+/3544685');

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
  test.fixme(true, 'crbug.com/1318727, Fixed in https://chromium-review.googlesource.com/c/chromium/src/+/3689949');
  test.skip(browserMajorVersion < 103, 'Requires fix from https://chromium-review.googlesource.com/c/chromium/src/+/3544685');

  server.setRedirect('/serviceworkers/empty/sw.js', '/dev/null');
  const [, main] = await Promise.all([
    server.waitForRequest('/serviceworkers/empty/sw.js'),
    context.waitForEvent('request', r => r.url().endsWith('sw.js')),
    page.goto(server.PREFIX + '/serviceworkers/empty/sw.html'),
  ]);
    // This will timeout today
  const resp = await main.response();
  expect(resp.status()).toBe(301);
});

test('should intercept service worker importScripts', async ({ context, page, server, browserMajorVersion }) => {
  test.skip(browserMajorVersion < 103, 'Requires fix from https://chromium-review.googlesource.com/c/chromium/src/+/3544685');

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

  const [ sw ] = await Promise.all([
    context.waitForEvent('serviceworker'),
    page.goto(server.PREFIX + '/serviceworkers/empty/sw.html'),
  ]);

  await expect(sw.evaluate(() => self['importedValue'])).resolves.toBe(47);
});

test('should report intercepted service worker requests in HAR', async ({ pageWithHar, server, browserMajorVersion }) => {
  test.skip(browserMajorVersion < 103, 'Requires fix from https://chromium-review.googlesource.com/c/chromium/src/+/3544685');

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

  const [ sw ] = await Promise.all([
    context.waitForEvent('serviceworker'),
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
    expect.soft(Buffer.from(req[0].response.content.text, 'base64').toString()).toBe('"intercepted!"');
  }
});

test('should intercept only serviceworker request, not page', async ({ context, page, server, browserMajorVersion }) => {
  test.skip(browserMajorVersion < 103, 'Requires fix from https://chromium-review.googlesource.com/c/chromium/src/+/3544685');

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

  const [ sw ] = await Promise.all([
    context.waitForEvent('serviceworker'),
    page.goto(server.PREFIX + '/serviceworkers/fetch/sw.html'),
  ]);
  await page.evaluate(() => window['activationPromise']);
  const response = await page.evaluate(() => fetch('/data.json').then(r => r.text()));
  const [ url ] = await sw.evaluate(() => self['intercepted']);
  expect(url).toMatch(/\/data\.json$/);
  expect(response).toBe('from sw');
});

test('setOffline', async ({ context, page, server, browserMajorVersion }) => {
  test.skip(browserMajorVersion < 103, 'Requires fix from https://chromium-review.googlesource.com/c/chromium/src/+/3544685');

  const [worker] = await Promise.all([
    context.waitForEvent('serviceworker'),
    page.goto(server.PREFIX + '/serviceworkers/fetch/sw.html')
  ]);

  await page.evaluate(() => window['activationPromise']);
  await context.setOffline(true);
  const [,error] = await Promise.all([
    context.waitForEvent('request', r => r.url().endsWith('/inner.txt') && !!r.serviceWorker()),
    worker.evaluate(() => fetch('/inner.txt').catch(e => `REJECTED: ${e}`)),
  ]);
  expect(error).toMatch(/REJECTED.*Failed to fetch/);
});


test('setExtraHTTPHeaders', async ({ context, page, server, browserMajorVersion }) => {
  test.skip(browserMajorVersion < 103, 'Requires fix from https://chromium-review.googlesource.com/c/chromium/src/+/3544685');

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

test.describe('http credentials', () => {
  test.use({ httpCredentials: { username: 'user',  password: 'pass' } });

  test('httpCredentials', async ({ context, page, server, browserMajorVersion }) => {
    test.skip(browserMajorVersion < 103, 'Requires fix from https://chromium-review.googlesource.com/c/chromium/src/+/3544685');

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
  playwrightTest.skip(mode !== 'default');

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

playwrightTest('should pass args with spaces', async ({ browserType, createUserDataDir }, testInfo) => {
  const browser = await browserType.launchPersistentContext(await createUserDataDir(), {
    args: ['--user-agent=I am Foo']
  });
  const page = await browser.newPage();
  const userAgent = await page.evaluate(() => navigator.userAgent);
  await browser.close();
  expect(userAgent).toBe('I am Foo');
});
