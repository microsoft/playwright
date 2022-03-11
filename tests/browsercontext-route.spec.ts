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

import { browserTest as it, expect } from './config/browserTest';

it('should intercept', async ({ browser, server }) => {
  const context = await browser.newContext();
  let intercepted = false;
  await context.route('**/empty.html', route => {
    intercepted = true;
    const request = route.request();
    expect(request.url()).toContain('empty.html');
    expect(request.headers()['user-agent']).toBeTruthy();
    expect(request.method()).toBe('GET');
    expect(request.postData()).toBe(null);
    expect(request.isNavigationRequest()).toBe(true);
    expect(request.resourceType()).toBe('document');
    expect(request.frame() === page.mainFrame()).toBe(true);
    expect(request.frame().url()).toBe('about:blank');
    route.continue();
  });
  const page = await context.newPage();
  const response = await page.goto(server.EMPTY_PAGE);
  expect(response.ok()).toBe(true);
  expect(intercepted).toBe(true);
  await context.close();
});

it('should unroute', async ({ browser, server }) => {
  const context = await browser.newContext();
  const page = await context.newPage();

  let intercepted = [];
  await context.route('**/*', route => {
    intercepted.push(1);
    route.continue();
  });
  await context.route('**/empty.html', route => {
    intercepted.push(2);
    route.continue();
  });
  await context.route('**/empty.html', route => {
    intercepted.push(3);
    route.continue();
  });
  const handler4 = route => {
    intercepted.push(4);
    route.continue();
  };
  await context.route('**/empty.html', handler4);
  await page.goto(server.EMPTY_PAGE);
  expect(intercepted).toEqual([4]);

  intercepted = [];
  await context.unroute('**/empty.html', handler4);
  await page.goto(server.EMPTY_PAGE);
  expect(intercepted).toEqual([3]);

  intercepted = [];
  await context.unroute('**/empty.html');
  await page.goto(server.EMPTY_PAGE);
  expect(intercepted).toEqual([1]);

  await context.close();
});

it('should yield to page.route', async ({ browser, server }) => {
  const context = await browser.newContext();
  await context.route('**/empty.html', route => {
    route.fulfill({ status: 200, body: 'context' });
  });
  const page = await context.newPage();
  await page.route('**/empty.html', route => {
    route.fulfill({ status: 200, body: 'page' });
  });
  const response = await page.goto(server.EMPTY_PAGE);
  expect(response.ok()).toBe(true);
  expect(await response.text()).toBe('page');
  await context.close();
});

it('should fall back to context.route', async ({ browser, server }) => {
  const context = await browser.newContext();
  await context.route('**/empty.html', route => {
    route.fulfill({ status: 200, body: 'context' });
  });
  const page = await context.newPage();
  await page.route('**/non-empty.html', route => {
    route.fulfill({ status: 200, body: 'page' });
  });
  const response = await page.goto(server.EMPTY_PAGE);
  expect(response.ok()).toBe(true);
  expect(await response.text()).toBe('context');
  await context.close();
});

it('should support Set-Cookie header', async ({ contextFactory, server, browserName, defaultSameSiteCookieValue }) => {
  it.fixme(browserName === 'webkit');

  const context = await contextFactory();
  const page = await context.newPage();
  await page.route('https://example.com/', (route, request) => {
    route.fulfill({
      headers: {
        'Set-Cookie': 'name=value; domain=.example.com; Path=/'
      },
      contentType: 'text/html',
      body: 'done'
    });
  });
  await page.goto('https://example.com');
  expect(await context.cookies()).toEqual([{
    sameSite: defaultSameSiteCookieValue,
    name: 'name',
    value: 'value',
    domain: '.example.com',
    path: '/',
    expires: -1,
    httpOnly: false,
    secure: false
  }]);
});

it('should ignore secure Set-Cookie header for insecure requests', async ({ contextFactory, server, browserName }) => {
  it.fixme(browserName === 'webkit');

  const context = await contextFactory();
  const page = await context.newPage();
  await page.route('http://example.com/', (route, request) => {
    route.fulfill({
      headers: {
        'Set-Cookie': 'name=value; domain=.example.com; Path=/; Secure'
      },
      contentType: 'text/html',
      body: 'done'
    });
  });
  await page.goto('http://example.com');
  expect(await context.cookies()).toEqual([]);
});

it('should use Set-Cookie header in future requests', async ({ contextFactory, server, browserName, defaultSameSiteCookieValue }) => {
  it.fixme(browserName === 'webkit');

  const context = await contextFactory();
  const page = await context.newPage();

  await page.route(server.EMPTY_PAGE, (route, request) => {
    route.fulfill({
      headers: {
        'Set-Cookie': 'name=value'
      },
      contentType: 'text/html',
      body: 'done'
    });
  });
  await page.goto(server.EMPTY_PAGE);
  expect(await context.cookies()).toEqual([{
    sameSite: defaultSameSiteCookieValue,
    name: 'name',
    value: 'value',
    domain: 'localhost',
    path: '/',
    expires: -1,
    httpOnly: false,
    secure: false
  }]);

  let cookie = '';
  server.setRoute('/foo.html', (req, res) => {
    cookie = req.headers.cookie;
    res.end();
  });
  await page.goto(server.PREFIX + '/foo.html');
  expect(cookie).toBe('name=value');
});

it('should work with ignoreHTTPSErrors', async ({ browser, httpsServer }) => {
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();

  await page.route('**/*', route => route.continue());
  const response = await page.goto(httpsServer.EMPTY_PAGE);
  expect(response.status()).toBe(200);
  await context.close();
});

it('should support the times parameter with route matching', async ({ context, page, server }) => {
  const intercepted = [];
  await context.route('**/empty.html', route => {
    intercepted.push(1);
    route.continue();
  }, { times: 1 });
  await page.goto(server.EMPTY_PAGE);
  await page.goto(server.EMPTY_PAGE);
  await page.goto(server.EMPTY_PAGE);
  expect(intercepted).toHaveLength(1);
});

it('should overwrite post body with empty string', async ({ context, server, page, browserName }) => {
  await context.route('**/empty.html', route => {
    route.continue({
      postData: '',
    });
  });

  const [req] = await Promise.all([
    server.waitForRequest('/empty.html'),
    page.setContent(`
      <script>
        (async () => {
            await fetch('${server.EMPTY_PAGE}', {
              method: 'POST',
              body: 'original',
            });
        })()
      </script>
    `),
  ]);

  const body = (await req.postBody).toString();
  expect(body).toBe('');
});

it.describe('service workers', () => {
  it('intercepts initial script', async ({ server, page, context, browserName }) => {
    it.fail(browserName === 'firefox');
    context.route('**', async route => {
      if (route.request().url().endsWith('/worker.js')) {
        await route.fulfill({
          status: 200,
          contentType: 'text/javascript',
          body: `
            addEventListener('message', event => {
              console.log('worker got message');
              event.source.postMessage("intercepted data from the worker");
            });
          `,
        });
        return;
      }

      await route.continue();
    });

    server.setRoute('/example.html', (_req, res) => {
      res.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>SW Example</title>
          </head>
          <body>
            <div id="content"></div>
            <script>
              if (navigator.serviceWorker) {
                navigator.serviceWorker.register('/worker.js');
                navigator.serviceWorker.addEventListener('message', event => {
                  console.log('main got message');
                  document.getElementById("content").innerText = event.data;
                });

                navigator.serviceWorker.ready.then(registration => {
                  registration.active.postMessage("init");
                });
              }
            </script>
          </body>
        </html>
      `);
      res.end();
    });

    await page.goto(server.PREFIX + '/example.html');
    await expect(page.locator('#content')).toHaveText('intercepted data from the worker');
  });

  it('intercepts requests from within worker', async ({ server, page, context, browserName }) => {
    it.fail(browserName !== 'chromium');

    context.route('**', async route => {
      if (route.request().url() === server.EMPTY_PAGE) {
        await route.fulfill({
          body: 'intercepted data'
        });
        return;
      }
      await route.continue();
    });

    server.setRoute('/worker.js', (_req, res) => {
      res.setHeader('content-type', 'text/javascript');
      res.write(`
        addEventListener('message', async event => {
          console.log('worker got message');
          const resp = await fetch('${server.EMPTY_PAGE}')
          event.source.postMessage(await resp.text());
        });
      `);
      res.end();
    });

    server.setRoute('/example.html', (_req, res) => {
      res.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>SW Example</title>
          </head>
          <body>
            <div id="content"></div>
            <script>
              if (navigator.serviceWorker) {
                navigator.serviceWorker.register('/worker.js');
                navigator.serviceWorker.addEventListener('message', event => {
                  console.log('main got message');
                  document.getElementById("content").innerText = event.data;
                });

                navigator.serviceWorker.ready.then(registration => {
                  registration.active.postMessage("init");
                });
              }
            </script>
          </body>
        </html>
      `);
      res.end();
    });

    await page.goto(server.PREFIX + '/example.html');
    await expect(page.locator('#content')).toHaveText('intercepted data');
  });

  it('works with redirects on initial script load', () => it.fixme());
  it('works with with redirects on requests within worker', () => it.fixme());
  it('works with CORS requests', () => it.fixme());
  it('works with WebSockets', () => it.fixme());

  it('works with preload', () => it.fixme(true, 'https://developer.mozilla.org/en-US/docs/Web/API/NavigationPreloadManager'));
  it('works with cache API', () => it.fixme(true, 'https://developer.mozilla.org/en-US/docs/Web/API/caches'));

  it('should report requests in HAR file', () => it.fixme());
});
