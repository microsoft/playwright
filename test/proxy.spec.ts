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

import { it, expect } from './fixtures';

import socks from 'socksv5';

it('should throw for bad server value', async ({browserType, defaultBrowserOptions}) => {
  const error = await browserType.launch({
    ...defaultBrowserOptions,
    // @ts-expect-error server must be a string
    proxy: { server: 123 }
  }).catch(e => e);
  expect(error.message).toContain('proxy.server: expected string, got number');
});

it('should use proxy', async ({browserType, defaultBrowserOptions, server}) => {
  server.setRoute('/target.html', async (req, res) => {
    res.end('<html><title>Served by the proxy</title></html>');
  });
  const browser = await browserType.launch({
    ...defaultBrowserOptions,
    proxy: { server: `localhost:${server.PORT}` }
  });
  const page = await browser.newPage();
  await page.goto('http://non-existent.com/target.html');
  expect(await page.title()).toBe('Served by the proxy');
  await browser.close();
});

it('should work with IP:PORT notion', async ({browserType, defaultBrowserOptions, server}) => {
  server.setRoute('/target.html', async (req, res) => {
    res.end('<html><title>Served by the proxy</title></html>');
  });
  const browser = await browserType.launch({
    ...defaultBrowserOptions,
    proxy: { server: `127.0.0.1:${server.PORT}` }
  });
  const page = await browser.newPage();
  await page.goto('http://non-existent.com/target.html');
  expect(await page.title()).toBe('Served by the proxy');
  await browser.close();
});

it('should authenticate', async ({browserType, defaultBrowserOptions, server}) => {
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
  const browser = await browserType.launch({
    ...defaultBrowserOptions,
    proxy: { server: `localhost:${server.PORT}`, username: 'user', password: 'secret' }
  });
  const page = await browser.newPage();
  await page.goto('http://non-existent.com/target.html');
  expect(await page.title()).toBe('Basic ' + Buffer.from('user:secret').toString('base64'));
  await browser.close();
});

it('should exclude patterns', (test, { browserName, headful }) => {
  test.flaky(browserName === 'chromium' && headful, 'Chromium headful crashes with CHECK(!in_frame_tree_) in RenderFrameImpl::OnDeleteFrame.');
}, async ({browserType, defaultBrowserOptions, server}) => {
  server.setRoute('/target.html', async (req, res) => {
    res.end('<html><title>Served by the proxy</title></html>');
  });
  // FYI: using long and weird domain names to avoid ATT DNS hijacking
  // that resolves everything to some weird search results page.
  //
  // @see https://gist.github.com/CollinChaffin/24f6c9652efb3d6d5ef2f5502720ef00
  const browser = await browserType.launch({
    ...defaultBrowserOptions,
    proxy: { server: `localhost:${server.PORT}`, bypass: '1.non.existent.domain.for.the.test, 2.non.existent.domain.for.the.test, .another.test' }
  });

  const page = await browser.newPage();
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

  await browser.close();
});

it('should use socks proxy', (test, { browserName, platform }) => {
  test.flaky(platform === 'darwin' && browserName === 'webkit', 'Intermittent page.goto: The network connection was lost error on bots');
}, async ({ browserType, defaultBrowserOptions, testWorkerIndex }) => {
  const server = socks.createServer((info, accept, deny) => {
    let socket;
    if ((socket = accept(true))) {
      // Catch and ignore ECONNRESET errors.
      socket.on('error', () => {});
      const body = '<html><title>Served by the SOCKS proxy</title></html>';
      socket.end([
        'HTTP/1.1 200 OK',
        'Connection: close',
        'Content-Type: text/html',
        'Content-Length: ' + Buffer.byteLength(body),
        '',
        body
      ].join('\r\n'));
    }
  });
  const socksPort = 9107 + testWorkerIndex * 2;
  server.listen(socksPort, 'localhost');
  server.useAuth(socks.auth.None());

  const browser = await browserType.launch({
    ...defaultBrowserOptions,
    proxy: { server: `socks5://localhost:${socksPort}` }
  });
  const page = await browser.newPage();
  await page.goto('http://non-existent.com');
  expect(await page.title()).toBe('Served by the SOCKS proxy');
  await browser.close();
  server.close();
});

it('does launch without a port', async ({ browserType, defaultBrowserOptions }) => {
  const browser = await browserType.launch({
    ...defaultBrowserOptions,
    proxy: { server: 'http://localhost' }
  });
  await browser.close();
});
