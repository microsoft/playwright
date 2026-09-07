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

import { browserTest as test, expect } from '../../config/browserTest';
import type { ServerResponse } from 'http';

for (const finishBeforeDCL of [true, false]) {
  test(`should reach networkidle when requests finish ${finishBeforeDCL ? 'before' : 'after'} DOMContentLoaded following an initial idle`, async ({ page, server }) => {
    test.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/42598' });

    let schemaResponse: ServerResponse;
    const schemaFinished = page.waitForEvent('requestfinished', request => request.url().endsWith('/schema.json'));
    const scriptFinished = page.waitForEvent('requestfinished', request => request.url().endsWith('/finish.js'));
    server.setRoute('/network-idle.html', (req, res) => {
      res.setHeader('Content-Type', 'text/html');
      res.end('<script src="/app.js"></script>');
    });
    server.setRoute('/app.js', (req, res) => {
      res.setHeader('Content-Type', 'text/javascript');
      res.end(`
        debugger;
        window.result = fetch('/schema.json').then(r => r.json());
        document.write('<script src="/finish.js"></' + 'script>');
      `);
    });
    server.setRoute('/schema.json', (req, res) => {
      schemaResponse = res;
      if (finishBeforeDCL)
        res.end('{"name":"done"}');
    });
    server.setRoute('/finish.js', async (req, res) => {
      if (finishBeforeDCL)
        await schemaFinished;
      res.setHeader('Content-Type', 'text/javascript');
      res.end('debugger;');
    });
    let domContentLoaded = false;
    page.on('domcontentloaded', () => domContentLoaded = true);
    const session = await page.context().newCDPSession(page);
    await session.send('Debugger.enable');

    // Hold the parser, but not the network or Playwright's real idle timer.
    const firstPause = new Promise<void>(resolve => session.once('Debugger.paused', () => resolve()));
    await page.goto(server.PREFIX + '/network-idle.html', { waitUntil: 'commit' });
    await firstPause;
    await page.waitForLoadState('networkidle');
    expect(domContentLoaded).toBe(false);

    const secondPause = new Promise<void>(resolve => session.once('Debugger.paused', () => resolve()));
    await session.send('Debugger.resume');
    await secondPause;
    await scriptFinished;
    if (finishBeforeDCL)
      await schemaFinished;
    expect(domContentLoaded).toBe(false);

    await session.send('Debugger.resume');
    await page.waitForLoadState('domcontentloaded');
    if (!finishBeforeDCL)
      schemaResponse.end('{"name":"done"}');
    await schemaFinished;
    await page.waitForLoadState('load');
    await page.waitForLoadState('networkidle', { timeout: 3000 });
    expect(await page.evaluate(() => window['result'])).toEqual({ name: 'done' });
    await session.detach();
  });
}
