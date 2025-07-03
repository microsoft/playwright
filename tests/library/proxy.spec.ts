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

import { setupSocksForwardingServer } from '../config/proxy';
import { playwrightTest as it, expect } from '../config/browserTest';
import net from 'net';

it.skip(({ mode }) => mode.startsWith('service'));

it('should throw for bad server value', async ({ browserType }) => {
  const error = await browserType.launch({
    // @ts-expect-error server must be a string
    proxy: { server: 123 }
  }).catch(e => e);
  expect(error.message).toContain('proxy.server: expected string, got number');
});

it('should use proxy @smoke', async ({ browserType, server, mode }) => {
  server.setRoute('/target.html', async (req, res) => {
    res.end('<html><title>Served by the proxy</title></html>');
  });
  const browser = await browserType.launch({
    proxy: { server: server.HOST }
  });
  const page = await browser.newPage();
  await page.goto('http://non-existent.com/target.html');
  expect(await page.title()).toBe('Served by the proxy');
  await browser.close();
});

it('should use proxy for second page', async ({ browserType, server }) => {
  server.setRoute('/target.html', async (req, res) => {
    res.end('<html><title>Served by the proxy</title></html>');
  });
  const browser = await browserType.launch({
    proxy: { server: `localhost:${server.PORT}` }
  });

  const page = await browser.newPage();
  await page.goto('http://non-existent.com/target.html');
  expect(await page.title()).toBe('Served by the proxy');

  const page2 = await browser.newPage();
  await page2.goto('http://non-existent.com/target.html');
  expect(await page2.title()).toBe('Served by the proxy');

  await browser.close();
});

it('should work with IP:PORT notion', async ({ browserType, server }) => {
  server.setRoute('/target.html', async (req, res) => {
    res.end('<html><title>Served by the proxy</title></html>');
  });
  const browser = await browserType.launch({
    proxy: { server: `127.0.0.1:${server.PORT}` }
  });
  const page = await browser.newPage();
  await page.goto('http://non-existent.com/target.html');
  expect(await page.title()).toBe('Served by the proxy');
  await browser.close();
});

it.describe('should proxy local network requests', () => {
  for (const additionalBypass of [false, true]) {
    it.describe(additionalBypass ? 'with other bypasses' : 'by default', () => {
      for (const params of [
        {
          target: 'localhost',
          description: 'localhost',
        },
        {
          target: '127.0.0.1',
          description: 'loopback address',
        },
        {
          target: '169.254.3.4',
          description: 'link-local'
        }
      ]) {
        it(`${params.description}`, async ({ platform, browserName, browserType, server, proxyServer }) => {
          it.skip(browserName === 'webkit' && platform === 'darwin' && ['localhost', '127.0.0.1'].includes(params.target) && additionalBypass, 'Mac webkit does not proxy localhost when bypass rules are set.');

          const path = `/target-${additionalBypass}-${params.target}.html`;
          server.setRoute(path, async (req, res) => {
            res.end('<html><title>Served by the proxy</title></html>');
          });

          const url = `http://${params.target}:55555${path}`;
          proxyServer.forwardTo(server.PORT);
          const browser = await browserType.launch({
            proxy: { server: `localhost:${proxyServer.PORT}`, bypass: additionalBypass ? '1.non.existent.domain.for.the.test' : undefined }
          });

          const page = await browser.newPage();
          await page.goto(url);
          expect(proxyServer.requestUrls).toContain(url);
          expect(await page.title()).toBe('Served by the proxy');

          await page.goto('http://1.non.existent.domain.for.the.test/foo.html').catch(() => {});
          if (additionalBypass)
            expect(proxyServer.requestUrls).not.toContain('http://1.non.existent.domain.for.the.test/foo.html');
          else
            expect(proxyServer.requestUrls).toContain('http://1.non.existent.domain.for.the.test/foo.html');

          await browser.close();
        });
      }
    });
  }
});

it('should authenticate', async ({ browserType, server }) => {
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
    proxy: { server: server.HOST, username: 'user', password: 'secret' }
  });
  const page = await browser.newPage();
  await page.goto('http://non-existent.com/target.html');
  expect(await page.title()).toBe('Basic ' + Buffer.from('user:secret').toString('base64'));
  await browser.close();
});

it('should work with authenticate followed by redirect', async ({ browserName, browserType, server }) => {
  function hasAuth(req, res) {
    const auth = req.headers['proxy-authorization'];
    if (!auth) {
      res.writeHead(407, 'Proxy Authentication Required', {
        'Proxy-Authenticate': 'Basic realm="Access to internal site"'
      });
      res.end();
      return false;
    }
    return true;
  }
  server.setRoute('/page1.html', async (req, res) => {
    if (!hasAuth(req, res))
      return;
    res.writeHead(302, { location: '/page2.html' });
    res.end();
  });
  server.setRoute('/page2.html', async (req, res) => {
    if (!hasAuth(req, res))
      return;
    res.end('<html><title>Served by the proxy</title></html>');
  });
  const browser = await browserType.launch({
    proxy: { server: server.HOST, username: 'user', password: 'secret' }
  });
  const page = await browser.newPage();
  await page.goto('http://non-existent.com/page1.html');
  expect(await page.title()).toBe('Served by the proxy');
  await browser.close();
});

it('should exclude patterns', async ({ browserType, server, browserName, headless }) => {
  server.setRoute('/target.html', async (req, res) => {
    res.end('<html><title>Served by the proxy</title></html>');
  });
  // FYI: using long and weird domain names to avoid ATT DNS hijacking
  // that resolves everything to some weird search results page.
  //
  // @see https://gist.github.com/CollinChaffin/24f6c9652efb3d6d5ef2f5502720ef00
  const browser = await browserType.launch({
    proxy: { server: server.HOST, bypass: '1.non.existent.domain.for.the.test, 2.non.existent.domain.for.the.test, .another.test' }
  });

  {
    const page = await browser.newPage();
    await page.goto('http://0.non.existent.domain.for.the.test/target.html');
    expect(await page.title()).toBe('Served by the proxy');
    await page.close();
  }

  {
    const page = await browser.newPage();
    const error = await page.goto('http://1.non.existent.domain.for.the.test/target.html').catch(e => e);
    expect(error.message).toBeTruthy();
    await page.close();
  }

  {
    const page = await browser.newPage();
    const error = await page.goto('http://2.non.existent.domain.for.the.test/target.html').catch(e => e);
    expect(error.message).toBeTruthy();
    await page.close();
  }

  {
    const page = await browser.newPage();
    const error = await page.goto('http://foo.is.the.another.test/target.html').catch(e => e);
    expect(error.message).toBeTruthy();
    await page.close();
  }

  {
    const page = await browser.newPage();
    await page.goto('http://3.non.existent.domain.for.the.test/target.html');
    expect(await page.title()).toBe('Served by the proxy');
    await page.close();
  }

  await browser.close();
});

it('should use socks proxy', async ({ browserType, socksPort }) => {
  const browser = await browserType.launch({
    proxy: { server: `socks5://localhost:${socksPort}` }
  });
  const page = await browser.newPage();
  await page.goto('http://non-existent.com');
  expect(await page.title()).toBe('Served by the SOCKS proxy');
  await browser.close();
});

it('should use socks proxy in second page', async ({ browserType, socksPort }) => {
  const browser = await browserType.launch({
    proxy: { server: `socks5://localhost:${socksPort}` }
  });

  const page = await browser.newPage();
  await page.goto('http://non-existent.com');
  expect(await page.title()).toBe('Served by the SOCKS proxy');

  const page2 = await browser.newPage();
  await page2.goto('http://non-existent.com');
  expect(await page2.title()).toBe('Served by the SOCKS proxy');

  await browser.close();
});

it('does launch without a port', async ({ browserType }) => {
  const browser = await browserType.launch({
    proxy: { server: 'http://localhost' }
  });
  await browser.close();
});

it('should use proxy with emulated user agent', async ({ browserType }) => {
  it.fixme(true, 'Non-emulated user agent is used in proxy CONNECT');

  let requestText = '';
  // This is our proxy server
  const server = net.createServer(socket => {
    socket.on('data', data => {
      requestText = data.toString();
      socket.end();
    });
  });
  await new Promise<void>(f => server.listen(0, f));

  const browser = await browserType.launch({
    proxy: { server: `http://127.0.0.1:${(server.address() as any).port}` }
  });

  const page = await browser.newPage({
    userAgent: 'MyUserAgent'
  });

  // HTTPS over HTTP proxy will start with CONNECT request.
  await page.goto('https://bing.com/').catch(() => {});
  await browser.close();
  server.close();
  // This connect request should have emulated user agent.
  expect(requestText).toContain('MyUserAgent');
});


it('should use SOCKS proxy for websocket requests', async ({ browserType, server }) => {
  const { proxyServerAddr, closeProxyServer } = await setupSocksForwardingServer({
    port: it.info().workerIndex + 2048 + 2,
    forwardPort: server.PORT,
    allowedTargetPort: 1337,
  });
  const browser = await browserType.launch({
    proxy: {
      server: proxyServerAddr,
    }
  });
  server.sendOnWebSocketConnection('incoming');
  server.setRoute('/target.html', async (req, res) => {
    res.end('<html><title>Served by the proxy</title></html>');
  });

  const page = await browser.newPage();

  // Hosts get resolved by the client
  await page.goto('http://fake-localhost-127-0-0-1.nip.io:1337/target.html');
  expect(await page.title()).toBe('Served by the proxy');

  const value = await page.evaluate(() => {
    let cb;
    const result = new Promise(f => cb = f);
    const ws = new WebSocket('ws://fake-localhost-127-0-0-1.nip.io:1337/ws');
    ws.addEventListener('message', data => { ws.close(); cb(data.data); });
    return result;
  });
  expect(value).toBe('incoming');

  await browser.close();
  await closeProxyServer();
});

it('should use http proxy for websocket requests', async ({ browserName, browserType, server, proxyServer, isWindows, isMac, macVersion }) => {
  it.skip(isMac && macVersion === 13, 'Times out on Mac 13');

  proxyServer.forwardTo(server.PORT, { allowConnectRequests: true });
  const browser = await browserType.launch({
    proxy: { server: `localhost:${proxyServer.PORT}` }
  });

  server.sendOnWebSocketConnection('incoming');
  server.setRoute('/target.html', async (req, res) => {
    res.end('<html><title>Served by the proxy</title></html>');
  });

  const page = await browser.newPage();

  await page.goto('http://fake-localhost-127-0-0-1.nip.io:1337/target.html');
  expect(await page.title()).toBe('Served by the proxy');

  const value = await page.evaluate(() => {
    let cb;
    const result = new Promise(f => cb = f);
    const ws = new WebSocket('ws://fake-localhost-127-0-0-1.nip.io:1337/ws');
    ws.addEventListener('message', data => { ws.close(); cb(data.data); });
    return result;
  });
  expect(value).toBe('incoming');

  // WebKit does not use CONNECT for websockets, but other browsers do.
  if (browserName === 'webkit')
    expect(proxyServer.wsUrls).toContain(isWindows ? '/ws' : 'ws://fake-localhost-127-0-0-1.nip.io:1337/ws');
  else
    expect(proxyServer.connectHosts).toContain('fake-localhost-127-0-0-1.nip.io:1337');

  await browser.close();
});
