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

import { contextTest, expect } from '../config/browserTest';

import type { Page, BrowserContext, Cookie } from 'playwright';
import type { TestServer } from '../config/testserver';

type TestUrls = {
  origin1: string;
  origin2: string;
  read_origin1: string;
  read_origin2_origin1: string;
  read_origin1_origin1: string;
  read_origin1_origin2_origin1: string;
  set_origin1: string;
  set_origin2_origin1: string;
  set_origin1_origin2_origin1: string;
};

const test = contextTest.extend<{ urls: TestUrls }>({
  urls: async ({ httpsServer }, run) => {
    const origin1 = httpsServer.PREFIX;
    const origin2 = httpsServer.CROSS_PROCESS_PREFIX;
    await run({
      origin1,
      origin2,
      read_origin1: origin1 + '/read-cookie.html',
      read_origin2_origin1: origin2 + '/frame-read-cookie.html',
      read_origin1_origin1: origin1 + '/frame-read-cookie.html',
      read_origin1_origin2_origin1: origin1 + '/nested-frame-read-cookie.html',
      set_origin1: origin1 + '/set-cookie.html',
      set_origin2_origin1: origin2 + '/frame-set-cookie.html',
      set_origin1_origin2_origin1: origin1 + '/nested-frame-set-cookie.html',
    });
  },
});

test.use({
  ignoreHTTPSErrors: true,
});

/**
 * origin1:
 *   top-level-partitioned=value
 *   top-level-non-partitioned=value
 *
 * origin2:
 *   origin1:
 *     frame-partitioned=value
 *     frame-non-partitioned=value
 *
 * origin1:
 *   origin2:
 *     origin1:
 *       frame-partitioned=value
 *       frame-non-partitioned=value
 *
 * origin1 = httpsServer.PREFIX
 * origin2 = httpsServer.CROSS_PROCESS_PREFIX
 */
function addCommonCookieHandlers(httpsServer: TestServer, urls: TestUrls) {
  // '/set-cookie.html' handlers are added in the tests.
  httpsServer.setRoute('/read-cookie.html', (req, res) => {
    res.setHeader('Content-Type', 'text/html');
    const cookies = req.headers.cookie?.split(';').map(c => c.trim()).sort().join('; ');
    res.end(`Received cookie: ${cookies}`);
  });
  httpsServer.setRoute('/frame-set-cookie.html', (req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.end(`<iframe src='${urls.origin1}/set-cookie.html'></iframe>`);
  });
  httpsServer.setRoute('/frame-read-cookie.html', (req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.end(`<iframe src='${urls.origin1}/read-cookie.html'></iframe>`);
  });
  // Nested cross-origin iframe:
  //   main frame: (origin1 or origin2) -> iframe1: origin2 -> iframe2: origin1
  httpsServer.setRoute('/nested-frame-set-cookie.html', (req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.end(`<iframe src='${urls.origin2}/frame-set-cookie.html'></iframe>`);
  });
  httpsServer.setRoute('/nested-frame-read-cookie.html', (req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.end(`<iframe src='${urls.origin2}/frame-read-cookie.html'></iframe>`);
  });
}

function findCookie(cookies: Cookie[], name: string) {
  const result = cookies.find(cookie => cookie.name === name);
  expect(result, `Cookie ${name} not found in ${JSON.stringify(cookies, null, 2)}`).toBeTruthy();
  return result;
}

function expectPartitionKey(cookies: Cookie[], name: string, partitionKey: string) {
  const cookie = findCookie(cookies, name);
  if (partitionKey !== cookie.partitionKey)
    throw new Error(`Cookie ${name} has partitionKey ${cookie.partitionKey} but expected ${partitionKey}.`);
}

async function runNonPartitionedTest(page: Page, httpsServer: TestServer, browserName: string, isMac: boolean, isLinux: boolean, urls: TestUrls) {
  addCommonCookieHandlers(httpsServer, urls);
  httpsServer.setRoute('/set-cookie.html', (req, res) => {
    res.setHeader('Set-Cookie', `${req.headers.referer ? 'frame' : 'top-level'}=value; SameSite=None; Path=/; Secure;`);
    res.setHeader('Content-Type', 'text/html');
    res.end();
  });

  await page.goto(urls.set_origin1);
  await page.goto(urls.read_origin1);
  expect(await page.locator('body').textContent()).toBe('Received cookie: top-level=value');

  await page.goto(urls.read_origin2_origin1);
  const frameBody = page.locator('iframe').contentFrame().locator('body');

  // WebKit does not support third-party cookies without a 'Partition' attribute.
  if (browserName === 'webkit' && isMac)
    await expect(frameBody).toHaveText('Received cookie: undefined');
  else
    await expect(frameBody).toHaveText('Received cookie: top-level=value');

  // Set cookie and do second navigation.
  await page.goto(urls.set_origin2_origin1);
  await page.goto(urls.read_origin2_origin1);
  const expectedThirdParty = browserName === 'webkit' && isMac ?
    'Received cookie: undefined' : browserName === 'webkit' && isLinux ?
      'Received cookie: top-level=value' :
      'Received cookie: frame=value; top-level=value';
  await expect(frameBody).toHaveText(expectedThirdParty, { timeout: 1000 });

  // Check again the top-level cookie.
  await page.goto(urls.read_origin1);
  const expectedTopLevel = browserName === 'webkit' && (isMac || isLinux) ?
    'Received cookie: top-level=value' :
    'Received cookie: frame=value; top-level=value';
  expect(await page.locator('body').textContent()).toBe(expectedTopLevel);

  return {
    expectedTopLevel,
    expectedThirdParty,
  };
}

test(`third party non-partitioned cookies`, async ({ page, browserName, httpsServer, isMac, isLinux, urls }) => {
  await runNonPartitionedTest(page, httpsServer, browserName, isMac, isLinux, urls);
});

test(`save/load third party non-partitioned cookies`, async ({ page, browserName, httpsServer, isMac, isLinux, browser, urls }) => {
  // Run the test to populate the cookies.
  const { expectedTopLevel, expectedThirdParty } = await runNonPartitionedTest(page, httpsServer, browserName, isMac, isLinux, urls);

  async function checkCookies(page: Page) {
    // Check top-level cookie first.
    await page.goto(urls.read_origin1);
    expect.soft(await page.locator('body').textContent()).toBe(expectedTopLevel);

    // Check third-party cookie.
    await page.goto(urls.read_origin2_origin1);
    const frameBody = page.locator('iframe').contentFrame().locator('body');
    await expect.soft(frameBody).toHaveText(expectedThirdParty);
  }

  await checkCookies(page);

  await test.step('export via cookies/addCookies', async () => {
    const cookies = await page.context().cookies();
    const context2 = await browser.newContext();
    await context2.addCookies(cookies);
    const page2 = await context2.newPage();
    await checkCookies(page2);
  });

  await test.step('export via storageState', async () => {
    const storageState = await page.context().storageState();
    const context3 = await browser.newContext({ storageState });
    const page3 = await context3.newPage();
    await checkCookies(page3);
  });
});

async function runPartitionedTest(page: Page, httpsServer: TestServer, browserName: string, isMac: boolean, urls: TestUrls) {
  addCommonCookieHandlers(httpsServer, urls);
  httpsServer.setRoute('/set-cookie.html', (req, res) => {
    res.setHeader('Set-Cookie', [
      `${req.headers.referer ? 'frame' : 'top-level'}-partitioned=value; SameSite=None; Path=/; Secure; Partitioned;`,
      `${req.headers.referer ? 'frame' : 'top-level'}-non-partitioned=value; SameSite=None; Path=/; Secure;`
    ]);
    res.end();
  });

  await page.goto(urls.set_origin1);
  await page.goto(urls.read_origin1);
  expect(await page.locator('body').textContent()).toBe('Received cookie: top-level-non-partitioned=value; top-level-partitioned=value');

  await page.goto(urls.read_origin2_origin1);
  const frameBody = page.locator('iframe').contentFrame().locator('body');

  // Firefox cookie partitioning is disabled in Firefox.
  // TODO: reenable cookie partitioning?
  if (browserName === 'firefox') {
    await expect(frameBody).toHaveText('Received cookie: top-level-non-partitioned=value; top-level-partitioned=value');
    return;
  }

  // Linux and Windows WebKit builds do not partition third-party cookies at all.
  if (browserName === 'webkit' && !isMac) {
    await expect(frameBody).toHaveText('Received cookie: top-level-non-partitioned=value; top-level-partitioned=value');
    return;
  }

  if (browserName === 'webkit') {
    // WebKit will only send 'Partitioned' third-party cookies exactly matching the partition.
    await expect(frameBody).toHaveText('Received cookie: undefined');
  } else {
    // For non-partitioned cookies, the cookie is sent to the iframe right away,
    // if third-party cookies are supported by the browser.
    await expect(frameBody).toHaveText('Received cookie: top-level-non-partitioned=value');
  }

  // First navigation:
  // - no cookie sent, as it was only set on the top-level site
  // - sets the third-party cookie for the top-level context
  // Second navigation:
  // - sends the cookie as it was just set for the (top-level site, iframe url) partition.
  await page.goto(urls.set_origin2_origin1);
  await page.goto(urls.read_origin2_origin1);
  if (browserName === 'webkit')
    await expect(frameBody).toHaveText('Received cookie: undefined');
  else
    await expect(frameBody).toHaveText('Received cookie: frame-non-partitioned=value; frame-partitioned=value; top-level-non-partitioned=value');
}

test(`third party 'Partitioned;' cookies`, async ({ page, browserName, httpsServer, isMac, urls }) => {
  await runPartitionedTest(page, httpsServer, browserName, isMac, urls);
});

test(`save/load third party 'Partitioned;' cookies`, async ({ page, browserName, httpsServer, isMac, browser, urls }) => {
  test.fixme(browserName === 'firefox', 'Firefox cookie partitioning is disabled in Firefox.');
  test.fixme(browserName === 'webkit' && !isMac, 'Linux and Windows WebKit builds do not partition third-party cookies at all.');

  await runPartitionedTest(page, httpsServer, browserName, isMac, urls);

  async function checkCookies(page: Page) {
    {
      // Check top-level cookie first.
      await page.goto(urls.read_origin1);
      const expectedTopLevel = browserName === 'webkit' && isMac ?
        'Received cookie: top-level-non-partitioned=value; top-level-partitioned=value' :
        'Received cookie: frame-non-partitioned=value; top-level-non-partitioned=value; top-level-partitioned=value';
      expect.soft(await page.locator('body').textContent()).toBe(expectedTopLevel);
    }
    {
      // Check third-party cookie.
      await page.goto(urls.read_origin2_origin1);
      const frameBody = page.locator('iframe').contentFrame().locator('body');
      const expectedThirdParty = browserName === 'webkit' ?
        'Received cookie: undefined' :
        'Received cookie: frame-non-partitioned=value; frame-partitioned=value; top-level-non-partitioned=value';
      await expect.soft(frameBody).toHaveText(expectedThirdParty, { timeout: 1000 });
    }
    {
      await page.goto(urls.read_origin1_origin2_origin1); // read-origin1-origin2-origin1.html
      const frameBody = page.locator('iframe').contentFrame().locator('iframe').contentFrame().locator('body');
      const expectedThirdParty = browserName === 'webkit' ?
        'Received cookie: top-level-non-partitioned=value; top-level-partitioned=value' :
        'Received cookie: frame-non-partitioned=value; top-level-non-partitioned=value';
      await expect.soft(frameBody).toHaveText(expectedThirdParty, { timeout: 1000 });
    }
  }

  await checkCookies(page);

  function checkStorageCookies(cookies: Cookie[]) {
    const expectedTopLevelPartitioned = browserName === 'webkit' && isMac ?
      undefined :
      'https://localhost';
    expectPartitionKey(cookies, 'top-level-partitioned', expectedTopLevelPartitioned);
    expectPartitionKey(cookies, 'top-level-non-partitioned', undefined);
    if (browserName === 'webkit' && isMac) {
      expect(cookies.find(cookie => cookie.name === 'frame-partitioned')).toBeUndefined();
      expect(cookies.find(cookie => cookie.name === 'frame-non-partitioned')).toBeUndefined();
    } else {
      expectPartitionKey(cookies, 'frame-partitioned', 'https://127.0.0.1');
      expectPartitionKey(cookies, 'frame-non-partitioned', undefined);
    }
  }
  checkStorageCookies(await page.context().cookies());
  checkStorageCookies((await page.context().storageState()).cookies);

  await test.step('export via cookies/addCookies', async () => {
    const cookies = await page.context().cookies();
    const context2 = await browser.newContext();
    await context2.addCookies(cookies);
    const page2 = await context2.newPage();
    await checkCookies(page2);
  });

  await test.step('export via storageState', async () => {
    const storageState = await page.context().storageState();
    const context3 = await browser.newContext({ storageState });
    const page3 = await context3.newPage();
    await checkCookies(page3);
  });
});

test(`add 'Partitioned;' cookie via API`, async ({ page, context, browserName, httpsServer, isMac, urls }) => {
  addCommonCookieHandlers(httpsServer, urls);

  await context.addCookies([
    {
      name: 'top-level-partitioned',
      value: 'value',
      domain: httpsServer.HOSTNAME,
      path: '/',
      expires: -1,
      httpOnly: false,
      secure: true,
      sameSite: 'None',
      partitionKey: 'https://localhost',
      _crHasCrossSiteAncestor: false
    } as any,
    {
      name: 'top-level-non-partitioned',
      value: 'value',
      domain: httpsServer.HOSTNAME,
      path: '/',
      expires: -1,
      httpOnly: false,
      secure: true,
      sameSite: 'None'
    },
    {
      name: 'frame-partitioned',
      value: 'value',
      domain: httpsServer.HOSTNAME,
      path: '/',
      expires: -1,
      httpOnly: false,
      secure: true,
      sameSite: 'None',
      partitionKey: 'https://127.0.0.1',
      _crHasCrossSiteAncestor: true
    } as any,
    {
      name: 'frame-non-partitioned',
      value: 'value',
      domain: httpsServer.HOSTNAME,
      path: '/',
      expires: -1,
      httpOnly: false,
      secure: true,
      sameSite: 'None'
    }
  ]);

  async function checkCookies(page: Page) {
    {
      // Check top-level cookie first.
      await page.goto(urls.read_origin1);
      const expectedTopLevel = browserName === 'webkit' || browserName === 'firefox' ?
        'Received cookie: frame-non-partitioned=value; frame-partitioned=value; top-level-non-partitioned=value; top-level-partitioned=value' :
        'Received cookie: frame-non-partitioned=value; top-level-non-partitioned=value; top-level-partitioned=value';
      expect.soft(await page.locator('body').textContent()).toBe(expectedTopLevel);
    }
    {
      // Check third-party cookie.
      await page.goto(urls.read_origin2_origin1);
      const frameBody = page.locator('iframe').contentFrame().locator('body');
      const expectedThirdParty = browserName === 'webkit' && isMac ?
        'Received cookie: undefined' : browserName === 'chromium' ?
          'Received cookie: frame-non-partitioned=value; frame-partitioned=value; top-level-non-partitioned=value' :
          // Firefox and WebKit on Linux/Windows do not partition third-party cookies.
          'Received cookie: frame-non-partitioned=value; frame-partitioned=value; top-level-non-partitioned=value; top-level-partitioned=value';
      await expect.soft(frameBody).toHaveText(expectedThirdParty, { timeout: 1000 });
    }
    {
      await page.goto(urls.read_origin1_origin2_origin1); // read-origin1-origin2-origin1.html
      const frameBody = page.locator('iframe').contentFrame().locator('iframe').contentFrame().locator('body');
      const expectedThirdParty = browserName === 'webkit' || browserName === 'firefox' ?
        'Received cookie: frame-non-partitioned=value; frame-partitioned=value; top-level-non-partitioned=value; top-level-partitioned=value' :
        'Received cookie: frame-non-partitioned=value; top-level-non-partitioned=value';
      await expect.soft(frameBody).toHaveText(expectedThirdParty, { timeout: 1000 });
    }
  }

  await checkCookies(page);
});


test(`same origin third party 'Partitioned;' cookie with different origin intermediate iframe`, async ({ page, httpsServer, browser, urls }) => {
  addCommonCookieHandlers(httpsServer, urls);
  httpsServer.setRoute('/set-cookie.html', (req, res) => {
    res.setHeader('Set-Cookie', [
      `${req.headers.referer ? 'frame' : 'top-level'}-partitioned=value; SameSite=None; Path=/; Secure; Partitioned;`,
      `${req.headers.referer ? 'frame' : 'top-level'}-non-partitioned=value; SameSite=None; Path=/; Secure;`
    ]);
    res.end();
  });
  // main frame: origin1 -> iframe1: origin2 -> iframe2: origin1
  // In this case the cookie in iframe2 is a third-party partitioned cookie, even though
  // it's the same origin as the main frame.
  await page.goto(urls.set_origin1_origin2_origin1);

  async function checkCookies(page: Page) {
    await page.goto(urls.read_origin1_origin2_origin1);
    const frameBody = page.locator('iframe').contentFrame().locator('iframe').contentFrame().locator('body');
    await expect.soft(frameBody).toHaveText('Received cookie: frame-non-partitioned=value; frame-partitioned=value');
  }

  await checkCookies(page);

  await test.step('export via cookies/addCookies', async () => {
    const cookies = await page.context().cookies();
    const context2 = await browser.newContext();
    await context2.addCookies(cookies);
    const page2 = await context2.newPage();
    await checkCookies(page2);
  });

  await test.step('export via storageState', async () => {
    const storageState = await page.context().storageState();
    const context3 = await browser.newContext({ storageState });
    const page3 = await context3.newPage();
    await checkCookies(page3);
  });
});

test(`top level 'Partitioned;' cookie and same origin iframe`, async ({ page, browserName, httpsServer, browser, urls }) => {
  addCommonCookieHandlers(httpsServer, urls);
  httpsServer.setRoute('/set-cookie.html', (req, res) => {
    res.setHeader('Set-Cookie', [
      `${req.headers.referer ? 'frame' : 'top-level'}=value; SameSite=None; Path=/; Secure; Partitioned;`,
      `${req.headers.referer ? 'frame' : 'top-level'}-non-partitioned=value; SameSite=None; Path=/; Secure;`
    ]);
    res.end();
  });

  // Same origin iframe cookies are partitioned the same way as top-level cookies.
  await page.goto(urls.set_origin1);
  await page.context().storageState({ path: '/tmp/state2.json' });

  async function checkCookies(page: Page) {
    {
      // Check top-level cookie first.
      await page.goto(urls.read_origin1);
      expect.soft(await page.locator('body').textContent()).toBe('Received cookie: top-level-non-partitioned=value; top-level=value');
    }
    {
      // Same origin iframe.
      await page.goto(urls.read_origin1_origin1);
      const frameBody = page.locator('iframe').contentFrame().locator('body');
      await expect.soft(frameBody).toHaveText('Received cookie: top-level-non-partitioned=value; top-level=value', { timeout: 1000 });
    }
    {
      // Check third-party cookie.
      // main frame: origin1 -> iframe1: origin2 -> iframe2: origin1
      await page.goto(urls.read_origin1_origin2_origin1);
      const frameBody = page.locator('iframe').contentFrame().locator('iframe').contentFrame().locator('body');
      const expectedThirdParty = browserName === 'chromium'
        ? 'Received cookie: top-level-non-partitioned=value'
        : 'Received cookie: top-level-non-partitioned=value; top-level=value';
      await expect.soft(frameBody).toHaveText(expectedThirdParty, { timeout: 1000 });
    }
  }

  await checkCookies(page);

  await test.step('export via cookies/addCookies', async () => {
    const cookies = await page.context().cookies();
    const context2 = await browser.newContext();
    await context2.addCookies(cookies);
    const page2 = await context2.newPage();
    await checkCookies(page2);
  });

  await test.step('export via storageState', async () => {
    const storageState = await page.context().storageState();
    const context3 = await browser.newContext({ storageState });
    const page3 = await context3.newPage();
    await checkCookies(page3);
  });
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
