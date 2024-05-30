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

import { browserTest as it, expect } from '../config/browserTest';
import type { Route } from '@playwright/test';

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
    void route.continue();
  });
  const page = await context.newPage();
  const response = await page.goto(server.EMPTY_PAGE);
  expect(response!.ok()).toBe(true);
  expect(intercepted).toBe(true);
  await context.close();
});

it('should unroute', async ({ browser, server }) => {
  const context = await browser.newContext();
  const page = await context.newPage();

  let intercepted: number[] = [];
  await context.route('**/*', route => {
    intercepted.push(1);
    void route.fallback();
  });
  await context.route('**/empty.html', route => {
    intercepted.push(2);
    void route.fallback();
  });
  await context.route('**/empty.html', route => {
    intercepted.push(3);
    void route.fallback();
  });
  const handler4 = (route: Route) => {
    intercepted.push(4);
    void route.fallback();
  };
  await context.route(/empty.html/, handler4);
  await page.goto(server.EMPTY_PAGE);
  expect(intercepted).toEqual([4, 3, 2, 1]);

  intercepted = [];
  await context.unroute(/empty.html/, handler4);
  await page.goto(server.EMPTY_PAGE);
  expect(intercepted).toEqual([3, 2, 1]);

  intercepted = [];
  await context.unroute('**/empty.html');
  await page.goto(server.EMPTY_PAGE);
  expect(intercepted).toEqual([1]);

  await context.close();
});

it('should yield to page.route', async ({ browser, server }) => {
  const context = await browser.newContext();
  await context.route('**/empty.html', route => {
    void route.fulfill({ status: 200, body: 'context' });
  });
  const page = await context.newPage();
  await page.route('**/empty.html', route => {
    void route.fulfill({ status: 200, body: 'page' });
  });
  const response = (await page.goto(server.EMPTY_PAGE))!;
  expect(response.ok()).toBe(true);
  expect(await response.text()).toBe('page');
  await context.close();
});

it('should fall back to context.route', async ({ browser, server }) => {
  const context = await browser.newContext();
  await context.route('**/empty.html', route => {
    void route.fulfill({ status: 200, body: 'context' });
  });
  const page = await context.newPage();
  await page.route('**/non-empty.html', route => {
    void route.fulfill({ status: 200, body: 'page' });
  });
  const response = (await page.goto(server.EMPTY_PAGE))!;
  expect(response.ok()).toBe(true);
  expect(await response.text()).toBe('context');
  await context.close();
});

it('should support Set-Cookie header', async ({ contextFactory, defaultSameSiteCookieValue }) => {
  const context = await contextFactory();
  const page = await context.newPage();
  await page.route('https://example.com/', (route, request) => {
    void route.fulfill({
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
    void route.fulfill({
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

it('should use Set-Cookie header in future requests', async ({ contextFactory, server, defaultSameSiteCookieValue }) => {
  const context = await contextFactory();
  const page = await context.newPage();

  await page.route(server.EMPTY_PAGE, (route, request) => {
    void route.fulfill({
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
    cookie = req.headers.cookie!;
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
  expect(response!.status()).toBe(200);
  await context.close();
});

it('should support the times parameter with route matching', async ({ context, page, server }) => {
  const intercepted: number[] = [];
  await context.route('**/empty.html', route => {
    intercepted.push(1);
    void route.continue();
  }, { times: 1 });
  await page.goto(server.EMPTY_PAGE);
  await page.goto(server.EMPTY_PAGE);
  await page.goto(server.EMPTY_PAGE);
  expect(intercepted).toHaveLength(1);
});

it('should work if handler with times parameter was removed from another handler', async ({ context, page, server }) => {
  const intercepted = [];
  const handler = async route => {
    intercepted.push('first');
    void route.continue();
  };
  await context.route('**/*', handler, { times: 1 });
  await context.route('**/*', async route => {
    intercepted.push('second');
    await context.unroute('**/*', handler);
    await route.fallback();
  });
  await page.goto(server.EMPTY_PAGE);
  expect(intercepted).toEqual(['second']);
  intercepted.length = 0;
  await page.goto(server.EMPTY_PAGE);
  expect(intercepted).toEqual(['second']);
});

it('should support async handler w/ times', async ({ context, page, server }) => {
  await context.route('**/empty.html', async route => {
    await new Promise(f => setTimeout(f, 100));
    void route.fulfill({
      body: '<html>intercepted</html>',
      contentType: 'text/html'
    });
  }, { times: 1 });
  await page.goto(server.EMPTY_PAGE);
  await expect(page.locator('body')).toHaveText('intercepted');
  await page.goto(server.EMPTY_PAGE);
  await expect(page.locator('body')).not.toHaveText('intercepted');
});

it('should overwrite post body with empty string', async ({ context, server, page, browserName }) => {
  await context.route('**/empty.html', route => {
    void route.continue({
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

it('should chain fallback', async ({ context, page, server }) => {
  const intercepted: number[] = [];
  await context.route('**/empty.html', route => {
    intercepted.push(1);
    void route.fallback();
  });
  await context.route('**/empty.html', route => {
    intercepted.push(2);
    void route.fallback();
  });
  await context.route('**/empty.html', route => {
    intercepted.push(3);
    void route.fallback();
  });
  await page.goto(server.EMPTY_PAGE);
  expect(intercepted).toEqual([3, 2, 1]);
});

it('should chain fallback w/ dynamic URL', async ({ context, page, server }) => {
  const intercepted: number[] = [];
  await context.route('**/bar', route => {
    intercepted.push(1);
    void route.fallback({ url: server.EMPTY_PAGE });
  });
  await context.route('**/foo', route => {
    intercepted.push(2);
    void route.fallback({ url: 'http://localhost/bar' });
  });

  await context.route('**/empty.html', route => {
    intercepted.push(3);
    void route.fallback({ url: 'http://localhost/foo' });
  });

  await page.goto(server.EMPTY_PAGE);
  expect(intercepted).toEqual([3, 2, 1]);
});

it('should not chain fulfill', async ({ context, page, server }) => {
  let failed = false;
  await context.route('**/empty.html', route => {
    failed = true;
  });
  await context.route('**/empty.html', route => {
    void route.fulfill({ status: 200, body: 'fulfilled' });
  });
  await context.route('**/empty.html', route => {
    void route.fallback();
  });
  const response = await page.goto(server.EMPTY_PAGE);
  const body = await response!.body();
  expect(body.toString()).toEqual('fulfilled');
  expect(failed).toBeFalsy();
});

it('should not chain abort', async ({ context, page, server }) => {
  let failed = false;
  await context.route('**/empty.html', route => {
    failed = true;
  });
  await context.route('**/empty.html', route => {
    void route.abort();
  });
  await context.route('**/empty.html', route => {
    void route.fallback();
  });
  const e = await page.goto(server.EMPTY_PAGE).catch(e => e);
  expect(e).toBeTruthy();
  expect(failed).toBeFalsy();
});

it('should chain fallback into page', async ({ context, page, server }) => {
  const intercepted: number[] = [];
  await context.route('**/empty.html', route => {
    intercepted.push(1);
    void route.fallback();
  });
  await context.route('**/empty.html', route => {
    intercepted.push(2);
    void route.fallback();
  });
  await context.route('**/empty.html', route => {
    intercepted.push(3);
    void route.fallback();
  });
  await page.route('**/empty.html', route => {
    intercepted.push(4);
    void route.fallback();
  });
  await page.route('**/empty.html', route => {
    intercepted.push(5);
    void route.fallback();
  });
  await page.route('**/empty.html', route => {
    intercepted.push(6);
    void route.fallback();
  });
  await page.goto(server.EMPTY_PAGE);
  expect(intercepted).toEqual([6, 5, 4, 3, 2, 1]);
});

it('should fall back async', async ({ page, context, server }) => {
  const intercepted: number[] = [];
  await context.route('**/empty.html', async route => {
    intercepted.push(1);
    await new Promise(r => setTimeout(r, 100));
    void route.fallback();
  });
  await context.route('**/empty.html', async route => {
    intercepted.push(2);
    await new Promise(r => setTimeout(r, 100));
    void route.fallback();
  });
  await context.route('**/empty.html', async route => {
    intercepted.push(3);
    await new Promise(r => setTimeout(r, 100));
    void route.fallback();
  });
  await page.goto(server.EMPTY_PAGE);
  expect(intercepted).toEqual([3, 2, 1]);
});
