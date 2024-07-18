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
import { expect, playwrightTest as base } from '../config/browserTest';
import type net from 'net';
import type { BrowserContextOptions } from 'packages/playwright-test';
const { createHttpsServer } = require('../../packages/playwright-core/lib/utils');

const test = base.extend<{ serverURL: string, serverURLRewrittenToLocalhost: string }>({
  serverURL: async ({ asset }, use) => {
    const server = createHttpsServer({
      key: fs.readFileSync(asset('client-certificates/server/server_key.pem')),
      cert: fs.readFileSync(asset('client-certificates/server/server_cert.pem')),
      ca: [
        fs.readFileSync(asset('client-certificates/server/server_cert.pem')),
      ],
      requestCert: true,
      rejectUnauthorized: false,
    }, (req, res) => {
      const cert = (req.socket as import('tls').TLSSocket).getPeerCertificate();
      if ((req as any).client.authorized) {
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
    process.env.PWTEST_UNSUPPORTED_CUSTOM_CA = asset('client-certificates/server/server_cert.pem');
    await new Promise<void>(f => server.listen(0, 'localhost', () => f()));
    await use(`https://localhost:${(server.address() as net.AddressInfo).port}/`);
    await new Promise<void>(resolve => server.close(() => resolve()));
  },
  serverURLRewrittenToLocalhost: async ({ serverURL, browserName }, use) => {
    const parsed = new URL(serverURL);
    parsed.hostname = 'local.playwright';
    const shouldRewriteToLocalhost = browserName === 'webkit' && process.platform === 'darwin';
    await use(shouldRewriteToLocalhost ? parsed.toString() : serverURL);
  }
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
  [{ clientCertificates: [{ url: 'test', certs: [] }] }, 'No certs specified for url: test'],
  [{ clientCertificates: [{ url: 'test', certs: [{}] }] }, 'None of cert, key, passphrase or pfx is specified'],
  [{
    clientCertificates: [{
      url: 'test',
      certs: [{
        certPath: kDummyFileName,
        keyPath: kDummyFileName,
        pfxPath: kDummyFileName,
        passphrase: kDummyFileName,
      }]
    }]
  }, 'pfx is specified together with cert, key or passphrase'],
  [{
    proxy: { server: 'http://localhost:8080' },
    clientCertificates: [{
      url: 'test',
      certs: [{
        certPath: kDummyFileName,
        keyPath: kDummyFileName,
      }]
    }]
  }, 'Cannot specify both proxy and clientCertificates'],
];

test.describe('fetch', () => {
  test('validate input', async ({ playwright }) => {
    for (const [contextOptions, expected] of kValidationSubTests)
      await expect(playwright.request.newContext(contextOptions)).rejects.toThrow(expected);
  });

  test('should fail with no client certificates provided', async ({ playwright, serverURL }) => {
    const request = await playwright.request.newContext();
    const response = await request.get(serverURL);
    expect(response.status()).toBe(401);
    expect(await response.text()).toBe('Sorry, but you need to provide a client certificate to continue.');
    await request.dispose();
  });

  test('should keep supporting http', async ({ playwright, server, asset }) => {
    const request = await playwright.request.newContext({
      clientCertificates: [{
        url: server.PREFIX,
        certs: [{
          certPath: asset('client-certificates/client/trusted/cert.pem'),
          keyPath: asset('client-certificates/client/trusted/key.pem'),
        }],
      }],
    });
    const response = await request.get(server.PREFIX + '/one-style.html');
    expect(response.url()).toBe(server.PREFIX + '/one-style.html');
    expect(response.status()).toBe(200);
    expect(await response.text()).toContain('<div>hello, world!</div>');
    await request.dispose();
  });

  test('should throw with untrusted client certs', async ({ playwright, serverURL, asset }) => {
    const request = await playwright.request.newContext({
      clientCertificates: [{
        url: serverURL,
        certs: [{
          certPath: asset('client-certificates/client/self-signed/cert.pem'),
          keyPath: asset('client-certificates/client/self-signed/key.pem'),
        }],
      }],
    });
    const response = await request.get(serverURL);
    expect(response.url()).toBe(serverURL);
    expect(response.status()).toBe(403);
    expect(await response.text()).toBe('Sorry Bob, certificates from Bob are not welcome here.');
    await request.dispose();
  });

  test('pass with trusted client certificates', async ({ playwright, serverURL, asset }) => {
    const request = await playwright.request.newContext({
      clientCertificates: [{
        url: serverURL,
        certs: [{
          certPath: asset('client-certificates/client/trusted/cert.pem'),
          keyPath: asset('client-certificates/client/trusted/key.pem'),
        }],
      }],
    });
    const response = await request.get(serverURL);
    expect(response.url()).toBe(serverURL);
    expect(response.status()).toBe(200);
    expect(await response.text()).toBe('Hello Alice, your certificate was issued by localhost!');
    await request.dispose();
  });

  test('should work in the browser with request interception', async ({ browser, playwright, serverURL, asset }) => {
    const request = await playwright.request.newContext({
      clientCertificates: [{
        url: serverURL,
        certs: [{
          certPath: asset('client-certificates/client/trusted/cert.pem'),
          keyPath: asset('client-certificates/client/trusted/key.pem'),
        }],
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
        url: server.PREFIX,
        certs: [{
          certPath: asset('client-certificates/client/trusted/cert.pem'),
          keyPath: asset('client-certificates/client/trusted/key.pem'),
        }],
      }],
    });
    await page.goto(server.PREFIX + '/one-style.html');
    await expect(page.getByText('hello, world!')).toBeVisible();
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(255, 192, 203)');
    await page.close();
  });

  test('should fail with no client certificates', async ({ browser, serverURLRewrittenToLocalhost, asset }) => {
    const page = await browser.newPage({
      clientCertificates: [{
        url: 'https://not-matching.com',
        certs: [{
          certPath: asset('client-certificates/client/trusted/cert.pem'),
          keyPath: asset('client-certificates/client/trusted/key.pem'),
        }],
      }],
    });
    await page.goto(serverURLRewrittenToLocalhost);
    await expect(page.getByText('Sorry, but you need to provide a client certificate to continue.')).toBeVisible();
    await page.close();
  });

  test('should fail with self-signed client certificates', async ({ browser, serverURLRewrittenToLocalhost, asset }) => {
    const page = await browser.newPage({
      clientCertificates: [{
        url: serverURLRewrittenToLocalhost,
        certs: [{
          certPath: asset('client-certificates/client/self-signed/cert.pem'),
          keyPath: asset('client-certificates/client/self-signed/key.pem'),
        }],
      }],
    });
    await page.goto(serverURLRewrittenToLocalhost);
    await expect(page.getByText('Sorry Bob, certificates from Bob are not welcome here')).toBeVisible();
    await page.close();
  });

  test('should pass with matching certificates', async ({ browser, serverURLRewrittenToLocalhost, asset }) => {
    const page = await browser.newPage({
      clientCertificates: [{
        url: serverURLRewrittenToLocalhost,
        certs: [{
          certPath: asset('client-certificates/client/trusted/cert.pem'),
          keyPath: asset('client-certificates/client/trusted/key.pem'),
        }],
      }],
    });
    await page.goto(serverURLRewrittenToLocalhost);
    await expect(page.getByText('Hello Alice, your certificate was issued by localhost!')).toBeVisible();
    await page.close();
  });

  test('should have ignoreHTTPSErrors=false by default', async ({ browser, httpsServer, asset }) => {
    const page = await browser.newPage({
      clientCertificates: [{
        url: 'https://just-there-that-the-client-certificates-proxy-server-is-getting-launched.com',
        certs: [{
          certPath: asset('client-certificates/client/trusted/cert.pem'),
          keyPath: asset('client-certificates/client/trusted/key.pem'),
        }],
      }],
    });
    await page.goto(httpsServer.EMPTY_PAGE);
    await expect(page.getByText('Playwright client-certificate error')).toBeVisible();
    await page.close();
  });

  test.describe('persistentContext', () => {
    test('validate input', async ({ launchPersistent }) => {
      test.slow();
      for (const [contextOptions, expected] of kValidationSubTests)
        await expect(launchPersistent(contextOptions)).rejects.toThrow(expected);
    });

    test('should pass with matching certificates', async ({ launchPersistent, serverURLRewrittenToLocalhost, asset }) => {
      const { page } = await launchPersistent({
        clientCertificates: [{
          url: serverURLRewrittenToLocalhost,
          certs: [{
            certPath: asset('client-certificates/client/trusted/cert.pem'),
            keyPath: asset('client-certificates/client/trusted/key.pem'),
          }],
        }],
      });
      await page.goto(serverURLRewrittenToLocalhost);
      await expect(page.getByText('Hello Alice, your certificate was issued by localhost!')).toBeVisible();
    });
  });
});
