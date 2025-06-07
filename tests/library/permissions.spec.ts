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

import { contextTest as it, expect } from '../config/browserTest';
import { hostPlatform } from '../../packages/playwright-core/src/server/utils/hostPlatform';

function getPermission(page, name) {
  return page.evaluate(name => navigator.permissions.query({ name }).then(result => result.state), name);
}

it.describe('permissions', () => {
  it.fixme(({ browserName, isWindows }) => browserName === 'webkit' && isWindows, 'Permissions API is disabled on Windows WebKit');

  it('should be prompt by default', async ({ page, server }) => {
    await page.goto(server.EMPTY_PAGE);
    expect(await getPermission(page, 'geolocation')).toBe('prompt');
  });

  it('should deny permission when not listed', async ({ page, context, server, browserName, isMac, macVersion }) => {
    it.skip(browserName === 'webkit' && isMac && macVersion === 13, 'WebKit on macOS 13 is frozen.');
    it.skip(hostPlatform.startsWith('debian11'), 'WebKit on Debian 11 is frozen.');

    await page.goto(server.EMPTY_PAGE);
    await context.grantPermissions([], { origin: server.EMPTY_PAGE });
    if (browserName === 'webkit') {
      expect(await getPermission(page, 'geolocation')).toBe('prompt');
      // Since https://github.com/WebKit/WebKit/pull/45470 WebKit only returns actual
      // permission value, if the API has been accessed.
      await page.evaluate(() => navigator.geolocation.getCurrentPosition(() => { }));
      expect(await getPermission(page, 'geolocation')).toBe('denied');
    } else {
      expect(await getPermission(page, 'geolocation')).toBe('denied');
    }
  });

  it('should fail when bad permission is given', async ({ page, context, server }) => {
    await page.goto(server.EMPTY_PAGE);
    let error: Error;
    await context.grantPermissions(['foo'], { origin: server.EMPTY_PAGE }).catch(e => error = e);
    expect(error.message).toContain('Unknown permission: foo');
  });

  it('should grant geolocation permission when origin is listed', async ({ page, context, server }) => {
    await page.goto(server.EMPTY_PAGE);
    await context.grantPermissions(['geolocation'], { origin: server.EMPTY_PAGE });
    expect(await getPermission(page, 'geolocation')).toBe('granted');
  });

  it('should prompt for geolocation permission when origin is not listed', async ({ page, context, server }) => {
    await page.goto(server.EMPTY_PAGE);
    await context.grantPermissions(['geolocation'], { origin: server.EMPTY_PAGE });
    await page.goto(server.CROSS_PROCESS_PREFIX + '/empty.html');
    expect(await getPermission(page, 'geolocation')).toBe('prompt');
  });

  it('should grant notifications permission when listed', async ({ page, context, server }) => {
    await page.goto(server.EMPTY_PAGE);
    await context.grantPermissions(['notifications'], { origin: server.EMPTY_PAGE });
    expect(await getPermission(page, 'notifications')).toBe('granted');
  });

  it('should accumulate when adding', async ({ page, context, server }) => {
    await page.goto(server.EMPTY_PAGE);
    await context.grantPermissions(['geolocation']);
    await context.grantPermissions(['notifications']);
    expect(await getPermission(page, 'geolocation')).toBe('granted');
    expect(await getPermission(page, 'notifications')).toBe('granted');
  });

  it('should clear permissions', async ({ page, context, server }) => {
    await page.goto(server.EMPTY_PAGE);
    await context.grantPermissions(['geolocation']);
    await context.clearPermissions();
    await context.grantPermissions(['notifications']);
    expect(await getPermission(page, 'geolocation')).not.toBe('granted');
    expect(await getPermission(page, 'notifications')).toBe('granted');
  });

  it('should grant permission when listed for all domains', async ({ page, context, server }) => {
    await page.goto(server.EMPTY_PAGE);
    await context.grantPermissions(['geolocation']);
    expect(await getPermission(page, 'geolocation')).toBe('granted');
  });

  it('should grant permission when creating context', async ({ server, browser }) => {
    const context = await browser.newContext({ permissions: ['geolocation'] });
    const page = await context.newPage();
    await page.goto(server.EMPTY_PAGE);
    expect(await getPermission(page, 'geolocation')).toBe('granted');
    await context.close();
  });

  it('should reset permissions', async ({ page, context, server }) => {
    await page.goto(server.EMPTY_PAGE);
    await context.grantPermissions(['geolocation'], { origin: server.EMPTY_PAGE });
    expect(await getPermission(page, 'geolocation')).toBe('granted');
    await context.clearPermissions();
    expect(await getPermission(page, 'geolocation')).toBe('prompt');
  });

  it('should trigger permission onchange', async ({ page, context, server, browserName, browserMajorVersion }) => {
    it.fail(browserName === 'webkit');

    await page.goto(server.EMPTY_PAGE);
    await page.evaluate(() => {
      window['events'] = [];
      return navigator.permissions.query({ name: 'geolocation' }).then(function(result) {
        window['events'].push(result.state);
        result.onchange = function() {
          window['events'].push(result.state);
        };
      });
    });
    expect(await page.evaluate(() => window['events'])).toEqual(['prompt']);
    await context.grantPermissions([], { origin: server.EMPTY_PAGE });
    expect(await page.evaluate(() => window['events'])).toEqual(['prompt', 'denied']);
    await context.grantPermissions(['geolocation'], { origin: server.EMPTY_PAGE });
    expect(await page.evaluate(() => window['events'])).toEqual(['prompt', 'denied', 'granted']);
    await context.clearPermissions();
    expect(await page.evaluate(() => window['events'])).toEqual(['prompt', 'denied', 'granted', 'prompt']);
  });

  it('should isolate permissions between browser contexts', async ({ server, browser, browserName, isMac, macVersion }) => {
    it.skip(browserName === 'webkit' && isMac && macVersion === 13, 'WebKit on macOS 13 is frozen.');
    it.skip(hostPlatform.startsWith('debian11'), 'WebKit on Debian 11 is frozen.');

    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(server.EMPTY_PAGE);
    const otherContext = await browser.newContext();
    const otherPage = await otherContext.newPage();
    await otherPage.goto(server.EMPTY_PAGE);
    expect(await getPermission(page, 'geolocation')).toBe('prompt');
    expect(await getPermission(otherPage, 'geolocation')).toBe('prompt');

    await context.grantPermissions([], { origin: server.EMPTY_PAGE });
    await otherContext.grantPermissions(['geolocation'], { origin: server.EMPTY_PAGE });
    if (browserName === 'webkit') {
      expect(await getPermission(page, 'geolocation')).toBe('prompt');
      // Since https://github.com/WebKit/WebKit/pull/45470 WebKit only returns actual
      // permission value, if the API has been accessed.
      await page.evaluate(() => navigator.geolocation.getCurrentPosition(() => { }));
      expect(await getPermission(page, 'geolocation')).toBe('denied');
    } else {
      expect(await getPermission(page, 'geolocation')).toBe('denied');
    }
    expect(await getPermission(otherPage, 'geolocation')).toBe('granted');

    await context.clearPermissions();
    if (browserName === 'webkit') {
      // Since https://github.com/WebKit/WebKit/pull/45470 WebKit returns the cached
      // permission value, if the geolocation API has been accessed.
      // TODO: We can probably reset the cached state in the Web Process when resetting
      // permissions.
      expect(await getPermission(page, 'geolocation')).toBe('denied');

      // Geolocation API in the new page in the same context has not been accessed yet,
      // so the permission status should be prompt.
      const page2 = await context.newPage();
      await page2.goto(server.EMPTY_PAGE);
      expect(await getPermission(page2, 'geolocation')).toBe('prompt');
      await page2.close();
    } else {
      expect(await getPermission(page, 'geolocation')).toBe('prompt');
    }
    expect(await getPermission(otherPage, 'geolocation')).toBe('granted');
    await otherContext.close();
    await context.close();
  });
});

it('should support clipboard read', async ({ page, context, server, browserName, isWindows, isLinux, headless, isHeadlessShell }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/27475' });
  it.fail(browserName === 'firefox', 'No such permissions (requires flag) in Firefox');
  it.fixme(browserName === 'webkit' && isWindows, 'WebPasteboardProxy::allPasteboardItemInfo not implemented for Windows.');
  it.fixme(browserName === 'webkit' && isLinux && headless, 'WebPasteboardProxy::allPasteboardItemInfo not implemented for WPE.');

  await page.goto(server.EMPTY_PAGE);
  // There is no 'clipboard-read' permission in WebKit Web API.
  if (browserName !== 'webkit')
    expect(await getPermission(page, 'clipboard-read')).toBe('prompt');

  if (isHeadlessShell) {
    // Chromium (but not headless-shell) shows a dialog and does not resolve the promise.
    const error = await page.evaluate(() => navigator.clipboard.readText()).catch(e => e);
    expect(error.toString()).toContain('denied');
  }

  await context.grantPermissions(['clipboard-read']);
  if (browserName !== 'webkit')
    expect(await getPermission(page, 'clipboard-read')).toBe('granted');
  // There is no 'clipboard-write' permission in WebKit Web API.
  if (browserName === 'chromium')
    await context.grantPermissions(['clipboard-write']);
  await page.evaluate(() => navigator.clipboard.writeText('test content'));
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('test content');
});

it('storage access', {
  annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/31227' }
}, async ({ page, context, server, browserName }) => {
  it.skip(browserName !== 'chromium', 'chromium-only api');

  await context.grantPermissions(['storage-access']);
  expect(await getPermission(page, 'storage-access')).toBe('granted');
  server.setRoute('/set-cookie.html', (req, res) => {
    res.setHeader('Set-Cookie', 'name=value; Path=/; SameSite=Strict; Secure');
    res.end();
  });
  server.setRoute('/my-frame.html', (req, res) => {
    res.setHeader('Content-type', 'text/html');
    res.end(`<iframe src="${server.CROSS_PROCESS_PREFIX + '/empty.html'}"></iframe>`);
  });

  // Navigate once to the domain as top level.
  await page.goto(server.CROSS_PROCESS_PREFIX + '/set-cookie.html');
  await page.goto(server.PREFIX + '/my-frame.html');

  const frame = page.frames()[1];
  expect(await getPermission(frame, 'storage-access')).toBe('granted');
  const access = await frame.evaluate(() => document.requestStorageAccess().then(() => true, () => false));
  expect(access).toBe(true);
  expect(await frame.evaluate(() => document.hasStorageAccess())).toBe(true);
});

it.describe(() => {
  // Secure context
  it.use({ ignoreHTTPSErrors: true, });

  it('should be able to use the local-fonts API', async ({ page, context, httpsServer, browserName }) => {
    it.skip(browserName !== 'chromium', 'chromium-only api');
    it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/36113' });

    await page.goto(httpsServer.EMPTY_PAGE);
    expect(await getPermission(page, 'local-fonts')).toBe('prompt');
    await context.grantPermissions(['local-fonts']);
    expect(await getPermission(page, 'local-fonts')).toBe('granted');
    expect(await page.evaluate(async () => (await (window as any).queryLocalFonts()).length > 0)).toBe(true);
  });
});
