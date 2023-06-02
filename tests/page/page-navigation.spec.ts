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

it('should work with _blank target', async ({ page, server }) => {
  server.setRoute('/empty.html', (req, res) => {
    res.end(`<a href="${server.EMPTY_PAGE}" target="_blank">Click me</a>`);
  });
  await page.goto(server.EMPTY_PAGE);
  await page.click('"Click me"');
});

it('should work with cross-process _blank target', async ({ page, server }) => {
  server.setRoute('/empty.html', (req, res) => {
    res.end(`<a href="${server.CROSS_PROCESS_PREFIX}/empty.html" target="_blank">Click me</a>`);
  });
  await page.goto(server.EMPTY_PAGE);
  await page.click('"Click me"');
});

it('should work with _blank target in form', async ({ page, server }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/18392' });
  server.setRoute('/done.html?', (req, res) => {
    res.end(`Done`);
  });
  await page.goto(server.EMPTY_PAGE);

  void page.setContent(`<form target="_blank" action="done.html" >
      <input type="submit" value="Click me">
    </form>`);
  await Promise.all([
    page.waitForEvent('popup'),
    page.click('"Click me"')
  ]);

  void page.setContent(`<form target="_blank" action="done.html" method="post">
      <input type="submit" value="Click me">
    </form>`);
  await Promise.all([
    page.waitForEvent('popup'),
    page.click('"Click me"')
  ]);
});
