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

import fs from 'fs';
import { androidTest as test, expect } from './androidTest';

test.afterAll(async ({ androidDevice }) => {
  await androidDevice.shell('am force-stop com.android.chrome');
});

test('androidDevice.model', async function({ androidDevice }) {
  expect(androidDevice.model()).toContain('sdk_gphone');
  expect(androidDevice.model()).toContain('x86_64');
});

test('androidDevice.launchBrowser', async function({ androidDevice }) {
  const context = await androidDevice.launchBrowser();
  const [page] = context.pages();
  await page.goto('data:text/html,<title>Hello world!</title>');
  expect(await page.title()).toBe('Hello world!');
  await context.close();
});

test('androidDevice.launchBrowser should treat args correctly', async ({ androidDevice }) => {
  for (const arg of [
    "--user-agent='I am Foo'",
    '--user-agent="I am Foo"',
  ]) {
    await test.step(`arg: ${arg}`, async () => {
      const context = await androidDevice.launchBrowser({ args: [arg] });
      const page = await context.newPage();
      const userAgent = await page.evaluate(() => navigator.userAgent);
      await context.close();
      expect(userAgent).toBe('I am Foo');
    });
  }
});

test('androidDevice.launchBrowser should throw for bad proxy server value', async ({ androidDevice }) => {
  const error = await androidDevice.launchBrowser({
    // @ts-expect-error server must be a string
    proxy: { server: 123 }
  }).catch(e => e);
  expect(error.message).toContain('proxy.server: expected string, got number');
});

test('androidDevice.launchBrowser should pass proxy config', async ({ androidDevice, server, mode, loopback }) => {
  server.setRoute('/target.html', async (req, res) => {
    res.end('<html><title>Served by the proxy</title></html>');
  });
  const context = await androidDevice.launchBrowser({ proxy: { server: `${loopback}:${server.PORT}` } });
  const page = await context.newPage();
  await page.goto('http://non-existent.com/target.html');
  expect(await page.title()).toBe('Served by the proxy');
  await context.close();
});

test('should create new page', async function({ androidDevice }) {
  const context = await androidDevice.launchBrowser();
  const page = await context.newPage();
  await page.goto('data:text/html,<title>Hello world!</title>');
  expect(await page.title()).toBe('Hello world!');
  await page.close();
  await context.close();
});

test('should check', async function({ androidDevice }) {
  const context = await androidDevice.launchBrowser();
  const [page] = context.pages();
  await page.setContent(`<input id='checkbox' type='checkbox'></input>`);
  await page.check('input');
  expect(await page.evaluate(() => window['checkbox'].checked)).toBe(true);
  await page.close();
  await context.close();
});

test('should take page screenshot', async function({ androidDevice }) {
  test.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/26342' });
  test.fixme(true, 'Sometimes fails with Protocol error (Page.captureScreenshot): Unable to capture screenshot');
  test.fixme(true, 'Regular screenshot has an extra pixel border');
  test.fixme(true, 'Full page screenshot has repeated content');

  const context = await androidDevice.launchBrowser();
  const [page] = context.pages();

  await page.setContent(`
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body>
        <style>
          * { margin: 0; padding: 0; }
          div {
            width: 200px;
            height: 250px;
          }
        </style>
        <div style="background: red"></div>
        <div style="background: green"></div>
        <div style="background: red"></div>
        <div style="background: green"></div>
        <div style="background: red"></div>
        <div style="background: green"></div>
      </body>
    </html>
  `);
  const screenshot = await page.screenshot({ fullPage: false, scale: 'css' });
  const fullPageScreenshot = await page.screenshot({ fullPage: true, scale: 'css' });
  expect(screenshot).toMatchSnapshot('page-screenshot.png');
  expect(fullPageScreenshot).toMatchSnapshot('fullpage-screenshot.png');
  await context.close();
});

test('should be able to send CDP messages', async ({ androidDevice }) => {
  const context = await androidDevice.launchBrowser();
  const [page] = context.pages();
  const client = await context.newCDPSession(page);
  await client.send('Runtime.enable');
  const evalResponse = await client.send('Runtime.evaluate', { expression: '1 + 2', returnByValue: true });
  expect(evalResponse.result.value).toBe(3);
  await context.close();
});

test('should be able to pass context options', async ({ androidDevice, httpsServer }) => {
  const context = await androidDevice.launchBrowser({
    colorScheme: 'dark',
    geolocation: { longitude: 10, latitude: 10 },
    permissions: ['geolocation'],
    ignoreHTTPSErrors: true,
    baseURL: httpsServer.PREFIX,
  });
  const [page] = context.pages();

  await page.goto('./empty.html');
  expect(page.url()).toBe(httpsServer.PREFIX + '/empty.html');

  expect(await page.evaluate(() => new Promise(resolve => navigator.geolocation.getCurrentPosition(position => {
    resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude });
  })))).toEqual({ latitude: 10, longitude: 10 });

  expect(await page.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches)).toBe(true);
  expect(await page.evaluate(() => matchMedia('(prefers-color-scheme: light)').matches)).toBe(false);
  await context.close();
});

test('should record har', async ({ androidDevice }) => {
  test.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/28015' });
  const harPath = test.info().outputPath('test.har');

  const context = await androidDevice.launchBrowser({
    recordHar: { path: harPath }
  });
  const [page] = context.pages();
  await page.goto('data:text/html,<title>Hello</title>');
  await page.waitForLoadState('domcontentloaded');
  await context.close();

  const log = JSON.parse(fs.readFileSync(harPath).toString())['log'];
  expect(log.pages[0].title).toBe('Hello');
});
