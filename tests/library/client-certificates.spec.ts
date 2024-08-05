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

import fs from 'fs';
import type http2 from 'http2';
import type http from 'http';
import { expect, playwrightTest as base } from '../config/browserTest';
import type net from 'net';
import type { BrowserContextOptions } from 'packages/playwright-test';
const { createHttpsServer, createHttp2Server } = require('../../packages/playwright-core/lib/utils');

type TestOptions = {
  startCCServer(options?: {
    host?: string;
    http2?: boolean;
    enableHTTP1FallbackWhenUsingHttp2?: boolean;
    useFakeLocalhost?: boolean;
  }): Promise<string>,
};

const test = base.extend<TestOptions>({
  startCCServer: async ({ asset }, use) => {
    process.env.PWTEST_UNSUPPORTED_CUSTOM_CA = asset('client-certificates/server/server_cert.pem');
    let server: http.Server | http2.Http2SecureServer | undefined;
    await use(async options => {
      server = (options?.http2 ? createHttp2Server : createHttpsServer)({
        key: fs.readFileSync(asset('client-certificates/server/server_key.pem')),
        cert: fs.readFileSync(asset('client-certificates/server/server_cert.pem')),
        ca: [
          fs.readFileSync(asset('client-certificates/server/server_cert.pem')),
        ],
        requestCert: true,
        rejectUnauthorized: false,
        allowHTTP1: options?.enableHTTP1FallbackWhenUsingHttp2,
      }, (req: (http2.Http2ServerRequest | http.IncomingMessage), res: http2.Http2ServerResponse | http.ServerResponse) => {
        const tlsSocket = req.socket as import('tls').TLSSocket;
        const parts: { key: string, value: any }[] = [];
        parts.push({ key: 'alpn-protocol', value: tlsSocket.alpnProtocol });
        // @ts-expect-error https://github.com/DefinitelyTyped/DefinitelyTyped/discussions/62336
        parts.push({ key: 'servername', value: tlsSocket.servername });
        const cert = tlsSocket.getPeerCertificate();
        if (tlsSocket.authorized) {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          parts.push({ key: 'message', value: `Hello ${cert.subject.CN}, your certificate was issued by ${cert.issuer.CN}!` });
        } else if (cert.subject) {
          res.writeHead(403, { 'Content-Type': 'text/html' });
          parts.push({ key: 'message', value: `Sorry ${cert.subject.CN}, certificates from ${cert.issuer.CN} are not welcome here.` });
        } else {
          res.writeHead(401, { 'Content-Type': 'text/html' });
          parts.push({ key: 'message', value: `Sorry, but you need to provide a client certificate to continue.` });
        }
        res.end(parts.map(({ key, value }) => `<div data-testid="${key}">${value}</div>`).join(''));
      });
      await new Promise<void>(f => server.listen(0, options?.host ?? 'localhost', () => f()));
      const host = options?.useFakeLocalhost ? 'local.playwright' : 'localhost';
      return `https://${host}:${(server.address() as net.AddressInfo).port}/`;
    });
    if (server)
      await new Promise<void>(resolve => server.close(() => resolve()));
  },
});

test.use({
  launchOptions: async ({ launchOptions }, use) => {
    await use({
      ...launchOptions,
      proxy: { server: 'per-context' }
    });
  }
});

const kDummyFileName = __filename;
const kValidationSubTests: [BrowserContextOptions, string][] = [
  [{ clientCertificates: [{ origin: 'test' }] }, 'None of cert, key, passphrase or pfx is specified'],
  [{
    clientCertificates: [{
      origin: 'test',
      certPath: kDummyFileName,
      keyPath: kDummyFileName,
      pfxPath: kDummyFileName,
      passphrase: kDummyFileName,
    }]
  }, 'pfx is specified together with cert, key or passphrase'],
  [{
    proxy: { server: 'http://localhost:8080' },
    clientCertificates: [{
      origin: 'test',
      certPath: kDummyFileName,
      keyPath: kDummyFileName,
    }]
  }, 'Cannot specify both proxy and clientCertificates'],
];

test.describe('fetch', () => {
  test('validate input', async ({ playwright }) => {
    for (const [contextOptions, expected] of kValidationSubTests)
      await expect(playwright.request.newContext(contextOptions)).rejects.toThrow(expected);
  });

  test('should fail with no client certificates provided', async ({ playwright, startCCServer }) => {
    const serverURL = await startCCServer();
    const request = await playwright.request.newContext({ ignoreHTTPSErrors: true });
    const response = await request.get(serverURL);
    expect(response.status()).toBe(401);
    expect(await response.text()).toContain('Sorry, but you need to provide a client certificate to continue.');
    await request.dispose();
  });

  test('should keep supporting http', async ({ playwright, server, asset }) => {
    const request = await playwright.request.newContext({
      ignoreHTTPSErrors: true,
      clientCertificates: [{
        origin: new URL(server.PREFIX).origin,
        certPath: asset('client-certificates/client/trusted/cert.pem'),
        keyPath: asset('client-certificates/client/trusted/key.pem'),
      }],
    });
    const response = await request.get(server.PREFIX + '/one-style.html');
    expect(response.url()).toBe(server.PREFIX + '/one-style.html');
    expect(response.status()).toBe(200);
    expect(await response.text()).toContain('<div>hello, world!</div>');
    await request.dispose();
  });

  test('should throw with untrusted client certs', async ({ playwright, startCCServer, asset }) => {
    const serverURL = await startCCServer();
    const request = await playwright.request.newContext({
      ignoreHTTPSErrors: true,
      clientCertificates: [{
        origin: new URL(serverURL).origin,
        certPath: asset('client-certificates/client/self-signed/cert.pem'),
        keyPath: asset('client-certificates/client/self-signed/key.pem'),
      }],
    });
    const response = await request.get(serverURL);
    expect(response.url()).toBe(serverURL);
    expect(response.status()).toBe(403);
    expect(await response.text()).toContain('Sorry Bob, certificates from Bob are not welcome here.');
    await request.dispose();
  });

  test('pass with trusted client certificates', async ({ playwright, startCCServer, asset }) => {
    const serverURL = await startCCServer();
    const request = await playwright.request.newContext({
      ignoreHTTPSErrors: true,
      clientCertificates: [{
        origin: new URL(serverURL).origin,
        certPath: asset('client-certificates/client/trusted/cert.pem'),
        keyPath: asset('client-certificates/client/trusted/key.pem'),
      }],
    });
    const response = await request.get(serverURL);
    expect(response.url()).toBe(serverURL);
    expect(response.status()).toBe(200);
    expect(await response.text()).toContain('Hello Alice, your certificate was issued by localhost!');
    await request.dispose();
  });

  test('pass with trusted client certificates in pfx format', async ({ playwright, startCCServer, asset }) => {
    const serverURL = await startCCServer();
    const request = await playwright.request.newContext({
      ignoreHTTPSErrors: true,
      clientCertificates: [{
        origin: new URL(serverURL).origin,
        pfxPath: asset('client-certificates/client/trusted/cert.pfx'),
        passphrase: 'secure'
      }],
    });
    const response = await request.get(serverURL);
    expect(response.url()).toBe(serverURL);
    expect(response.status()).toBe(200);
    expect(await response.text()).toContain('Hello Alice, your certificate was issued by localhost!');
    await request.dispose();
  });

  test('should throw a http error if the pfx passphrase is incorect', async ({ playwright, startCCServer, asset, browserName }) => {
    const serverURL = await startCCServer({ useFakeLocalhost: browserName === 'webkit' && process.platform === 'darwin' });
    const request = await playwright.request.newContext({
      ignoreHTTPSErrors: true,
      clientCertificates: [{
        origin: new URL(serverURL).origin,
        pfxPath: asset('client-certificates/client/trusted/cert.pfx'),
        passphrase: 'this-password-is-incorrect'
      }],
    });
    await expect(request.get(serverURL)).rejects.toThrow('mac verify failure');
    await request.dispose();
  });

  test('should fail with matching certificates in legacy pfx format', async ({ playwright, startCCServer, asset, browserName }) => {
    const serverURL = await startCCServer({ useFakeLocalhost: browserName === 'webkit' && process.platform === 'darwin' });
    const request = await playwright.request.newContext({
      ignoreHTTPSErrors: true,
      clientCertificates: [{
        origin: new URL(serverURL).origin,
        pfxPath: asset('client-certificates/client/trusted/cert-legacy.pfx'),
        passphrase: 'secure'
      }],
    });
    await expect(request.get(serverURL)).rejects.toThrow('Unsupported TLS certificate');
    await request.dispose();
  });

  test('should work in the browser with request interception', async ({ browser, playwright, startCCServer, asset }) => {
    const serverURL = await startCCServer();
    const request = await playwright.request.newContext({
      ignoreHTTPSErrors: true,
      clientCertificates: [{
        origin: new URL(serverURL).origin,
        certPath: asset('client-certificates/client/trusted/cert.pem'),
        keyPath: asset('client-certificates/client/trusted/key.pem'),
      }],
    });
    const page = await browser.newPage({ ignoreHTTPSErrors: true });
    await page.route('**/*', async route => {
      const response = await request.fetch(route.request());
      await route.fulfill({ response });
    });
    await page.goto(serverURL);
    await expect(page.getByTestId('message')).toHaveText('Hello Alice, your certificate was issued by localhost!');
    await page.close();
    await request.dispose();
  });
});


test.describe('browser', () => {
  test('validate input', async ({ browser }) => {
    for (const [contextOptions, expected] of kValidationSubTests)
      await expect(browser.newContext(contextOptions)).rejects.toThrow(expected);
  });

  test('should keep supporting http', async ({ browser, server, asset }) => {
    const page = await browser.newPage({
      clientCertificates: [{
        origin: new URL(server.PREFIX).origin,
        certPath: asset('client-certificates/client/trusted/cert.pem'),
        keyPath: asset('client-certificates/client/trusted/key.pem'),
      }],
    });
    await page.goto(server.PREFIX + '/one-style.html');
    await expect(page.getByText('hello, world!')).toBeVisible();
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(255, 192, 203)');
    await page.close();
  });

  test('should fail with no client certificates', async ({ browser, startCCServer, asset, browserName }) => {
    const serverURL = await startCCServer({ useFakeLocalhost: browserName === 'webkit' && process.platform === 'darwin' });
    const page = await browser.newPage({
      ignoreHTTPSErrors: true,
      clientCertificates: [{
        origin: 'https://not-matching.com',
        certPath: asset('client-certificates/client/trusted/cert.pem'),
        keyPath: asset('client-certificates/client/trusted/key.pem'),
      }],
    });
    await page.goto(serverURL);
    await expect(page.getByTestId('message')).toHaveText('Sorry, but you need to provide a client certificate to continue.');
    await page.close();
  });

  test('should fail with self-signed client certificates', async ({ browser, startCCServer, asset, browserName }) => {
    const serverURL = await startCCServer({ useFakeLocalhost: browserName === 'webkit' && process.platform === 'darwin' });
    const page = await browser.newPage({
      ignoreHTTPSErrors: true,
      clientCertificates: [{
        origin: new URL(serverURL).origin,
        certPath: asset('client-certificates/client/self-signed/cert.pem'),
        keyPath: asset('client-certificates/client/self-signed/key.pem'),
      }],
    });
    await page.goto(serverURL);
    await expect(page.getByTestId('message')).toHaveText('Sorry Bob, certificates from Bob are not welcome here.');
    await page.close();
  });

  test('should pass with matching certificates', async ({ browser, startCCServer, asset, browserName }) => {
    const serverURL = await startCCServer({ useFakeLocalhost: browserName === 'webkit' && process.platform === 'darwin' });
    const page = await browser.newPage({
      ignoreHTTPSErrors: true,
      clientCertificates: [{
        origin: new URL(serverURL).origin,
        certPath: asset('client-certificates/client/trusted/cert.pem'),
        keyPath: asset('client-certificates/client/trusted/key.pem'),
      }],
    });
    await page.goto(serverURL);
    await expect(page.getByTestId('message')).toHaveText('Hello Alice, your certificate was issued by localhost!');
    await page.close();
  });

  test('should pass with matching certificates in pfx format', async ({ browser, startCCServer, asset, browserName }) => {
    const serverURL = await startCCServer({ useFakeLocalhost: browserName === 'webkit' && process.platform === 'darwin' });
    const page = await browser.newPage({
      ignoreHTTPSErrors: true,
      clientCertificates: [{
        origin: new URL(serverURL).origin,
        pfxPath: asset('client-certificates/client/trusted/cert.pfx'),
        passphrase: 'secure'
      }],
    });
    await page.goto(serverURL);
    await expect(page.getByTestId('message')).toHaveText('Hello Alice, your certificate was issued by localhost!');
    await page.close();
  });

  test('should fail with matching certificates in legacy pfx format', async ({ browser, startCCServer, asset, browserName }) => {
    const serverURL = await startCCServer({ useFakeLocalhost: browserName === 'webkit' && process.platform === 'darwin' });
    const page = await browser.newPage({
      ignoreHTTPSErrors: true,
      clientCertificates: [{
        origin: new URL(serverURL).origin,
        pfxPath: asset('client-certificates/client/trusted/cert-legacy.pfx'),
        passphrase: 'secure'
      }],
    });
    await page.goto(serverURL);
    await expect(page.getByText('Unsupported TLS certificate.')).toBeVisible();
    await page.close();
  });

  test('should throw a http error if the pfx passphrase is incorect', async ({ browser, startCCServer, asset, browserName }) => {
    const serverURL = await startCCServer({ useFakeLocalhost: browserName === 'webkit' && process.platform === 'darwin' });
    const page = await browser.newPage({
      ignoreHTTPSErrors: true,
      clientCertificates: [{
        origin: new URL(serverURL).origin,
        pfxPath: asset('client-certificates/client/trusted/cert.pfx'),
        passphrase: 'this-password-is-incorrect'
      }],
    });
    await page.goto(serverURL);
    await expect(page.getByText('Playwright client-certificate error: mac verify failure')).toBeVisible();
    await page.close();
  });

  test('should pass with matching certificates on context APIRequestContext instance', async ({ browser, startCCServer, asset, browserName }) => {
    const serverURL = await startCCServer({ host: '127.0.0.1' });
    const baseOptions = {
      certPath: asset('client-certificates/client/trusted/cert.pem'),
      keyPath: asset('client-certificates/client/trusted/key.pem'),
    };
    const page = await browser.newPage({
      clientCertificates: [{
        origin: new URL(serverURL).origin,
        ...baseOptions,
      }, {
        origin: new URL(serverURL).origin.replace('localhost', '127.0.0.1'),
        ...baseOptions,
      }],
    });
    for (const url of [serverURL, serverURL.replace('localhost', '127.0.0.1')]) {
      const response = await page.request.get(url);
      expect(response.status()).toBe(200);
      expect(await response.text()).toContain('Hello Alice, your certificate was issued by localhost!');
    }
    await page.close();
  });

  test('should pass with matching certificates and trailing slash', async ({ browser, startCCServer, asset, browserName }) => {
    const serverURL = await startCCServer({ useFakeLocalhost: browserName === 'webkit' && process.platform === 'darwin' });
    const page = await browser.newPage({
      ignoreHTTPSErrors: true,
      clientCertificates: [{
        origin: serverURL,
        certPath: asset('client-certificates/client/trusted/cert.pem'),
        keyPath: asset('client-certificates/client/trusted/key.pem'),
      }],
    });
    await page.goto(serverURL);
    await expect(page.getByText('Hello Alice, your certificate was issued by localhost!')).toBeVisible();
    await page.close();
  });

  test('should have ignoreHTTPSErrors=false by default', async ({ browser, httpsServer, asset, browserName, platform }) => {
    const page = await browser.newPage({
      clientCertificates: [{
        origin: 'https://just-there-that-the-client-certificates-proxy-server-is-getting-launched.com',
        certPath: asset('client-certificates/client/trusted/cert.pem'),
        keyPath: asset('client-certificates/client/trusted/key.pem'),
      }],
    });
    await page.goto(browserName === 'webkit' && platform === 'darwin' ? httpsServer.EMPTY_PAGE.replace('localhost', 'local.playwright') : httpsServer.EMPTY_PAGE);
    await expect(page.getByText('Playwright client-certificate error: self-signed certificate')).toBeVisible();
    await page.close();
  });

  test('support http2', async ({ browser, startCCServer, asset, browserName }) => {
    test.skip(browserName === 'webkit' && process.platform === 'darwin', 'WebKit on macOS doesn\n proxy localhost');
    const enableHTTP1FallbackWhenUsingHttp2 = browserName === 'webkit' && process.platform === 'linux';
    const serverURL = await startCCServer({ http2: true, enableHTTP1FallbackWhenUsingHttp2 });
    const page = await browser.newPage({
      ignoreHTTPSErrors: true,
      clientCertificates: [{
        origin: new URL(serverURL).origin,
        certPath: asset('client-certificates/client/trusted/cert.pem'),
        keyPath: asset('client-certificates/client/trusted/key.pem'),
      }],
    });
    // TODO: We should investigate why http2 is not supported in WebKit on Linux.
    // https://bugs.webkit.org/show_bug.cgi?id=276990
    const expectedProtocol = enableHTTP1FallbackWhenUsingHttp2 ? 'http/1.1' : 'h2';
    {
      await page.goto(serverURL.replace('localhost', 'local.playwright'));
      await expect(page.getByTestId('message')).toHaveText('Sorry, but you need to provide a client certificate to continue.');
      await expect(page.getByTestId('alpn-protocol')).toHaveText(expectedProtocol);
      await expect(page.getByTestId('servername')).toHaveText('local.playwright');
    }
    {
      await page.goto(serverURL);
      await expect(page.getByTestId('message')).toHaveText('Hello Alice, your certificate was issued by localhost!');
      await expect(page.getByTestId('alpn-protocol')).toHaveText(expectedProtocol);
    }
    await page.close();
  });

  test('support http2 if the browser only supports http1.1', async ({ browserType, browserName, startCCServer, asset }) => {
    test.skip(browserName !== 'chromium');
    const serverURL = await startCCServer({ http2: true, enableHTTP1FallbackWhenUsingHttp2: true });
    const browser = await browserType.launch({ args: ['--disable-http2'] });
    const page = await browser.newPage({
      ignoreHTTPSErrors: true,
      clientCertificates: [{
        origin: new URL(serverURL).origin,
        certPath: asset('client-certificates/client/trusted/cert.pem'),
        keyPath: asset('client-certificates/client/trusted/key.pem'),
      }],
    });
    {
      await page.goto(serverURL.replace('localhost', 'local.playwright'));
      await expect(page.getByTestId('message')).toHaveText('Sorry, but you need to provide a client certificate to continue.');
      await expect(page.getByTestId('alpn-protocol')).toHaveText('http/1.1');
    }
    {
      await page.goto(serverURL);
      await expect(page.getByTestId('message')).toHaveText('Hello Alice, your certificate was issued by localhost!');
      await expect(page.getByTestId('alpn-protocol')).toHaveText('http/1.1');
    }
    await browser.close();
  });

  test('should return target connection errors when using http2', async ({ browser, startCCServer, asset, browserName }) => {
    test.skip(browserName === 'webkit' && process.platform === 'darwin', 'WebKit on macOS doesn\n proxy localhost');
    test.fixme(browserName === 'webkit' && process.platform === 'linux', 'WebKit on Linux does not support http2 https://bugs.webkit.org/show_bug.cgi?id=276990');
    test.skip(+process.versions.node.split('.')[0] < 20, 'http2.performServerHandshake is not supported in older Node.js versions');

    const serverURL = await startCCServer({ http2: true });
    const page = await browser.newPage({
      clientCertificates: [{
        origin: 'https://just-there-that-the-client-certificates-proxy-server-is-getting-launched.com',
        certPath: asset('client-certificates/client/trusted/cert.pem'),
        keyPath: asset('client-certificates/client/trusted/key.pem'),
      }],
    });
    await page.goto(serverURL);
    await expect(page.getByText('Playwright client-certificate error: self-signed certificate')).toBeVisible();
    await page.close();
  });

  test.describe('persistentContext', () => {
    test('validate input', async ({ launchPersistent }) => {
      test.slow();
      for (const [contextOptions, expected] of kValidationSubTests)
        await expect(launchPersistent(contextOptions)).rejects.toThrow(expected);
    });

    test('should pass with matching certificates', async ({ launchPersistent, startCCServer, asset, browserName }) => {
      const serverURL = await startCCServer({ useFakeLocalhost: browserName === 'webkit' && process.platform === 'darwin' });
      const { page } = await launchPersistent({
        ignoreHTTPSErrors: true,
        clientCertificates: [{
          origin: new URL(serverURL).origin,
          certPath: asset('client-certificates/client/trusted/cert.pem'),
          keyPath: asset('client-certificates/client/trusted/key.pem'),
        }],
      });
      await page.goto(serverURL);
      await expect(page.getByTestId('message')).toHaveText('Hello Alice, your certificate was issued by localhost!');
    });
  });
});
