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

import { contextTest as it, expect } from '../../config/browserTest';

it.use({
  launchOptions: async ({ launchOptions }, use) => {
    await use({ ...launchOptions, args: ['--disable-web-security'] });
  }
});

it('test utility world in popup w/ --disable-web-security', async ({ page, server }) => {
  server.setRoute('/main.html', (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/html'
    });
    res.end(`<a href="${server.PREFIX}/target.html" target="_blank">Click me</a>`);
  });
  server.setRoute('/target.html', (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/html'
    });
    res.end(`<html></html>`);
  });

  await page.goto(server.PREFIX + '/main.html');
  const page1Promise = page.context().waitForEvent('page');
  await page.getByRole('link', { name: 'Click me' }).click();
  const page1 = await page1Promise;
  await expect(page1).toHaveURL(/target/);
});

it('test init script w/ --disable-web-security', async ({ page, server }) => {
  server.setRoute('/main.html', (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/html'
    });
    res.end(`<a href="${server.PREFIX}/target.html" target="_blank">Click me</a>`);
  });
  server.setRoute('/target.html', (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/html'
    });
    res.end(`<html></html>`);
  });

  await page.context().addInitScript('window.injected = 123');
  await page.goto(server.PREFIX + '/main.html');
  const page1Promise = page.context().waitForEvent('page');
  await page.getByRole('link', { name: 'Click me' }).click();
  const page1 = await page1Promise;
  const value = await page1.evaluate('window.injected');
  expect(value).toBe(123);
});
