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

import { playwrightTest as it, expect } from './config/browserTest';
import socks from 'socksv5';
import net from 'net';

it('should throw for bad server value', async ({browserType, browserOptions}) => {
  const error = await browserType.launch({
    ...browserOptions,
    // @ts-expect-error server must be a string
    proxy: { server: 123 }
  }).catch(e => e);
  expect(error.message).toContain('proxy.server: expected string, got number');
});

it('should use proxy', async ({browserType, browserOptions, server}) => {
  server.setRoute('/target.html', async (req, res) => {
    res.end('<html><title>Served by the proxy</title></html>');
  });
  const browser = await browserType.launch({
    ...browserOptions,
    proxy: { server: `localhost:${server.PORT}` }
  });
  const page = await browser.newPage();
  await page.goto('http://non-existent.com/target.html');
  expect(await page.title()).toBe('Served by the proxy');
  await browser.close();
});

it('should use proxy for second page', async ({browserType, browserOptions, server}) => {
  server.setRoute('/target.html', async (req, res) => {
    res.end('<html><title>Served by the proxy</title></html>');
  });
  const browser = await browserType.launch({
    ...browserOptions,
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

it('should work with IP:PORT notion', async ({browserType, browserOptions, server}) => {
  server.setRoute('/target.html', async (req, res) => {
    res.end('<html><title>Served by the proxy</title></html>');
  });
  const browser = await browserType.launch({
    ...browserOptions,
    proxy: { server: `127.0.0.1:${server.PORT}` }
  });
  const page = await browser.newPage();
  await page.goto('http://non-existent.com/target.html');
  expect(await page.title()).toBe('Served by the proxy');
  await browser.close();
});

it('should authenticate', async ({browserType, browserOptions, server}) => {
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
    ...browserOptions,
    proxy: { server: `localhost:${server.PORT}`, username: 'user', password: 'secret' }
  });
  const page = await browser.newPage();
  await page.goto('http://non-existent.com/target.html');
  expect(await page.title()).toBe('Basic ' + Buffer.from('user:secret').toString('base64'));
  await browser.close();
});

it('should exclude patterns', async ({browserType, browserOptions, server, browserName, headless}) => {
  it.fixme(browserName === 'chromium' && !headless, 'Chromium headed crashes with CHECK(!in_frame_tree_) in RenderFrameImpl::OnDeleteFrame.');

  server.setRoute('/target.html', async (req, res) => {
    res.end('<html><title>Served by the proxy</title></html>');
  });
  // FYI: using long and weird domain names to avoid ATT DNS hijacking
  // that resolves everything to some weird search results page.
  //
  // @see https://gist.github.com/CollinChaffin/24f6c9652efb3d6d5ef2f5502720ef00
  const browser = await browserType.launch({
    ...browserOptions,
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

it('should use socks proxy', async ({ browserType, browserOptions, socksPort }) => {
  const browser = await browserType.launch({
    ...browserOptions,
    proxy: { server: `socks5://localhost:${socksPort}` }
  });
  const page = await browser.newPage();
  await page.goto('http://non-existent.com');
  expect(await page.title()).toBe('Served by the SOCKS proxy');
  await browser.close();
});

it('should use socks proxy in second page', async ({ browserType, browserOptions, socksPort }) => {
  const browser = await browserType.launch({
    ...browserOptions,
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

it('does launch without a port', async ({ browserType, browserOptions }) => {
  const browser = await browserType.launch({
    ...browserOptions,
    proxy: { server: 'http://localhost' }
  });
  await browser.close();
});

it('should use proxy with emulated user agent', async ({ browserType, browserOptions }) => {
  it.fixme(true, 'Non-emulated user agent is used in proxy CONNECT');

  let requestText = '';
  // This is our proxy server
  const server = net.createServer(socket => {
    socket.on('data', data => {
      requestText = data.toString();
      socket.end();
    });
  });
  await new Promise(f => server.listen(0, f));

  const browser = await browserType.launch({
    ...browserOptions,
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

async function setupSocksForwardingServer(port: number, forwardPort: number){
  const socksServer = socks.createServer((info, accept, deny) => {
    if (!['127.0.0.1', 'fake-localhost-127-0-0-1.nip.io'].includes(info.dstAddr) || info.dstPort !== 1337) {
      deny();
      return;
    }
    const socket = accept(true);
    if (socket) {
      const dstSock = new net.Socket();
      socket.pipe(dstSock).pipe(socket);
      socket.on('close', () => dstSock.end());
      socket.on('end', () => dstSock.end());
      dstSock.setKeepAlive(false);
      dstSock.connect(forwardPort, '127.0.0.1');
    }
  });
  await new Promise(resolve => socksServer.listen(port, 'localhost', resolve));
  socksServer.useAuth(socks.auth.None());
  return {
    closeProxyServer: () => socksServer.close(),
    proxyServerAddr: `socks5://localhost:${port}`,
  };
}

it('should use SOCKS proxy for websocket requests', async ({browserName, platform, browserType, browserOptions, server}, testInfo) => {
  it.fixme(browserName === 'webkit' && platform !== 'linux');
  const {proxyServerAddr, closeProxyServer} = await setupSocksForwardingServer(testInfo.workerIndex + 2048 + 2, server.PORT);
  const browser = await browserType.launch({
    ...browserOptions,
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
  closeProxyServer();
});
