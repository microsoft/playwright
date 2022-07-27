/**
 * Copyright 2017 Google Inc. All rights reserved.
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

import { browserTest as it, expect } from '../config/browserTest';

it('should work @smoke', async ({ server, contextFactory }) => {
  const context = await contextFactory();
  const page = await context.newPage();
  await context.grantPermissions(['geolocation']);
  await page.goto(server.EMPTY_PAGE);
  await context.setGeolocation({ longitude: 10, latitude: 10 });
  const geolocation = await page.evaluate(() => new Promise(resolve => navigator.geolocation.getCurrentPosition(position => {
    resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude });
  })));
  expect(geolocation).toEqual({
    latitude: 10,
    longitude: 10
  });
});

it('should throw when invalid longitude', async ({ contextFactory }) => {
  const context = await contextFactory();
  let error = null;
  try {
    await context.setGeolocation({ longitude: 200, latitude: 10 });
  } catch (e) {
    error = e;
  }
  expect(error.message).toContain('geolocation.longitude: precondition -180 <= LONGITUDE <= 180 failed.');
});

it('should isolate contexts', async ({ server, contextFactory, browser }) => {
  const context = await contextFactory();
  const page = await context.newPage();
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ longitude: 10, latitude: 10 });
  await page.goto(server.EMPTY_PAGE);

  const context2 = await browser.newContext({
    permissions: ['geolocation'],
    geolocation: { longitude: 20, latitude: 20 }
  });
  const page2 = await context2.newPage();
  await page2.goto(server.EMPTY_PAGE);

  const geolocation = await page.evaluate(() => new Promise(resolve => navigator.geolocation.getCurrentPosition(position => {
    resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude });
  })));
  expect(geolocation).toEqual({
    latitude: 10,
    longitude: 10
  });

  const geolocation2 = await page2.evaluate(() => new Promise(resolve => navigator.geolocation.getCurrentPosition(position => {
    resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude });
  })));
  expect(geolocation2).toEqual({
    latitude: 20,
    longitude: 20
  });

  await context2.close();
});

it('should throw with missing latitude', async ({ contextFactory }) => {
  const context = await contextFactory();
  let error = null;
  try {
    // @ts-expect-error setGeolocation must have latitude
    await context.setGeolocation({ longitude: 10 });
  } catch (e) {
    error = e;
  }
  expect(error.message).toContain('geolocation.latitude: expected number, got undefined');
});

it('should not modify passed default options object', async ({ browser }) => {
  const geolocation = { longitude: 10, latitude: 10 };
  const options = { geolocation };
  const context = await browser.newContext(options);
  await context.setGeolocation({ longitude: 20, latitude: 20 });
  expect(options.geolocation).toBe(geolocation);
  await context.close();
});

it('should throw with missing longitude in default options', async ({ browser }) => {
  let error = null;
  try {
    // @ts-expect-error geolocation must have longitude
    const context = await browser.newContext({ geolocation: { latitude: 10 } });
    await context.close();
  } catch (e) {
    error = e;
  }
  expect(error.message).toContain('geolocation.longitude: expected number, got undefined');
});

it('should use context options', async ({ browser, server }) => {
  const options = { geolocation: { longitude: 10, latitude: 10 }, permissions: ['geolocation'] };
  const context = await browser.newContext(options);
  const page = await context.newPage();
  await page.goto(server.EMPTY_PAGE);

  const geolocation = await page.evaluate(() => new Promise(resolve => navigator.geolocation.getCurrentPosition(position => {
    resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude });
  })));
  expect(geolocation).toEqual({
    latitude: 10,
    longitude: 10
  });
  await context.close();
});

it('watchPosition should be notified', async ({ server, contextFactory }) => {
  const context = await contextFactory();
  const page = await context.newPage();
  await context.grantPermissions(['geolocation']);
  await page.goto(server.EMPTY_PAGE);
  const messages = [];
  page.on('console', message => messages.push(message.text()));

  await context.setGeolocation({ latitude: 0, longitude: 0 });
  await page.evaluate(() => {
    navigator.geolocation.watchPosition(pos => {
      const coords = pos.coords;
      console.log(`lat=${coords.latitude} lng=${coords.longitude}`);
    }, err => {});
  });
  await Promise.all([
    page.waitForEvent('console', message => message.text().includes('lat=0 lng=10')),
    context.setGeolocation({ latitude: 0, longitude: 10 }),
  ]);
  await Promise.all([
    page.waitForEvent('console', message => message.text().includes('lat=20 lng=30')),
    context.setGeolocation({ latitude: 20, longitude: 30 }),
  ]);
  await Promise.all([
    page.waitForEvent('console', message => message.text().includes('lat=40 lng=50')),
    context.setGeolocation({ latitude: 40, longitude: 50 }),
  ]);

  const allMessages = messages.join('|');
  expect(allMessages).toContain('lat=0 lng=10');
  expect(allMessages).toContain('lat=20 lng=30');
  expect(allMessages).toContain('lat=40 lng=50');
});

it('should use context options for popup', async ({ contextFactory, server }) => {
  const context = await contextFactory();
  const page = await context.newPage();
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ longitude: 10, latitude: 10 });
  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    page.evaluate(url => window['_popup'] = window.open(url), server.PREFIX + '/geolocation.html'),
  ]);
  await popup.waitForLoadState();
  const geolocation = await popup.evaluate(() => window['geolocationPromise']);
  expect(geolocation).toEqual({ longitude: 10, latitude: 10 });
});
