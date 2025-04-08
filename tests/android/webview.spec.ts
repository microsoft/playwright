/**
 * Copyright 2020 Microsoft Corporation. All rights reserved.
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

import { androidTest as test, expect } from './androidTest';

test('androidDevice.webView', async function({ androidDevice }) {
  expect(androidDevice.webViews().length).toBe(0);
  await androidDevice.shell('am start org.chromium.webview_shell/.WebViewBrowserActivity');
  const webview = await androidDevice.webView({ pkg: 'org.chromium.webview_shell' });
  expect(webview.pkg()).toBe('org.chromium.webview_shell');
  expect(androidDevice.webViews().length).toBe(1);
});

test('webView.page', async function({ androidDevice }) {
  expect(androidDevice.webViews().length).toBe(0);
  await androidDevice.shell('am start org.chromium.webview_shell/.WebViewBrowserActivity');
  const webview = await androidDevice.webView({ pkg: 'org.chromium.webview_shell' });
  const page = await webview.page();
  expect(page.url()).toBe('about:blank');
});

test('should navigate page internally', async function({ androidDevice }) {
  expect(androidDevice.webViews().length).toBe(0);
  await androidDevice.shell('am start org.chromium.webview_shell/.WebViewBrowserActivity');
  const webview = await androidDevice.webView({ pkg: 'org.chromium.webview_shell' });
  const page = await webview.page();
  await page.goto('data:text/html,<title>Hello world!</title>');
  expect(await page.title()).toBe('Hello world!');
});

test('should navigate page externally', async function({ androidDevice }) {
  expect(androidDevice.webViews().length).toBe(0);
  await androidDevice.shell('am start org.chromium.webview_shell/.WebViewBrowserActivity');
  const webview = await androidDevice.webView({ pkg: 'org.chromium.webview_shell' });
  const page = await webview.page();

  await androidDevice.fill({ res: 'org.chromium.webview_shell:id/url_field' }, 'data:text/html,<title>Hello world!</title>', { timeout: test.info().timeout });
  await Promise.all([
    page.waitForNavigation(),
    androidDevice.press({ res: 'org.chromium.webview_shell:id/url_field' }, 'Enter')
  ]);
  expect(await page.title()).toBe('Hello world!');
});

test('select webview from socketName', async function({ androidDevice }) {
  const context = await androidDevice.launchBrowser();
  const newPage = await context.newPage();
  await newPage.goto('about:blank');

  const webview = await androidDevice.webView({ socketName: 'webview_devtools_remote_playwright_test' });
  expect(webview.pkg()).toBe('');
  expect(webview.pid()).toBe(-1);
  const page = await webview.page();
  expect(page.url()).toBe('about:blank');

  await newPage.close();
  await context.close();
});

// Requires a newer WebView version with
// https://chromium-review.googlesource.com/c/chromium/src/+/6411892
test.fail('should be able to receive webView cookies', {
  annotation: {
    type: 'issue',
    description: 'https://github.com/microsoft/playwright/issues/35392',
  }
}, async function({ androidDevice, server }) {
  expect(androidDevice.webViews().length).toBe(0);
  server.setRoute('/cookies', (req, res) => {
    res.setHeader('Set-Cookie', 'cookie1=value1; Path=/; HttpOnly');
    res.setHeader('Content-Type', 'text/html');
    res.end('<html><body>hello world</body></html>');
  });
  await androidDevice.shell('am start org.chromium.webview_shell/.WebViewBrowserActivity');
  const webview = await androidDevice.webView({ pkg: 'org.chromium.webview_shell' });
  const page = await webview.page();
  await page.goto(server.CROSS_PROCESS_PREFIX + '/cookies');
  const cookies = await page.context().cookies();
  expect(cookies.length).toBe(1);
  expect(cookies).toEqual([
    {
      name: 'cookie1',
      value: 'value1',
      domain: new URL(server.CROSS_PROCESS_PREFIX).hostname,
      path: '/',
      expires: -1,
      httpOnly: true,
      secure: false,
      sameSite: 'Lax'
    }
  ]);
  await page.context().clearCookies();
});
