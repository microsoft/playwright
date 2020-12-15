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

import { folio } from './android.fixtures';
const { it, expect } = folio;

if (process.env.PW_ANDROID_TESTS) {
  it('androidDevice.webView', async function({ device }) {
    expect(device.webViews().length).toBe(0);
    await device.shell('am start org.chromium.webview_shell/.WebViewBrowserActivity');
    const webview = await device.webView({ pkg: 'org.chromium.webview_shell' });
    expect(webview.pkg()).toBe('org.chromium.webview_shell');
    expect(device.webViews().length).toBe(1);
  });

  it('webView.page', async function({ device }) {
    expect(device.webViews().length).toBe(0);
    await device.shell('am start org.chromium.webview_shell/.WebViewBrowserActivity');
    const webview = await device.webView({ pkg: 'org.chromium.webview_shell' });
    const page = await webview.page();
    expect(page.url()).toBe('about:blank');
  });

  it('should navigate page internally', async function({ device, server }) {
    expect(device.webViews().length).toBe(0);
    await device.shell('am start org.chromium.webview_shell/.WebViewBrowserActivity');
    const webview = await device.webView({ pkg: 'org.chromium.webview_shell' });
    const page = await webview.page();
    await page.goto('data:text/html,<title>Hello world!</title>');
    expect(await page.title()).toBe('Hello world!');
  });

  it('should navigate page externally', test => {
    test.fixme(!!process.env.CI, 'Hangs on the bots');
  }, async function({ device }) {
    expect(device.webViews().length).toBe(0);
    await device.shell('am start org.chromium.webview_shell/.WebViewBrowserActivity');
    const webview = await device.webView({ pkg: 'org.chromium.webview_shell' });
    const page = await webview.page();

    await device.fill({ res: 'org.chromium.webview_shell:id/url_field' }, 'data:text/html,<title>Hello world!</title>');
    await Promise.all([
      page.waitForNavigation(),
      device.press({ res: 'org.chromium.webview_shell:id/url_field' }, 'Enter')
    ]);
    expect(await page.title()).toBe('Hello world!');
  });
}
