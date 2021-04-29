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

import { browserTest as it, expect } from './config/browserTest';
import type { Browser } from '../index';

let browser: Browser;
it.beforeEach(async ({ browserType, browserOptions }) => {
  if (!browser)
    browser = await browserType.launch({ ...browserOptions, proxy: { server: 'per-context' } });
});
it.afterAll(async () => {
  await browser.close();
});

it('should throw for missing global proxy', async ({ browserType, browserOptions, server }) => {
  delete browserOptions.proxy;
  const browser = await browserType.launch(browserOptions);
  const error = await browser.newContext({ proxy: { server: `localhost:${server.PORT}` } }).catch(e => e);
  expect(error.toString()).toContain('Browser needs to be launched with the global proxy');
  await browser.close();
});

it('should throw for bad server value', async ({ contextOptions }) => {
  const error = await browser.newContext({
    ...contextOptions,
    // @ts-expect-error server must be a string
    proxy: { server: 123 }
  }).catch(e => e);
  expect(error.message).toContain('proxy.server: expected string, got number');
});

it('should use proxy', async ({ contextOptions, server }) => {
  server.setRoute('/target.html', async (req, res) => {
    res.end('<html><title>Served by the proxy</title></html>');
  });
  const context = await browser.newContext({
    ...contextOptions,
    proxy: { server: `localhost:${server.PORT}` }
  });
  const page = await context.newPage();
  await page.goto('http://non-existent.com/target.html');
  expect(await page.title()).toBe('Served by the proxy');
  await context.close();
});

it('should use proxy twice', async ({ contextOptions, server }) => {
  server.setRoute('/target.html', async (req, res) => {
    res.end('<html><title>Served by the proxy</title></html>');
  });
  const context = await browser.newContext({
    ...contextOptions,
    proxy: { server: `localhost:${server.PORT}` }
  });
  const page = await context.newPage();
  await page.goto('http://non-existent.com/target.html');
  await page.goto('http://non-existent-2.com/target.html');
  expect(await page.title()).toBe('Served by the proxy');
  await context.close();
});

it('should use proxy for second page', async ({contextOptions, server}) => {
  server.setRoute('/target.html', async (req, res) => {
    res.end('<html><title>Served by the proxy</title></html>');
  });
  const context = await browser.newContext({
    ...contextOptions,
    proxy: { server: `localhost:${server.PORT}` }
  });

  const page = await context.newPage();
  await page.goto('http://non-existent.com/target.html');
  expect(await page.title()).toBe('Served by the proxy');

  const page2 = await context.newPage();
  await page2.goto('http://non-existent.com/target.html');
  expect(await page2.title()).toBe('Served by the proxy');

  await context.close();
});

it('should work with IP:PORT notion', async ({contextOptions, server}) => {
  server.setRoute('/target.html', async (req, res) => {
    res.end('<html><title>Served by the proxy</title></html>');
  });
  const context = await browser.newContext({
    ...contextOptions,
    proxy: { server: `127.0.0.1:${server.PORT}` }
  });
  const page = await context.newPage();
  await page.goto('http://non-existent.com/target.html');
  expect(await page.title()).toBe('Served by the proxy');
  await context.close();
});

it('should throw for socks5 authentication', async ({contextOptions}) => {
  const error = await browser.newContext({
    ...contextOptions,
    proxy: { server: `socks5://localhost:1234`, username: 'user', password: 'secret' }
  }).catch(e => e);
  expect(error.message).toContain('Browser does not support socks5 proxy authentication');
});

it('should throw for socks4 authentication', async ({contextOptions}) => {
  const error = await browser.newContext({
    ...contextOptions,
    proxy: { server: `socks4://localhost:1234`, username: 'user', password: 'secret' }
  }).catch(e => e);
  expect(error.message).toContain('Socks4 proxy protocol does not support authentication');
});

it('should authenticate', async ({contextOptions, server}) => {
  server.setRoute('/target.html', async (req, res) => {
    const auth = req.headers['proxy-authorization'];
    if (!auth) {
      res.writeHead(407, 'Proxy Authentication Required', {
        'Proxy-Authenticate': 'Basic realm="Access to internal site"'
      });
      res.end();
    } else {
      res.end(`<html><title>${auth}</title></html>`);
    }
  });
  const context = await browser.newContext({
    ...contextOptions,
    proxy: { server: `localhost:${server.PORT}`, username: 'user', password: 'secret' }
  });
  const page = await context.newPage();
  await page.goto('http://non-existent.com/target.html');
  expect(await page.title()).toBe('Basic ' + Buffer.from('user:secret').toString('base64'));
  await context.close();
});

it('should authenticate with empty password', async ({contextOptions, server}) => {
  server.setRoute('/target.html', async (req, res) => {
    const auth = req.headers['proxy-authorization'];
    if (!auth) {
      res.writeHead(407, 'Proxy Authentication Required', {
        'Proxy-Authenticate': 'Basic realm="Access to internal site"'
      });
      res.end();
    } else {
      res.end(`<html><title>${auth}</title></html>`);
    }
  });
  const context = await browser.newContext({
    ...contextOptions,
    proxy: { server: `localhost:${server.PORT}`, username: 'user', password: '' }
  });
  const page = await context.newPage();
  await page.goto('http://non-existent.com/target.html');
  expect(await page.title()).toBe('Basic ' + Buffer.from('user:').toString('base64'));
  await context.close();
});


it('should isolate proxy credentials between contexts', async ({contextOptions, server, browserName}) => {
  it.fixme(browserName === 'firefox', 'Credentials from the first context stick around');

  server.setRoute('/target.html', async (req, res) => {
    const auth = req.headers['proxy-authorization'];
    if (!auth) {
      res.writeHead(407, 'Proxy Authentication Required', {
        'Proxy-Authenticate': 'Basic realm="Access to internal site"'
      });
      res.end();
    } else {
      res.end(`<html><title>${auth}</title></html>`);
    }
  });
  {
    const context = await browser.newContext({
      ...contextOptions,
      proxy: { server: `localhost:${server.PORT}`, username: 'user1', password: 'secret1' }
    });
    const page = await context.newPage();
    await page.goto('http://non-existent.com/target.html');
    expect(await page.title()).toBe('Basic ' + Buffer.from('user1:secret1').toString('base64'));
    await context.close();
  }
  {
    const context = await browser.newContext({
      ...contextOptions,
      proxy: { server: `localhost:${server.PORT}`, username: 'user2', password: 'secret2' }
    });
    const page = await context.newPage();
    await page.goto('http://non-existent.com/target.html');
    expect(await page.title()).toBe('Basic ' + Buffer.from('user2:secret2').toString('base64'));
    await context.close();
  }
});

it('should exclude patterns', async ({contextOptions, server, browserName, headful}) => {
  it.fixme(browserName === 'chromium' && headful, 'Chromium headful crashes with CHECK(!in_frame_tree_) in RenderFrameImpl::OnDeleteFrame.');

  server.setRoute('/target.html', async (req, res) => {
    res.end('<html><title>Served by the proxy</title></html>');
  });
  // FYI: using long and weird domain names to avoid ATT DNS hijacking
  // that resolves everything to some weird search results page.
  //
  // @see https://gist.github.com/CollinChaffin/24f6c9652efb3d6d5ef2f5502720ef00
  const context = await browser.newContext({
    ...contextOptions,
    proxy: { server: `localhost:${server.PORT}`, bypass: '1.non.existent.domain.for.the.test, 2.non.existent.domain.for.the.test, .another.test' }
  });

  const page = await context.newPage();
  await page.goto('http://0.non.existent.domain.for.the.test/target.html');
  expect(await page.title()).toBe('Served by the proxy');

  {
    const error = await page.goto('http://1.non.existent.domain.for.the.test/target.html').catch(e => e);
    expect(error.message).toBeTruthy();
  }

  {
    const error = await page.goto('http://2.non.existent.domain.for.the.test/target.html').catch(e => e);
    expect(error.message).toBeTruthy();
  }

  {
    const error = await page.goto('http://foo.is.the.another.test/target.html').catch(e => e);
    expect(error.message).toBeTruthy();
  }

  {
    await page.goto('http://3.non.existent.domain.for.the.test/target.html');
    expect(await page.title()).toBe('Served by the proxy');
  }

  await context.close();
});

it('should use socks proxy', async ({ contextOptions, socksPort }) => {
  const context = await browser.newContext({
    ...contextOptions,
    proxy: { server: `socks5://localhost:${socksPort}` }
  });
  const page = await context.newPage();
  await page.goto('http://non-existent.com');
  expect(await page.title()).toBe('Served by the SOCKS proxy');
  await context.close();
});

it('should use socks proxy in second page', async ({ contextOptions, socksPort }) => {
  const context = await browser.newContext({
    ...contextOptions,
    proxy: { server: `socks5://localhost:${socksPort}` }
  });

  const page = await context.newPage();
  await page.goto('http://non-existent.com');
  expect(await page.title()).toBe('Served by the SOCKS proxy');

  const page2 = await context.newPage();
  await page2.goto('http://non-existent.com');
  expect(await page2.title()).toBe('Served by the SOCKS proxy');

  await context.close();
});

it('does launch without a port', async ({ contextOptions }) => {
  const context = await browser.newContext({
    ...contextOptions,
    proxy: { server: 'http://localhost' }
  });
  await context.close();
});
