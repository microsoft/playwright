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
import http2 from 'http2';
import type http from 'http';
import { expect, playwrightTest as base } from '../config/browserTest';
import type net from 'net';
import type { BrowserContextOptions } from 'packages/playwright-test';
const { createHttpsServer } = require('../../packages/playwright-core/lib/utils');

type TestOptions = {
  startCCServer(options?: {
    http2?: boolean;
    useFakeLocalhost?: boolean;
  }): Promise<string>,
};

const test = base.extend<TestOptions>({
  startCCServer: async ({ asset, browserName }, use) => {
    process.env.PWTEST_UNSUPPORTED_CUSTOM_CA = asset('client-certificates/server/server_cert.pem');
    let server: http.Server | http2.Http2Server | undefined;
    await use(async options => {
      server = (options?.http2 ? http2.createSecureServer : createHttpsServer)({
        key: fs.readFileSync(asset('client-certificates/server/server_key.pem')),
        cert: fs.readFileSync(asset('client-certificates/server/server_cert.pem')),
        ca: [
          fs.readFileSync(asset('client-certificates/server/server_cert.pem')),
        ],
        requestCert: true,
        rejectUnauthorized: false,
      }, (req: (http2.Http2ServerRequest | http.IncomingMessage), res: http2.Http2ServerResponse | http.ServerResponse) => {
        const tlsSocket = req.socket as import('tls').TLSSocket;
        // @ts-expect-error https://github.com/DefinitelyTyped/DefinitelyTyped/discussions/62336
        expect(['localhost', 'local.playwright'].includes((tlsSocket).servername)).toBe(true);
        const cert = tlsSocket.getPeerCertificate();
        if (tlsSocket.authorized) {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(`Hello ${cert.subject.CN}, your certificate was issued by ${cert.issuer.CN}!`);
        } else if (cert.subject) {
          res.writeHead(403, { 'Content-Type': 'text/html' });
          res.end(`Sorry ${cert.subject.CN}, certificates from ${cert.issuer.CN} are not welcome here.`);
        } else {
          res.writeHead(401, { 'Content-Type': 'text/html' });
          res.end(`Sorry, but you need to provide a client certificate to continue.`);
        }
      });
      await new Promise<void>(f => server.listen(0, 'localhost', () => f()));
      const host = options?.useFakeLocalhost ? 'local.playwright' : 'localhost';
      return `https://${host}:${(server.address() as net.AddressInfo).port}/`;
    });
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

test.skip(({ mode }) => mode !== 'default');

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
    const request = await playwright.request.newContext();
    const response = await request.get(serverURL);
    expect(response.status()).toBe(401);
    expect(await response.text()).toBe('Sorry, but you need to provide a client certificate to continue.');
    await request.dispose();
  });

  test('should keep supporting http', async ({ playwright, server, asset }) => {
    const request = await playwright.request.newContext({
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
      clientCertificates: [{
        origin: new URL(serverURL).origin,
        certPath: asset('client-certificates/client/self-signed/cert.pem'),
        keyPath: asset('client-certificates/client/self-signed/key.pem'),
      }],
    });
    const response = await request.get(serverURL);
    expect(response.url()).toBe(serverURL);
    expect(response.status()).toBe(403);
    expect(await response.text()).toBe('Sorry Bob, certificates from Bob are not welcome here.');
    await request.dispose();
  });

  test('pass with trusted client certificates', async ({ playwright, startCCServer, asset }) => {
    const serverURL = await startCCServer();
    const request = await playwright.request.newContext({
      clientCertificates: [{
        origin: new URL(serverURL).origin,
        certPath: asset('client-certificates/client/trusted/cert.pem'),
        keyPath: asset('client-certificates/client/trusted/key.pem'),
      }],
    });
    const response = await request.get(serverURL);
    expect(response.url()).toBe(serverURL);
    expect(response.status()).toBe(200);
    expect(await response.text()).toBe('Hello Alice, your certificate was issued by localhost!');
    await request.dispose();
  });

  test('should work in the browser with request interception', async ({ browser, playwright, startCCServer, asset }) => {
    const serverURL = await startCCServer();
    const request = await playwright.request.newContext({
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
    await expect(page.getByText('Hello Alice, your certificate was issued by localhost!')).toBeVisible();
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
      clientCertificates: [{
        origin: 'https://not-matching.com',
        certPath: asset('client-certificates/client/trusted/cert.pem'),
        keyPath: asset('client-certificates/client/trusted/key.pem'),
      }],
    });
    await page.goto(serverURL);
    await expect(page.getByText('Sorry, but you need to provide a client certificate to continue.')).toBeVisible();
    await page.close();
  });

  test('should fail with self-signed client certificates', async ({ browser, startCCServer, asset, browserName }) => {
    const serverURL = await startCCServer({ useFakeLocalhost: browserName === 'webkit' && process.platform === 'darwin' });
    const page = await browser.newPage({
      clientCertificates: [{
        origin: new URL(serverURL).origin,
        certPath: asset('client-certificates/client/self-signed/cert.pem'),
        keyPath: asset('client-certificates/client/self-signed/key.pem'),
      }],
    });
    await page.goto(serverURL);
    await expect(page.getByText('Sorry Bob, certificates from Bob are not welcome here')).toBeVisible();
    await page.close();
  });

  test('should pass with matching certificates', async ({ browser, startCCServer, asset, browserName }) => {
    const serverURL = await startCCServer({ useFakeLocalhost: browserName === 'webkit' && process.platform === 'darwin' });
    const page = await browser.newPage({
      clientCertificates: [{
        origin: new URL(serverURL).origin,
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
    await expect(page.getByText('Playwright client-certificate error')).toBeVisible();
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
        clientCertificates: [{
          origin: new URL(serverURL).origin,
          certPath: asset('client-certificates/client/trusted/cert.pem'),
          keyPath: asset('client-certificates/client/trusted/key.pem'),
        }],
      });
      await page.goto(serverURL);
      await expect(page.getByText('Hello Alice, your certificate was issued by localhost!')).toBeVisible();
    });
  });
});
