/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
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

import https from 'node:https';
import { contextTest as it, expect } from '../config/browserTest';
import { TestServer } from '../config/testserver';

it.skip(({ mode }) => mode !== 'default');

it('context request should pick up proxy credentials', async ({ browserType, server, proxyServer }) => {
  proxyServer.forwardTo(server.PORT, { allowConnectRequests: true });
  const authPromise = new Promise<string>(resolve => {
    proxyServer.setAuthHandler(req => {
      const header = req.headers['proxy-authorization'];
      // Browser can issue various unrelated requests over the proxy,
      // but we are only interested in our own request.
      if (proxyServer.connectHosts.includes('non-existent.com:80'))
        resolve(header);
      return !!header;
    });
  });
  const browser = await browserType.launch({
    proxy: { server: `localhost:${proxyServer.PORT}`, username: 'user', password: 'secret' }
  });
  const context = await browser.newContext();
  const response = await context.request.get('http://non-existent.com/simple.json');
  expect(proxyServer.connectHosts).toContain('non-existent.com:80');
  const auth = await authPromise;
  expect(auth).toBe('Basic ' + Buffer.from('user:secret').toString('base64'));
  expect(await response.json()).toEqual({ foo: 'bar' });
  await browser.close();
});

it('global request should pick up proxy credentials', async ({ playwright, server, proxyServer }) => {
  proxyServer.forwardTo(server.PORT, { allowConnectRequests: true });
  let auth;
  proxyServer.setAuthHandler(req => {
    auth = req.headers['proxy-authorization'];
    return !!auth;
  });
  const request = await playwright.request.newContext({
    proxy: { server: `localhost:${proxyServer.PORT}`, username: 'user', password: 'secret' }
  });
  const response = await request.get('http://non-existent.com/simple.json');
  expect(proxyServer.connectHosts).toContain('non-existent.com:80');
  expect(auth).toBe('Basic ' + Buffer.from('user:secret').toString('base64'));
  expect(await response.json()).toEqual({ foo: 'bar' });
  await request.dispose();
});

it('should work with context level proxy', async ({ contextFactory, contextOptions, server, proxyServer }) => {
  server.setRoute('/target.html', async (req, res) => {
    res.end('<title>Served by the proxy</title>');
  });

  proxyServer.forwardTo(server.PORT, { allowConnectRequests: true });
  const context = await contextFactory({
    proxy: { server: `localhost:${proxyServer.PORT}` }
  });

  const [request, response] = await Promise.all([
    server.waitForRequest('/target.html'),
    context.request.get(`http://non-existent.com/target.html`)
  ]);
  expect(response.status()).toBe(200);
  expect(request.url).toBe('/target.html');
});

it(`should support proxy.bypass`, async ({ contextFactory, contextOptions, server, proxyServer }) => {
  server.setRoute('/target.html', async (req, res) => {
    res.end('Served by the proxy');
  });
  // FYI: using long and weird domain names to avoid ATT DNS hijacking
  // that resolves everything to some weird search results page.
  //
  // @see https://gist.github.com/CollinChaffin/24f6c9652efb3d6d5ef2f5502720ef00
  proxyServer.forwardTo(server.PORT, { allowConnectRequests: true });
  const context = await contextFactory({
    ...contextOptions,
    proxy: { server: `localhost:${proxyServer.PORT}`, bypass: `1.non.existent.domain.for.the.test, 2.non.existent.domain.for.the.test, .another.test` }
  });

  {
    const res = await context.request.get(server.CROSS_PROCESS_PREFIX + '/target.html');
    expect(await res.text()).toContain('Served by the proxy');
    expect(proxyServer.connectHosts).toContain(new URL(server.CROSS_PROCESS_PREFIX).host);
    proxyServer.connectHosts = [];
  }

  {
    const res = await context.request.get('http://0.non.existent.domain.for.the.test/target.html');
    expect(await res.text()).toContain('Served by the proxy');
    proxyServer.connectHosts = [];
  }

  {
    const error = await context.request.get('http://1.non.existent.domain.for.the.test/target.html').catch(e => e);
    expect(error.message).toBeTruthy();
    expect(proxyServer.connectHosts).toEqual([]);
  }

  {
    const error = await context.request.get('http://2.non.existent.domain.for.the.test/target.html').catch(e => e);
    expect(error.message).toBeTruthy();
    expect(proxyServer.connectHosts).toEqual([]);
  }

  {
    const error = await context.request.get('http://foo.is.the.another.test/target.html').catch(e => e);
    expect(error.message).toBeTruthy();
    expect(proxyServer.connectHosts).toEqual([]);
  }

  {
    const res = await context.request.get('http://3.non.existent.domain.for.the.test/target.html');
    expect(await res.text()).toContain('Served by the proxy');
  }
});

it('should use socks proxy', async ({ playwright, server, socksPort }) => {
  it.skip(!!process.env.INSIDE_DOCKER, 'connect ECONNREFUSED 127.0.0.1:<port>');

  const request = await playwright.request.newContext({ proxy: {
    server: `socks5://localhost:${socksPort}`,
  } });
  const response = await request.get(server.EMPTY_PAGE);
  expect(await response.text()).toContain('Served by the SOCKS proxy');
});

it('should send correct ALPN protocol to HTTPS proxy', { annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/37676' } }, async ({ playwright, server, nodeVersion }) => {
  it.skip(nodeVersion.major < 22, 'ALPNCallback is supported starting from Node 22');

  let offeredProtocols: string[];
  const proxy = https.createServer({
    ...(await TestServer.certOptions()),
    ALPNCallback: protocols => {
      offeredProtocols = protocols.protocols;
      return protocols[0];
    },
  });

  const port = await new Promise<number>(resolve => {
    proxy.listen(0, () => {
      const { port } = proxy.address() as any;
      resolve(port);
    });
  });

  const request = await playwright.request.newContext({
    proxy: { server: `https://localhost:${port}` },
    ignoreHTTPSErrors: true,
  });

  await expect(request.get(server.EMPTY_PAGE)).rejects.toThrowError();

  expect(offeredProtocols).toContain('http/1.1');

  proxy.close();
  await request.dispose();
});
