/**
 * Copyright 2018 Google Inc. All rights reserved.
 * Modifications copyright (c) Microsoft Corporation.
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

import { test as it } from './pageTest';

it('clicking on links which do not commit navigation', async ({ page, server, httpsServer }) => {
  await page.goto(server.EMPTY_PAGE);
  await page.setContent(`<a href='${httpsServer.EMPTY_PAGE}'>foobar</a>`);
  await page.click('a');
});

it('calling window.stop async', async ({ page, server }) => {
  server.setRoute('/empty.html', async (req, res) => {});
  await page.evaluate(url => {
    window.location.href = url;
    setTimeout(() => window.stop(), 100);
  }, server.EMPTY_PAGE);
});

it('calling window.stop sync', async ({ page, server }) => {
  await page.evaluate(url => {
    window.location.href = url;
    window.stop();
  }, server.EMPTY_PAGE);
});

it('assigning location to about:blank', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  await page.evaluate(`window.location.href = "about:blank";`);
});

it('assigning location to about:blank after non-about:blank', async ({ page, server }) => {
  server.setRoute('/empty.html', async (req, res) => {});
  await page.evaluate(`
      window.location.href = "${server.EMPTY_PAGE}";
      window.location.href = "about:blank";`);
});

it('calling window.open and window.close', async function({ page, server }) {
  await page.goto(server.EMPTY_PAGE);
  await page.evaluate(() => {
    const popup = window.open(window.location.href);
    popup.close();
  });
});

it('opening a popup', async function({ page, server }) {
  await page.goto(server.EMPTY_PAGE);
  await Promise.all([
    page.waitForEvent('popup'),
    page.evaluate(() => window.open(window.location.href) && 1),
  ]);
});
