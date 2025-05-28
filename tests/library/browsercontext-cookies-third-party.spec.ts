/**
 * Copyright Microsoft Corporation. All rights reserved.
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

import { contextTest as test, expect } from '../config/browserTest';

import type { Page, BrowserContext } from 'playwright';
import type { TestServer } from '../config/testserver';

test.use({
  ignoreHTTPSErrors: true,
});

test(`third party non-partitioned cookies`, async ({ page, browserName, httpsServer, isMac }) => {
  httpsServer.setRoute('/empty.html', (req, res) => {
    res.setHeader('Set-Cookie', `name=value; SameSite=None; Path=/; Secure;`);
    res.setHeader('Content-Type', 'text/html');
    const cookies = req.headers.cookie?.split(';').map(c => c.trim()).sort().join('; ');
    res.end(`Received cookie: ${cookies}`);
  });
  httpsServer.setRoute('/with-frame.html', (req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.end(`<iframe src='${httpsServer.PREFIX}/empty.html'></iframe>`);
  });

  await page.goto(httpsServer.EMPTY_PAGE);
  await page.goto(httpsServer.EMPTY_PAGE);
  expect(await page.locator('body').textContent()).toBe('Received cookie: name=value');

  await page.goto(httpsServer.CROSS_PROCESS_PREFIX + '/with-frame.html');
  const frameBody = page.locator('iframe').contentFrame().locator('body');

  // WebKit does not support third-party cookies without a 'Partition' attribute.
  if (browserName === 'webkit' && isMac)
    await expect(frameBody).toHaveText('Received cookie: undefined');
  else
    await expect(frameBody).toHaveText('Received cookie: name=value');
});

test(`third party 'Partitioned;' cookies`, async ({ page, browserName, httpsServer, isMac }) => {
  httpsServer.setRoute('/empty.html', (req, res) => {
    res.setHeader('Set-Cookie', [
      `name=value; SameSite=None; Path=/; Secure; Partitioned;`,
      `nonPartitionedName=value; SameSite=None; Path=/; Secure;`
    ]);
    res.setHeader('Content-Type', 'text/html');
    const cookies = req.headers.cookie?.split(';').map(c => c.trim()).sort().join('; ');
    res.end(`Received cookie: ${cookies}`);
  });
  httpsServer.setRoute('/with-frame.html', (req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.end(`<iframe src='${httpsServer.PREFIX}/empty.html'></iframe>`);
  });

  await page.goto(httpsServer.EMPTY_PAGE);
  await page.goto(httpsServer.EMPTY_PAGE);
  expect(await page.locator('body').textContent()).toBe('Received cookie: name=value; nonPartitionedName=value');

  await page.goto(httpsServer.CROSS_PROCESS_PREFIX + '/with-frame.html');
  const frameBody = page.locator('iframe').contentFrame().locator('body');

  // Firefox cookie partitioning is disabled in Firefox.
  // TODO: reenable cookie partitioning?
  if (browserName === 'firefox') {
    await expect(frameBody).toHaveText('Received cookie: name=value; nonPartitionedName=value');
    return;
  }

  // Linux and Windows WebKit builds do not partition third-party cookies at all.
  if (browserName === 'webkit' && !isMac) {
    await expect(frameBody).toHaveText('Received cookie: name=value; nonPartitionedName=value');
    return;
  }

  if (browserName === 'webkit') {
    // WebKit will only send 'Partitioned' third-party cookies exactly matching the partition.
    await expect(frameBody).toHaveText('Received cookie: undefined');
  } else {
    // For non-partitioned cookies, the cookie is sent to the iframe right away,
    // if third-party cookies are supported by the browser.
    await expect(frameBody).toHaveText('Received cookie: nonPartitionedName=value');
  }

  // First navigation:
  // - no cookie sent, as it was only set on the top-level site
  // - sets the third-party cookie for the top-level context
  // Second navigation:
  // - sends the cookie as it was just set for the (top-level site, iframe url) partition.
  await page.goto(httpsServer.CROSS_PROCESS_PREFIX + '/with-frame.html');
  if (browserName === 'webkit')
    await expect(frameBody).toHaveText('Received cookie: undefined');
  else
    await expect(frameBody).toHaveText('Received cookie: name=value; nonPartitionedName=value');
});

test('should be able to send third party cookies via an iframe', async ({ browser, httpsServer, browserName, isMac }) => {
  test.fixme(browserName === 'webkit' && isMac);
  test.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/16937' });

  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
  });
  try {
    const page = await context.newPage();
    await page.goto(httpsServer.EMPTY_PAGE);
    await context.addCookies([{
      domain: new URL(httpsServer.CROSS_PROCESS_PREFIX).hostname,
      path: '/',
      name: 'cookie1',
      value: 'yes',
      httpOnly: true,
      secure: true,
      sameSite: 'None'
    }]);
    const [response] = await Promise.all([
      httpsServer.waitForRequest('/grid.html'),
      page.setContent(`<iframe src="${httpsServer.CROSS_PROCESS_PREFIX}/grid.html"></iframe>`)
    ]);
    expect(response.headers['cookie']).toBe('cookie1=yes');
  } finally {
    await context.close();
  }
});

test('should(not) block third party cookies - persistent context', async ({ httpsServer, launchPersistent, allowsThirdParty }) => {
  const { page, context } = await launchPersistent();
  await testThirdPartyCookiesAreBlocked(page, context, httpsServer, allowsThirdParty);
});

test('should(not) block third party cookies - ephemeral context', async ({ page, context, httpsServer, allowsThirdParty }) => {
  await testThirdPartyCookiesAreBlocked(page, context, httpsServer, allowsThirdParty);
});

async function testThirdPartyCookiesAreBlocked(page: Page, context: BrowserContext, server: TestServer, allowsThirdParty: boolean) {
  await page.goto(server.EMPTY_PAGE);
  await page.evaluate(src => {
    let fulfill;
    const promise = new Promise(x => fulfill = x);
    const iframe = document.createElement('iframe');
    document.body.appendChild(iframe);
    iframe.onload = fulfill;
    iframe.src = src;
    return promise;
  }, server.CROSS_PROCESS_PREFIX + '/grid.html');
  const documentCookie = await page.frames()[1].evaluate(() => {
    document.cookie = 'username=John Doe';
    return document.cookie;
  });
  await page.waitForTimeout(2000);
  expect(documentCookie).toBe(allowsThirdParty ? 'username=John Doe' : '');
  const cookies = await context.cookies(server.CROSS_PROCESS_PREFIX + '/grid.html');
  if (allowsThirdParty) {
    expect(cookies).toEqual([
      {
        'domain': '127.0.0.1',
        'expires': -1,
        'httpOnly': false,
        'name': 'username',
        'path': '/',
        'sameSite': 'None',
        'secure': false,
        'value': 'John Doe'
      }
    ]);
  } else {
    expect(cookies).toEqual([]);
  }
}

test('should not block third party SameSite=None cookies', async ({ contextFactory, httpsServer, browserName }) => {
  test.skip(browserName === 'webkit', 'No third party cookies in WebKit');
  test.skip(process.env.PW_CLOCK === 'frozen');
  const context = await contextFactory({
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();

  httpsServer.setRoute('/empty.html', (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/html'
    });
    res.end(`<iframe src="${httpsServer.CROSS_PROCESS_PREFIX}/grid.html"></iframe>`);
  });

  httpsServer.setRoute('/grid.html', (req, res) => {
    res.writeHead(200, {
      'Set-Cookie': ['a=b; Path=/; Max-Age=3600; SameSite=None; Secure'],
      'Content-Type': 'text/html'
    });
    res.end(`Hello world
    <script>
    setTimeout(() => fetch('/json'), 1000);
    </script>`);
  });

  const cookie = new Promise(f => {
    httpsServer.setRoute('/json', (req, res) => {
      f(req.headers.cookie);
      res.end();
    });
  });

  await page.goto(httpsServer.EMPTY_PAGE);
  expect(await cookie).toBe('a=b');
});
