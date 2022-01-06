/**
 * Copyright Microsoft Corporation. All rights reserved.
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

import os from 'os';
import url from 'url';
import { contextTest as it, expect } from './config/browserTest';

it('SharedArrayBuffer should work #smoke', async function({ contextFactory, httpsServer, browserName }) {
  it.fail(browserName === 'webkit', 'no shared array buffer on webkit');
  const context = await contextFactory({ ignoreHTTPSErrors: true });
  const page = await context.newPage();
  httpsServer.setRoute('/sharedarraybuffer', (req, res) => {
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    res.end();
  });
  await page.goto(httpsServer.PREFIX + '/sharedarraybuffer');
  expect(await page.evaluate(() => typeof SharedArrayBuffer)).toBe('function');
});

it('Web Assembly should work #smoke', async function({ page, server, browserName, platform }) {
  it.fail(browserName === 'webkit' && platform === 'win32');

  await page.goto(server.PREFIX + '/wasm/table2.html');
  expect(await page.evaluate('loadTable()')).toBe('42, 83');
});

it('WebSocket should work #smoke', async ({ page, server }) => {
  server.sendOnWebSocketConnection('incoming');
  const value = await page.evaluate(port => {
    let cb;
    const result = new Promise(f => cb = f);
    const ws = new WebSocket('ws://localhost:' + port + '/ws');
    ws.addEventListener('message', data => { ws.close(); cb(data.data); });
    ws.addEventListener('error', error => cb('Error'));
    return result;
  }, server.PORT);
  expect(value).toBe('incoming');
});

it('should respect CSP #smoke', async ({ page, server }) => {
  server.setRoute('/empty.html', async (req, res) => {
    res.setHeader('Content-Security-Policy', `script-src 'unsafe-inline';`);
    res.end(`
      <script>
        window.testStatus = 'SUCCESS';
        window.testStatus = eval("'FAILED'");
      </script>`);
  });

  await page.goto(server.EMPTY_PAGE);
  expect(await page.evaluate(() => window['testStatus'])).toBe('SUCCESS');
});

it('should play video #smoke', async ({ page, asset, browserName, platform }) => {
  // TODO: the test passes on Windows locally but fails on GitHub Action bot,
  // apparently due to a Media Pack issue in the Windows Server.
  // Also the test is very flaky on Linux WebKit.
  it.fixme(browserName === 'webkit' && platform !== 'darwin');
  it.fixme(browserName === 'firefox', 'https://github.com/microsoft/playwright/issues/5721');
  it.fixme(browserName === 'webkit' && platform === 'darwin' && parseInt(os.release(), 10) >= 20, 'Does not work on BigSur');

  // Safari only plays mp4 so we test WebKit with an .mp4 clip.
  const fileName = browserName === 'webkit' ? 'video_mp4.html' : 'video.html';
  const absolutePath = asset(fileName);
  // Our test server doesn't support range requests required to play on Mac,
  // so we load the page using a file url.
  await page.goto(url.pathToFileURL(absolutePath).href);
  await page.$eval('video', v => v.play());
  await page.$eval('video', v => v.pause());
});

it('should play audio #smoke', async ({ page, server, browserName, platform }) => {
  it.fixme(browserName === 'firefox' && platform === 'win32', 'https://github.com/microsoft/playwright/issues/10887');
  it.fixme(browserName === 'firefox' && platform === 'linux', 'https://github.com/microsoft/playwright/issues/10887');
  it.fixme(browserName === 'webkit' && platform === 'win32', 'https://github.com/microsoft/playwright/issues/10892');
  await page.goto(server.EMPTY_PAGE);
  await page.setContent(`<audio src="${server.PREFIX}/example.mp3"></audio>`);
  await page.$eval('audio', e => e.play());
  await page.waitForTimeout(1000);
  await page.$eval('audio', e => e.pause());
  expect(await page.$eval('audio', e => e.currentTime)).toBeGreaterThan(0.5);
});

it('should support webgl #smoke', async ({ page, browserName, headless }) => {
  it.fixme(browserName === 'firefox' && headless);

  const hasWebGL = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    return !!canvas.getContext('webgl');
  });
  expect(hasWebGL).toBe(true);
});

it('should support webgl 2 #smoke', async ({ page, browserName, headless }) => {
  it.skip(browserName === 'webkit', 'WebKit doesn\'t have webgl2 enabled yet upstream.');
  it.fixme(browserName === 'firefox' && headless);
  it.fixme(browserName === 'chromium' && !headless, 'chromium doesn\'t like webgl2 when running under xvfb');

  const hasWebGL2 = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    return !!canvas.getContext('webgl2');
  });
  expect(hasWebGL2).toBe(true);
});

it('should not crash on page with mp4 #smoke', async ({ page, server, platform, browserName }) => {
  it.fixme(browserName === 'webkit' && platform === 'win32', 'https://github.com/microsoft/playwright/issues/11009, times out in setContent');
  await page.setContent(`<video><source src="${server.PREFIX}/movie.mp4"/></video>`);
  await page.waitForTimeout(1000);
});

it('should not crash on showDirectoryPicker', async ({ page, server, platform, browserName }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/7339' });
  it.fixme(browserName === 'chromium', 'https://github.com/microsoft/playwright/issues/7339, crashes');
  it.skip(browserName !== 'chromium', 'showDirectoryPicker is only available in Chromium');
  await page.goto(server.EMPTY_PAGE);
  await page.evaluate(async () => {
    const dir = await (window as any).showDirectoryPicker();
    return dir.name;
  });
});
