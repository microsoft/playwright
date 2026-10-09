/**
 * Copyright (c) Microsoft Corporation.
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

import { browserTest as test, expect } from '../config/browserTest';

// A popup whose creation reaches the browser after the context started closing
// must be closed as part of the context deletion. Before the WebKit fix it
// outlived its context and crashed the browser on close. Only the macOS port
// defers the page destruction enough to reach this window; on GTK and WPE these
// tests cannot fail.
for (let i = 0; i < 100; ++i) {
  test('close context while popups are being created ' + i, async ({ browser, server, browserName, toImpl }) => {
    test.skip(browserName !== 'webkit');

    server.setRoute('/popup-spin.html', (req, res) => {
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end(`<body>spin<script>
        (function spin() {
          const w = window.open('about:blank');
          if (w)
            w.close();
          setTimeout(spin, 0);
        })();
      </script></body>`);
    });

    const context = await browser.newContext();
    const wkContext = toImpl(context);
    for (let j = 0; j < 2; j++) {
      const page = await context.newPage();
      await page.goto(server.PREFIX + '/popup-spin.html').catch(() => {});
    }
    // Close the context while popup creation is still in flight.
    await new Promise(f => setTimeout(f, 5 + Math.floor(Math.random() * 55)));
    await context.close();
    expect(browser.isConnected()).toBe(true);

    // The browser reports every page proxy of the context as destroyed before it
    // answers the context deletion, so nothing may be left once close() resolves.
    const leaked = [...toImpl(browser)._wkPages.values()].filter(wkPage => wkPage._browserContext === wkContext);
    expect(leaked.length, 'page proxies left behind by the closed context').toBe(0);
  });
}
