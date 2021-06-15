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

import { contextTest as test, expect } from '../config/browserTest';
import { playwrightTest } from '../config/browserTest';
import http from 'http';
import { getUserAgent } from '../../lib/utils/utils';

test('should create a worker from a service worker', async ({page, server}) => {
  const [worker] = await Promise.all([
    page.context().waitForEvent('serviceworker'),
    page.goto(server.PREFIX + '/serviceworkers/empty/sw.html')
  ]);
  expect(await worker.evaluate(() => self.toString())).toBe('[object ServiceWorkerGlobalScope]');
});

test('serviceWorkers() should return current workers', async ({page, server}) => {
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

test('should not create a worker from a shared worker', async ({page, server}) => {
  await page.goto(server.EMPTY_PAGE);
  let serviceWorkerCreated;
  page.context().once('serviceworker', () => serviceWorkerCreated = true);
  await page.evaluate(() => {
    new SharedWorker('data:text/javascript,console.log("hi")');
  });
  expect(serviceWorkerCreated).not.toBeTruthy();
});

test('Page.route should work with intervention headers', async ({server, page}) => {
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

playwrightTest('should close service worker together with the context', async ({browserType, browserOptions, server}) => {
  const browser = await browserType.launch(browserOptions);
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

playwrightTest('should connect to an existing cdp session', async ({ browserType, browserOptions }, testInfo) => {
  const port = 9339 + testInfo.workerIndex;
  const browserServer = await browserType.launch({
    ...browserOptions,
    args: ['--remote-debugging-port=' + port]
  });
  try {
    const cdpBrowser = await browserType.connectOverCDP({
      endpointURL: `http://localhost:${port}/`,
    });
    const contexts = cdpBrowser.contexts();
    expect(contexts.length).toBe(1);
    await cdpBrowser.close();
  } finally {
    await browserServer.close();
  }
});

playwrightTest('should connect to an existing cdp session twice', async ({ browserType, browserOptions, server }, testInfo) => {
  const port = 9339 + testInfo.workerIndex;
  const browserServer = await browserType.launch({
    ...browserOptions,
    args: ['--remote-debugging-port=' + port]
  });
  try {
    const cdpBrowser1 = await browserType.connectOverCDP({
      endpointURL: `http://localhost:${port}/`,
    });
    const cdpBrowser2 = await browserType.connectOverCDP({
      endpointURL: `http://localhost:${port}/`,
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

playwrightTest('should connect to existing service workers', async ({browserType, browserOptions, server}, testInfo) => {
  const port = 9339 + testInfo.workerIndex;
  const browserServer = await browserType.launch({
    ...browserOptions,
    args: ['--remote-debugging-port=' + port]
  });
  try {
    const cdpBrowser1 = await browserType.connectOverCDP({
      endpointURL: `http://localhost:${port}`,
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
      endpointURL: `http://localhost:${port}`,
    });
    const context2 = cdpBrowser2.contexts()[0];
    expect(context2.serviceWorkers().length).toBe(1);
    await cdpBrowser2.close();
  } finally {
    await browserServer.close();
  }
});

playwrightTest('should connect over a ws endpoint', async ({browserType, browserOptions, server}, testInfo) => {
  const port = 9339 + testInfo.workerIndex;
  const browserServer = await browserType.launch({
    ...browserOptions,
    args: ['--remote-debugging-port=' + port]
  });
  try {
    const json = await new Promise<string>((resolve, reject) => {
      http.get(`http://localhost:${port}/json/version/`, resp => {
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

playwrightTest('should send extra headers with connect request', async ({browserType, browserOptions, server}, testInfo) => {
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

playwrightTest('should send default User-Agent header with connect request', async ({browserType, browserOptions, server}, testInfo) => {
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

playwrightTest('should report all pages in an existing browser', async ({ browserType, browserOptions }, testInfo) => {
  const port = 9339 + testInfo.workerIndex;
  const browserServer = await browserType.launch({
    ...browserOptions,
    args: ['--remote-debugging-port=' + port]
  });
  try {
    const cdpBrowser = await browserType.connectOverCDP({
      endpointURL: `http://localhost:${port}/`,
    });
    const contexts = cdpBrowser.contexts();
    expect(contexts.length).toBe(1);
    for (let i = 0; i < 3; i++)
      await contexts[0].newPage();
    await cdpBrowser.close();

    const cdpBrowser2 = await browserType.connectOverCDP({
      endpointURL: `http://localhost:${port}/`,
    });
    expect(cdpBrowser2.contexts()[0].pages().length).toBe(3);

    await cdpBrowser2.close();
  } finally {
    await browserServer.close();
  }
});

playwrightTest('should return valid browser from context.browser()', async ({ browserType, browserOptions }, testInfo) => {
  const port = 9339 + testInfo.workerIndex;
  const browserServer = await browserType.launch({
    ...browserOptions,
    args: ['--remote-debugging-port=' + port]
  });
  try {
    const cdpBrowser = await browserType.connectOverCDP({
      endpointURL: `http://localhost:${port}/`,
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
