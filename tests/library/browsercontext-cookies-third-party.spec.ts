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

import { contextTest as test, expect } from '../config/browserTest';

test.use({
  ignoreHTTPSErrors: true,
});

test(`third party non-partitioned cookies`, async ({ page, browserName, httpsServer }) => {
  httpsServer.setRoute('/empty.html', (req, res) => {
    res.setHeader('Set-Cookie', `name=value; SameSite=None; Path=/; Secure;`);
    res.setHeader('Content-Type', 'text/html');
    res.end(`Received cookie: ${req.headers.cookie}`);
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
  if (browserName === 'webkit')
    await expect(frameBody).toHaveText('Received cookie: undefined');
  else
    await expect(frameBody).toHaveText('Received cookie: name=value');
});

test(`third party 'Partitioned;' cookies`, async ({ page, browserName, httpsServer }) => {
  httpsServer.setRoute('/empty.html', (req, res) => {
    res.setHeader('Set-Cookie', [
      `name=value; SameSite=None; Path=/; Secure; Partitioned;`,
      `nonPartitionedName=value; SameSite=None; Path=/; Secure;`
    ]);
    res.setHeader('Content-Type', 'text/html');
    res.end(`Received cookie: ${req.headers.cookie}`);
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
    await expect(frameBody).toHaveText('Received cookie: nonPartitionedName=value; name=value');
});
