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

import { browserTest as it, expect } from '../config/browserTest';
import type { Browser, BrowserContextOptions, Page } from '@playwright/test';
import type { TestServer } from '../config/testserver';

function setupRoutes(server: TestServer) {
  for (const [path, coop] of [['/plain.html', false], ['/coop.html', true]] as const) {
    server.setRoute(path, (req, res) => {
      if (coop)
        res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
      res.setHeader('Content-Type', 'text/html');
      res.end('<title>t</title><p>hello</p>');
    });
  }
}

async function probe(browser: Browser, server: TestServer, options: BrowserContextOptions, path: string, media?: Parameters<Page['emulateMedia']>[0]) {
  const context = await browser.newContext(options);
  const page = await context.newPage();
  if (media)
    await page.emulateMedia(media);
  await page.goto(server.PREFIX + path);
  const result = await page.evaluate(() => ({
    dark: matchMedia('(prefers-color-scheme: dark)').matches,
    dpr: devicePixelRatio,
    reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
    forcedColors: matchMedia('(forced-colors: active)').matches,
    contrast: matchMedia('(prefers-contrast: more)').matches,
    print: matchMedia('print').matches,
    lang: navigator.language,
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    ua: navigator.userAgent,
    touch: 'ontouchstart' in window,
    coarse: matchMedia('(pointer: coarse)').matches,
    viewport: [innerWidth, innerHeight],
    screen: [screen.width, screen.height],
    orientation: screen.orientation.type,
  }));
  await context.close();
  return result;
}

it.describe('emulation with COOP', () => {
  it('EM-025 should preserve context options', async ({ browser, server }) => {
    setupRoutes(server);
    const options: BrowserContextOptions = {
      colorScheme: 'dark',
      deviceScaleFactor: 2,
      reducedMotion: 'reduce',
      contrast: 'more',
      locale: 'de-DE',
      timezoneId: 'Asia/Tokyo',
      userAgent: 'MyUA',
      hasTouch: true,
      viewport: { width: 500, height: 600 },
    };
    const plain = await probe(browser, server, options, '/plain.html');
    expect(plain).toEqual(expect.objectContaining({
      dark: true,
      dpr: 2,
      reducedMotion: true,
      contrast: true,
      lang: 'de-DE',
      tz: 'Asia/Tokyo',
      ua: 'MyUA',
      touch: true,
      viewport: [500, 600],
    }));
    const coop = await probe(browser, server, options, '/coop.html');
    expect(coop).toEqual(plain);
  });

  it('EM-026 should preserve page.emulateMedia', async ({ browser, server }) => {
    setupRoutes(server);
    const media = { media: 'print', colorScheme: 'dark', reducedMotion: 'reduce', contrast: 'more', forcedColors: 'active' } as const;
    const plain = await probe(browser, server, {}, '/plain.html', media);
    expect(plain).toEqual(expect.objectContaining({
      print: true,
      reducedMotion: true,
      contrast: true,
      forcedColors: true,
    }));
    const coop = await probe(browser, server, {}, '/coop.html', media);
    expect(coop).toEqual(plain);
  });

  it('EM-027 should preserve mobile emulation', async ({ browser, server }) => {
    setupRoutes(server);
    const options: BrowserContextOptions = {
      isMobile: true,
      hasTouch: true,
      viewport: { width: 500, height: 600 },
      screen: { width: 700, height: 900 },
    };
    const plain = await probe(browser, server, options, '/plain.html');
    expect(plain).toEqual(expect.objectContaining({
      coarse: true,
      orientation: 'portrait-primary',
    }));
    const coop = await probe(browser, server, options, '/coop.html');
    expect(coop).toEqual(plain);
  });
});
