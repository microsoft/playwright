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

import fs from 'fs';
import path from 'path';

import { playwrightTest as it, expect } from '../config/browserTest';

it.skip(({ mode }) => mode !== 'default');

const kBundlePath = path.join(__dirname, '..', '..', 'packages', 'playwright-client', 'lib', 'index.mjs');

it('should connect from a page and drive the same browser', async ({ browser, browserName, server }) => {
  // Expose this very browser over a WebSocket endpoint.
  const { endpoint } = await browser.bind('playwright-client-test', { port: 0 });

  // Serve the built browser client bundle.
  server.setRoute('/playwright-client.mjs', (req, res) => {
    res.writeHead(200, { 'content-type': 'text/javascript' });
    res.end(fs.readFileSync(kBundlePath));
  });

  // A page we keep a direct handle to — the in-page client will click its button.
  server.setContent('/button.html', `<button onclick="this.textContent = 'clicked by client'">click me</button>`, 'text/html');
  const target = await browser.newPage();
  await target.goto(server.PREFIX + '/button.html');

  // The host page loads the client bundle and connects back to this same browser.
  const hostPage = await browser.newPage();
  await hostPage.goto(server.EMPTY_PAGE);
  await hostPage.evaluate(async ({ bundleUrl, endpoint, browserName }) => {
    const { connect } = await import(bundleUrl);
    const remoteBrowser = await connect(endpoint, browserName, {});
    const page = remoteBrowser.contexts().flatMap(context => context.pages()).find(page => page.url().endsWith('/button.html'));
    await page.click('button');
  }, { bundleUrl: server.PREFIX + '/playwright-client.mjs', endpoint, browserName });

  // Verify directly through our own handle to the automated browser.
  expect(await target.locator('button').textContent()).toBe('clicked by client');

  await browser.unbind();
});
