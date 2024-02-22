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

import { expect, test as it } from './pageTest';

it('should not hit scroll bar', async ({ page, browserName, platform }) => {
  it.fixme(browserName === 'webkit' && platform === 'linux', 'Fails in headless and in headful on Ubuntu 22.04');
  it.fixme(browserName === 'webkit' && platform === 'win32', 'https://github.com/microsoft/playwright/issues/18452');

  await page.setContent(`
    <style>
      .categories { width: 180px; display: flex; overflow-x: scroll; }
      button { flex: none; height: 28px; }
    </style>
    <div class="categories">
      <button>One</button>
      <button>Two</button>
      <button>Three</button>
      <button>Story</button>
      <button>More</button>
      <button>Items</button>
      <button>Here</button>
    </div>
    `);
  await page.click('text=Story', { timeout: 2000 });
});

it('should scroll into view display:contents', async ({ page, browserName, browserMajorVersion }) => {
  it.skip(browserName === 'chromium' && browserMajorVersion < 105, 'Needs https://chromium-review.googlesource.com/c/chromium/src/+/3758670');

  await page.setContent(`
    <div style="background:red;height:2000px">filler</div>
    <div>
      Example text, and button here:
      <button style="display: contents" onclick="window._clicked=true;">click me</button>
    </div>
  `);
  await page.click('text=click me', { timeout: 5000 });
  expect(await page.evaluate('window._clicked')).toBe(true);
});

it('should scroll into view display:contents with a child', async ({ page, browserName, browserMajorVersion }) => {
  it.skip(browserName === 'chromium' && browserMajorVersion < 105, 'Needs https://chromium-review.googlesource.com/c/chromium/src/+/3758670');

  await page.setContent(`
    <div style="background:red;height:2000px">filler</div>
    Example text, and button here:
    <button style="display: contents" onclick="window._clicked=true;"><div>click me</div></button>
  `);
  await page.click('text=click me', { timeout: 5000 });
  expect(await page.evaluate('window._clicked')).toBe(true);
});

it('should scroll into view display:contents with position', async ({ page, browserName }) => {
  it.fixme(browserName === 'chromium', 'DOM.getBoxModel does not work for display:contents');

  await page.setContent(`
    <div style="background:red;height:2000px">filler</div>
    <div>
      Example text, and button here:
      <button style="display: contents" onclick="window._clicked=true;">click me</button>
    </div>
  `);
  await page.click('text=click me', { position: { x: 5, y: 5 }, timeout: 5000 });
  expect(await page.evaluate('window._clicked')).toBe(true);
});

it('should not crash when force-clicking hidden input', async ({ page, isWebView2 }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/18183' });
  it.fixme(isWebView2);

  await page.setContent(`<input type=hidden>`);
  const error = await page.locator('input').click({ force: true, timeout: 2000 }).catch(e => e);
  expect(error.message).toContain('Element is not visible');
});

it('should scroll into view span element', async ({ page, isAndroid }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/20165' });
  it.fixme(isAndroid);
  await page.setContent(`
    <div id=big style="height: 10000px;"></div>
    <span id=small>foo</span>
  `);
  await page.locator('#small').scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(9000);
});

it('should scroll into view element in iframe', async ({ page, isAndroid, server, browserName }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/27196' });
  it.fixme(isAndroid);
  await page.goto(server.EMPTY_PAGE);
  await page.setContent(`
    <div id=big style="height: 10000px;"></div>
    <iframe src='${server.CROSS_PROCESS_PREFIX}/input/button.html'></iframe>
  `);
  await page.frameLocator('iframe').getByRole('button').click({ timeout: 5000 });
});
