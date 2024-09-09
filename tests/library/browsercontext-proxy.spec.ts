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

import { browserTest as it, expect } from '../config/browserTest';

it.skip(({ mode }) => mode.startsWith('service'));

it.beforeEach(({ server }) => {
  server.setRoute('/target.html', async (req, res) => {
    res.end('<html><title>Served by the proxy</title></html>');
  });
});

it('should work when passing the proxy only on the context level', async ({ browserName, platform, browserType, server, proxyServer }) => {
  // Currently an upstream bug in the network stack of Chromium which leads that
  // the wrong proxy gets used in the BrowserContext.
  it.fixme(browserName === 'chromium' && platform === 'win32');

  proxyServer.forwardTo(server.PORT);
  let browser;
  try {
    browser = await browserType.launch({
      proxy: undefined,
    });
    const context = await browser.newContext({
      proxy: { server: `localhost:${proxyServer.PORT}` }
    });

    const page = await context.newPage();
    await page.goto('http://non-existent.com/target.html');
    expect(proxyServer.requestUrls).toContain('http://non-existent.com/target.html');
    expect(await page.title()).toBe('Served by the proxy');
  } finally {
    await browser.close();
  }
});

it('should throw for bad server value', async ({ contextFactory }) => {
  const error = await contextFactory({
    // @ts-expect-error server must be a string
    proxy: { server: 123 }
  }).catch(e => e);
  expect(error.message).toContain('proxy.server: expected string, got number');
});

it('should use proxy', async ({ contextFactory, server, proxyServer }) => {
  proxyServer.forwardTo(server.PORT);
  const context = await contextFactory({
    proxy: { server: `localhost:${proxyServer.PORT}` }
  });
  const page = await context.newPage();
  await page.goto('http://non-existent.com/target.html');
  expect(proxyServer.requestUrls).toContain('http://non-existent.com/target.html');
  expect(await page.title()).toBe('Served by the proxy');
  await context.close();
});


it('should set cookie for top-level domain', async ({ contextFactory, server, proxyServer, browserName, isLinux }) => {
  it.fixme(browserName === 'webkit' && isLinux);

  proxyServer.forwardTo(server.PORT, { allowConnectRequests: true });
  const context = await contextFactory({
    proxy: { server: `localhost:${proxyServer.PORT}` }
  });
  server.setRoute('/empty.html', (req, res) => {
    res.setHeader('Set-Cookie', `name=val; Domain=codes; Path=/;`);
    res.end();
  });

  await context.request.get('http://codes/empty.html');
  const [cookie] = await context.cookies();
  expect(cookie).toBeTruthy();
  expect(cookie.name).toBe('name');
  expect(cookie.value).toBe('val');
  await context.close();
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
        it(`${params.description}`, async ({ platform, browserName, contextFactory, server, proxyServer }) => {
          it.skip(browserName === 'webkit' && platform === 'darwin' && ['localhost', '127.0.0.1'].includes(params.target) && additionalBypass, 'Mac webkit does not proxy localhost when bypass rules are set');

          const path = `/target-${additionalBypass}-${params.target}.html`;
          server.setRoute(path, async (req, res) => {
            res.end('<html><title>Served by the proxy</title></html>');
          });

          const url = `http://${params.target}:55555${path}`;
          proxyServer.forwardTo(server.PORT);
          const context = await contextFactory({
            proxy: { server: `localhost:${proxyServer.PORT}`, bypass: additionalBypass ? '1.non.existent.domain.for.the.test' : undefined }
          });

          const page = await context.newPage();
          await page.goto(url);
          expect(proxyServer.requestUrls).toContain(url);
          expect(await page.title()).toBe('Served by the proxy');

          await page.goto('http://1.non.existent.domain.for.the.test/foo.html').catch(() => {});
          if (additionalBypass)
            expect(proxyServer.requestUrls).not.toContain('http://1.non.existent.domain.for.the.test/foo.html');
          else
            expect(proxyServer.requestUrls).toContain('http://1.non.existent.domain.for.the.test/foo.html');

          await context.close();
        });
      }
    });
  }
});


it('should use ipv6 proxy', async ({ contextFactory, server, proxyServer, browserName }) => {
  it.fail(browserName === 'firefox', 'page.goto: NS_ERROR_UNKNOWN_HOST');
  proxyServer.forwardTo(server.PORT);
  const context = await contextFactory({
    proxy: { server: `[0:0:0:0:0:0:0:1]:${proxyServer.PORT}` }
  });
  const page = await context.newPage();
  await page.goto('http://non-existent.com/target.html');
  expect(proxyServer.requestUrls).toContain('http://non-existent.com/target.html');
  expect(await page.title()).toBe('Served by the proxy');
  await context.close();
});

it('should use proxy twice', async ({ contextFactory, server, proxyServer }) => {
  proxyServer.forwardTo(server.PORT);
  const context = await contextFactory({
    proxy: { server: `localhost:${proxyServer.PORT}` }
  });
  const page = await context.newPage();
  await page.goto('http://non-existent.com/target.html');
  expect(proxyServer.requestUrls).toContain('http://non-existent.com/target.html');
  await page.goto('http://non-existent-2.com/target.html');
  expect(proxyServer.requestUrls).toContain('http://non-existent-2.com/target.html');
  expect(await page.title()).toBe('Served by the proxy');
  await context.close();
});

it('should use proxy for second page', async ({ contextFactory, server, proxyServer }) => {
  proxyServer.forwardTo(server.PORT);
  const context = await contextFactory({
    proxy: { server: `localhost:${proxyServer.PORT}` }
  });

  const page = await context.newPage();
  await page.goto('http://non-existent.com/target.html');
  expect(proxyServer.requestUrls).toContain('http://non-existent.com/target.html');
  expect(await page.title()).toBe('Served by the proxy');

  const page2 = await context.newPage();
  proxyServer.requestUrls = [];
  await page2.goto('http://non-existent.com/target.html');
  expect(proxyServer.requestUrls).toContain('http://non-existent.com/target.html');
  expect(await page2.title()).toBe('Served by the proxy');

  await context.close();
});

it('should use proxy for https urls', async ({ contextFactory, httpsServer, proxyServer }) => {
  httpsServer.setRoute('/target.html', async (req, res) => {
    res.end('<html><title>Served by https server via proxy</title></html>');
  });
  proxyServer.forwardTo(httpsServer.PORT, { allowConnectRequests: true });
  const context = await contextFactory({
    ignoreHTTPSErrors: true,
    proxy: { server: `localhost:${proxyServer.PORT}` }
  });
  const page = await context.newPage();
  await page.goto('https://non-existent.com/target.html');
  expect(proxyServer.connectHosts).toContain('non-existent.com:443');
  expect(await page.title()).toBe('Served by https server via proxy');
  await context.close();
});

it('should work with IP:PORT notion', async ({ contextFactory, server, proxyServer }) => {
  proxyServer.forwardTo(server.PORT);
  const context = await contextFactory({
    proxy: { server: `127.0.0.1:${proxyServer.PORT}` }
  });
  const page = await context.newPage();
  await page.goto('http://non-existent.com/target.html');
  expect(proxyServer.requestUrls).toContain('http://non-existent.com/target.html');
  expect(await page.title()).toBe('Served by the proxy');
  await context.close();
});

it('should throw for socks5 authentication', async ({ contextFactory }) => {
  const error = await contextFactory({
    proxy: { server: `socks5://localhost:1234`, username: 'user', password: 'secret' }
  }).catch(e => e);
  expect(error.message).toContain('Browser does not support socks5 proxy authentication');
});

it('should throw for socks4 authentication', async ({ contextFactory }) => {
  const error = await contextFactory({
    proxy: { server: `socks4://localhost:1234`, username: 'user', password: 'secret' }
  }).catch(e => e);
  expect(error.message).toContain('Socks4 proxy protocol does not support authentication');
});

it('should authenticate', async ({ contextFactory, server, proxyServer }) => {
  proxyServer.forwardTo(server.PORT);
  let auth;
  proxyServer.setAuthHandler(req => {
    auth = req.headers['proxy-authorization'];
    return !!auth;
  });
  const context = await contextFactory({
    proxy: { server: `localhost:${proxyServer.PORT}`, username: 'user', password: 'secret' }
  });
  const page = await context.newPage();
  await page.goto('http://non-existent.com/target.html');
  expect(proxyServer.requestUrls).toContain('http://non-existent.com/target.html');
  expect(auth).toBe('Basic ' + Buffer.from('user:secret').toString('base64'));
  expect(await page.title()).toBe('Served by the proxy');
  await context.close();
});

it('should authenticate with empty password', async ({ contextFactory, server, proxyServer }) => {
  proxyServer.forwardTo(server.PORT);
  let auth;
  proxyServer.setAuthHandler(req => {
    auth = req.headers['proxy-authorization'];
    return !!auth;
  });
  const context = await contextFactory({
    proxy: { server: `localhost:${proxyServer.PORT}`, username: 'user', password: '' }
  });
  const page = await context.newPage();
  await page.goto('http://non-existent.com/target.html');
  expect(auth).toBe('Basic ' + Buffer.from('user:').toString('base64'));
  expect(await page.title()).toBe('Served by the proxy');
  await context.close();
});

it('should isolate proxy credentials between contexts', async ({ contextFactory, server, browserName, proxyServer }) => {
  proxyServer.forwardTo(server.PORT);
  let auth;
  proxyServer.setAuthHandler(req => {
    auth = req.headers['proxy-authorization'];
    return !!auth;
  });
  {
    const context = await contextFactory({
      proxy: { server: `localhost:${proxyServer.PORT}`, username: 'user1', password: 'secret1' }
    });
    const page = await context.newPage();
    await page.goto('http://non-existent.com/target.html');
    expect(auth).toBe('Basic ' + Buffer.from('user1:secret1').toString('base64'));
    expect(await page.title()).toBe('Served by the proxy');
    await context.close();
  }
  auth = undefined;
  {
    const context = await contextFactory({
      proxy: { server: `localhost:${proxyServer.PORT}`, username: 'user2', password: 'secret2' }
    });
    const page = await context.newPage();
    await page.goto('http://non-existent.com/target.html');
    expect(await page.title()).toBe('Served by the proxy');
    expect(auth).toBe('Basic ' + Buffer.from('user2:secret2').toString('base64'));
    await context.close();
  }
});

it('should exclude patterns', async ({ contextFactory, server, proxyServer }) => {
  proxyServer.forwardTo(server.PORT);
  // FYI: using long and weird domain names to avoid ATT DNS hijacking
  // that resolves everything to some weird search results page.
  //
  // @see https://gist.github.com/CollinChaffin/24f6c9652efb3d6d5ef2f5502720ef00
  const context = await contextFactory({
    proxy: { server: `localhost:${proxyServer.PORT}`, bypass: '1.non.existent.domain.for.the.test, 2.non.existent.domain.for.the.test, .another.test' }
  });

  const nonFaviconUrls = () => {
    return proxyServer.requestUrls.filter(u => !u.includes('favicon'));
  };

  {
    proxyServer.requestUrls = [];
    const page = await context.newPage();
    await page.goto('http://0.non.existent.domain.for.the.test/target.html');
    expect(proxyServer.requestUrls).toContain('http://0.non.existent.domain.for.the.test/target.html');
    expect(await page.title()).toBe('Served by the proxy');
    await page.close();
  }

  {
    proxyServer.requestUrls = [];
    const page = await context.newPage();
    const error = await page.goto('http://1.non.existent.domain.for.the.test/target.html').catch(e => e);
    expect(nonFaviconUrls()).toEqual([]);
    expect(error.message).toBeTruthy();
    await page.close();
  }

  {
    proxyServer.requestUrls = [];
    const page = await context.newPage();
    const error = await page.goto('http://2.non.existent.domain.for.the.test/target.html').catch(e => e);
    expect(nonFaviconUrls()).toEqual([]);
    expect(error.message).toBeTruthy();
    await page.close();
  }

  {
    proxyServer.requestUrls = [];
    const page = await context.newPage();
    const error = await page.goto('http://foo.is.the.another.test/target.html').catch(e => e);
    expect(nonFaviconUrls()).toEqual([]);
    expect(error.message).toBeTruthy();
    await page.close();
  }

  {
    proxyServer.requestUrls = [];
    const page = await context.newPage();
    await page.goto('http://3.non.existent.domain.for.the.test/target.html');
    expect(nonFaviconUrls()).toContain('http://3.non.existent.domain.for.the.test/target.html');
    expect(await page.title()).toBe('Served by the proxy');
    await page.close();
  }

  await context.close();
});

it('should use socks proxy', async ({ contextFactory, socksPort }) => {
  const context = await contextFactory({
    proxy: { server: `socks5://localhost:${socksPort}` }
  });
  const page = await context.newPage();
  await page.goto('http://non-existent.com');
  expect(await page.title()).toBe('Served by the SOCKS proxy');
  await context.close();
});

it('should use socks proxy in second page', async ({ contextFactory, socksPort }) => {
  const context = await contextFactory({
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

it('does launch without a port', async ({ contextFactory }) => {
  const context = await contextFactory({
    proxy: { server: 'http://localhost' }
  });
  await context.close();
});

it('should isolate proxy credentials between contexts on navigation', async ({ contextFactory, server }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/31525' });

  server.setRoute('/target.html', async (req, res) => {
    const authHeader = req.headers['proxy-authorization'];

    if (!authHeader) {
      res.writeHead(407, { 'Proxy-Authenticate': 'Basic realm="proxy"' });
      res.end('Proxy authorization required');
      return;
    }

    const [username,] = Buffer.from(authHeader.split(' ')[1], 'base64').toString().split(':');
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`Hello <div data-testid=user>${username}</div>!\n`);
  });

  const context1 = await contextFactory({
    proxy: { server: server.PREFIX, username: 'user1', password: 'secret1' }
  });
  const page1 = await context1.newPage();
  await page1.goto('http://non-existent.com/target.html');
  await expect(page1.getByTestId('user')).toHaveText('user1');

  const context2 = await contextFactory({
    proxy: { server: server.PREFIX, username: 'user2', password: 'secret2' }
  });
  const page2 = await context2.newPage();
  await page2.goto('http://non-existent.com/target.html');
  await expect(page2.getByTestId('user')).toHaveText('user2');

  await page1.goto('http://non-existent.com/target.html');
  await expect(page1.getByTestId('user')).toHaveText('user1');
});
