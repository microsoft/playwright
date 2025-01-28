/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { test, expect } from './playwright-test-fixtures';
import http from 'http';

const config = {
  'playwright.config.ts': `
    module.exports = {
      use: {
        mockingProxy: true,
        ignoreHTTPSErrors: true,
      }
    };
  `,
};

test('inject mode', async ({ runInlineTest, server }) => {
  server.setRoute('/page', (req, res) => {
    res.end(req.headers['x-playwright-proxy'] ? 'proxy url injected' : 'proxy url missing');
  });
  const result = await runInlineTest({
    ...config,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('foo', async ({ page }) => {
        await page.goto('${server.PREFIX}/page');
        expect(await page.textContent('body')).toEqual('proxy url injected');
      });
    `
  }, { workers: 1 });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

test('routes are reset between tests', async ({ runInlineTest, server, request }) => {
  server.setRoute('/fallback', async (req, res) => {
    res.end('fallback');
  });
  server.setRoute('/page', async (req, res) => {
    const proxyURL = decodeURIComponent((req.headers['x-playwright-proxy'] as string) ?? '');
    const response = await request.get(proxyURL + server.PREFIX + '/fallback');
    res.end(await response.body());
  });
  const result = await runInlineTest({
    ...config,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('first', async ({ page, request, context }) => {
        await context.route('${server.PREFIX}/fallback', route => route.fulfill({ body: 'first' }));
        await page.goto('${server.PREFIX}/page');
        expect(await page.textContent('body')).toEqual('first');
      });
      test('second', async ({ page, request, context }) => {
        await context.route('${server.PREFIX}/fallback', route => route.fallback());
        await page.goto('${server.PREFIX}/page');
        expect(await page.textContent('body')).toEqual('fallback');
      });
    `
  }, { workers: 1 });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(2);
});

test('all properties are populated', async ({ runInlineTest, server, request }) => {
  server.setRoute('/fallback', async (req, res) => {
    res.statusCode = 201;
    res.setHeader('foo', 'bar');
    res.end('fallback');
  });
  server.setRoute('/page', async (req, res) => {
    const proxyURL = decodeURIComponent((req.headers['x-playwright-proxy'] as string) ?? '');
    const response = await request.get(proxyURL + server.PREFIX + '/fallback');
    res.end(await response.body());
  });
  const result = await runInlineTest({
    ...config,
    'a.test.js': `
      import { test, expect } from '@playwright/test';
      test('test', async ({ page, context }) => {
        let request;
        await context.route('${server.PREFIX}/fallback', route => {
          request = route.request();
          route.continue();
        });
        await page.goto('${server.PREFIX}/page');
        expect(await page.textContent('body')).toEqual('fallback');

        const response = await request.response();
        expect(request.url()).toBe('${server.PREFIX}/fallback');
        expect(response.url()).toBe('${server.PREFIX}/fallback');
        expect(response.status()).toBe(201);
        expect(await response.headersArray()).toContainEqual({ name: 'foo', value: 'bar' });
        expect(await response.body()).toEqual(Buffer.from('fallback'));
    
        expect(await response.finished()).toBe(null);
        expect(request.serviceWorker()).toBe(null);
        expect(() => request.frame()).toThrowError("Assertion error"); // we know the page, but not the frame. should probably improve the error message
    
        expect(request.failure()).toBe(null);
        expect(request.isNavigationRequest()).toBe(false);
        expect(request.redirectedFrom()).toBe(null);
        expect(request.redirectedTo()).toBe(null);
        expect(request.resourceType()).toBe(''); // TODO: should this be different?
        expect(request.method()).toBe('GET');
    
        expect(await request.sizes()).toEqual({
          requestBodySize: 0,
          requestHeadersSize: expect.any(Number),
          responseBodySize: 8,
          responseHeadersSize: 137,
        });
    
        expect(request.timing()).toEqual({
          'connectEnd': expect.any(Number),
          'connectStart': expect.any(Number),
          'domainLookupEnd': expect.any(Number),
          'domainLookupStart': -1,
          'requestStart': expect.any(Number),
          'responseEnd': expect.any(Number),
          'responseStart': expect.any(Number),
          'secureConnectionStart': -1,
          'startTime': expect.any(Number),
        });
    
        expect(await response.securityDetails()).toBe(null);
        expect(await response.serverAddr()).toEqual({
          ipAddress: expect.any(String),
          port: expect.any(Number),
        });
      });
    `
  }, { workers: 1 });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

test('securityDetails', async ({ httpsServer, request, runInlineTest }) => {
  httpsServer.setRoute('/fallback', async (req, res) => {
    res.statusCode = 201;
    res.setHeader('foo', 'bar');
    res.end('fallback');
  });
  httpsServer.setRoute('/page', async (req, res) => {
    const proxyURL = decodeURIComponent((req.headers['x-playwright-proxy'] as string) ?? '');
    const response = await request.get(proxyURL + httpsServer.PREFIX + '/fallback', { ignoreHTTPSErrors: true });
    res.end(await response.body());
  });
  const result = await runInlineTest({
    ...config,
    'a.test.js': `
        import { test, expect } from '@playwright/test';
        test('test', async ({ page, context }) => {
          let request;
          await context.route('${httpsServer.PREFIX}/fallback', route => {
            request = route.request();
            route.continue();
          });
          await page.goto('${httpsServer.PREFIX}/page');
          expect(await page.textContent('body')).toEqual('fallback');
          const response = await request.response();
          expect(await response.securityDetails()).toEqual({
            "issuer": "playwright-test",
            "protocol": expect.any(String),
            "subjectName": "playwright-test",
            "validFrom": expect.any(Number),
            "validTo": expect.any(Number)
          });
        });
      `
  }, { workers: 1 }, { NODE_TLS_REJECT_UNAUTHORIZED: '0' });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

test('aborting', async ({ runInlineTest, server }) => {
  server.setRoute('/page', async (req, res) => {
    const proxyURL = decodeURIComponent((req.headers['x-playwright-proxy'] as string) ?? '');
    const request = http.get(proxyURL + server.PREFIX + '/fallback');
    request.on('error', () => res.end('aborted'));
    request.pipe(res);
  });
  const result = await runInlineTest({
    ...config,
    'a.test.js': `
      import { test, expect } from '@playwright/test';
      test('test', async ({ page, context, request }) => {
        await context.route('${server.PREFIX}/fallback', route => route.abort());
        const response = await request.get('${server.PREFIX}/page')
        expect(await response.text()).toEqual('aborted');
      });
    `
  }, { workers: 1 });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

test('fetch', async ({ runInlineTest, server, request }) => {
  server.setRoute('/fallback', async (req, res) => {
    res.statusCode = 201;
    res.setHeader('foo', 'bar');
    res.end('fallback');
  });
  server.setRoute('/page', async (req, res) => {
    const proxyURL = decodeURIComponent((req.headers['x-playwright-proxy'] as string) ?? '');
    const response = await request.get(proxyURL + server.PREFIX + '/fallback');
    res.end(await response.body());
  });
  const result = await runInlineTest({
    ...config,
    'a.test.js': `
      import { test, expect } from '@playwright/test';
      test('test', async ({ page, context }) => {
        let request;
        await context.route('${server.PREFIX}/fallback', async route => {
          route.fulfill({ response: await route.fetch() });
        });
        await page.goto('${server.PREFIX}/page');
        expect(await page.textContent('body')).toEqual('fallback');
      });
    `
  }, { workers: 1 });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

test('inject mode knows originating page', async ({ runInlineTest, server, request }) => {
  server.setRoute('/fallback', async (req, res) => {
    res.end('fallback');
  });
  server.setRoute('/page', async (req, res) => {
    const proxyURL = decodeURIComponent((req.headers['x-playwright-proxy'] as string) ?? '');
    const response = await request.get(proxyURL + server.PREFIX + '/fallback');
    res.end(await response.body());
  });
  const result = await runInlineTest({
    ...config,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('first', async ({ page, context }) => {
        await page.route('${server.PREFIX}/fallback', route => route.fulfill({ body: 'first' }));
        await page.goto('${server.PREFIX}/page');
        expect(await page.textContent('body')).toEqual('first');
      });
    `
  }, { workers: 1 });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

test('failure', async ({ runInlineTest, server, request }) => {
  server.setRoute('/fallback', async (req, res) => {
    res.socket.destroy();
  });
  server.setRoute('/page', async (req, res) => {
    const proxyURL = decodeURIComponent((req.headers['x-playwright-proxy'] as string) ?? '');
    const response = await request.get(proxyURL + server.PREFIX + '/fallback');
    res.end(await response.body());
  });
  const result = await runInlineTest({
    ...config,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('first', async ({ page, context }) => {
        let request;
        await page.route('${server.PREFIX}/fallback', route => {
          request = route.request();
          route.continue();
        });
        await page.goto('${server.PREFIX}/page');

        expect(request.failure()).toEqual({ errorText: expect.any(String) });
      });
    `
  }, { workers: 1 });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});
