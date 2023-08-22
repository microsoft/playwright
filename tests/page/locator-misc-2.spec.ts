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

import { test as it, expect } from './pageTest';
import os from 'os';

it('should press @smoke', async ({ page }) => {
  await page.setContent(`<input type='text' />`);
  await page.locator('input').press('h');
  expect(await page.$eval('input', input => input.value)).toBe('h');
});

it('should scroll into view', async ({ page, server, isAndroid }) => {
  it.fixme(isAndroid);

  await page.goto(server.PREFIX + '/offscreenbuttons.html');
  for (let i = 0; i < 11; ++i) {
    const button = page.locator('#btn' + i);
    const before = await button.evaluate(button => {
      return button.getBoundingClientRect().right - window.innerWidth;
    });
    expect(before).toBe(10 * i);
    await button.scrollIntoViewIfNeeded();
    const after = await button.evaluate(button => {
      return button.getBoundingClientRect().right - window.innerWidth;
    });
    expect(after <= 0).toBe(true);
    await page.evaluate(() => window.scrollTo(0, 0));
  }
});

it('should scroll zero-sized element into view', async ({ page, isAndroid, isElectron, isWebView2, browserName, isMac }) => {
  it.fixme(isAndroid || isElectron || isWebView2);
  it.skip(browserName === 'webkit' && isMac && parseInt(os.release(), 10) < 20, 'WebKit for macOS 10.15 is frozen.');

  await page.setContent(`
    <style>
      html,body { margin: 0; padding: 0; }
      ::-webkit-scrollbar { display: none; }
      * { scrollbar-width: none; }
    </style>
    <div style="height: 2000px; text-align: center; border: 10px solid blue;">
      <h1>SCROLL DOWN</h1>
    </div>
    <div id=lazyload style="font-size:75px; background-color: green;"></div>
    <script>
      const lazyLoadElement = document.querySelector('#lazyload');
      const observer = new IntersectionObserver((entries) => {
        if (entries.some(entry => entry.isIntersecting)) {
          lazyLoadElement.textContent = 'LAZY LOADED CONTENT';
          lazyLoadElement.style.height = '20px';
          observer.disconnect();
        }
      });
      observer.observe(lazyLoadElement);
    </script>
  `);
  expect(await page.locator('#lazyload').boundingBox()).toEqual({ x: 0, y: 2020, width: 1280, height: 0 });
  await page.locator('#lazyload').scrollIntoViewIfNeeded();
  await expect(page.locator('#lazyload')).toHaveText('LAZY LOADED CONTENT');
  expect(await page.locator('#lazyload').boundingBox()).toEqual({ x: 0, y: 720, width: 1280, height: 20 });
});

it('should select textarea', async ({ page, server, browserName }) => {
  await page.goto(server.PREFIX + '/input/textarea.html');
  const textarea = page.locator('textarea');
  await textarea.evaluate(textarea => (textarea as HTMLTextAreaElement).value = 'some value');
  await textarea.selectText();
  if (browserName === 'firefox' || browserName === 'webkit') {
    expect(await textarea.evaluate(el => (el as HTMLTextAreaElement).selectionStart)).toBe(0);
    expect(await textarea.evaluate(el => (el as HTMLTextAreaElement).selectionEnd)).toBe(10);
  } else {
    expect(await page.evaluate(() => window.getSelection().toString())).toBe('some value');
  }
});

it('should type', async ({ page }) => {
  await page.setContent(`<input type='text' />`);
  await page.locator('input').type('hello');
  expect(await page.$eval('input', input => input.value)).toBe('hello');
});

it('should pressSequentially', async ({ page }) => {
  await page.setContent(`<input type='text' />`);
  await page.locator('input').pressSequentially('hello');
  expect(await page.$eval('input', input => input.value)).toBe('hello');
});

it('should take screenshot', async ({ page, server, browserName, headless, isAndroid, mode }) => {
  it.skip(browserName === 'firefox' && !headless);
  it.skip(isAndroid, 'Different dpr. Remove after using 1x scale for screenshots.');
  await page.setViewportSize({ width: 500, height: 500 });
  await page.goto(server.PREFIX + '/grid.html');
  await page.evaluate(() => window.scrollBy(50, 100));
  const element = page.locator('.box:nth-of-type(3)');
  const screenshot = await element.screenshot();
  expect(screenshot).toMatchSnapshot('screenshot-element-bounding-box.png');
});

it('should return bounding box', async ({ page, server, browserName, headless, isAndroid, isLinux }) => {
  it.fixme(browserName === 'firefox' && !headless && !isLinux);
  it.skip(isAndroid);

  await page.setViewportSize({ width: 500, height: 500 });
  await page.goto(server.PREFIX + '/grid.html');
  const element = page.locator('.box:nth-of-type(13)');
  const box = await element.boundingBox();
  expect(box).toEqual({ x: 100, y: 50, width: 50, height: 50 });
});

it('should waitFor', async ({ page }) => {
  await page.setContent(`<div></div>`);
  const locator = page.locator('span');
  const promise = locator.waitFor();
  await page.$eval('div', div => div.innerHTML = '<span>target</span>');
  await promise;
  await expect(locator).toHaveText('target');
});

it('should waitFor hidden', async ({ page }) => {
  await page.setContent(`<div><span>target</span></div>`);
  const locator = page.locator('span');
  const promise = locator.waitFor({ state: 'hidden' });
  await page.$eval('div', div => div.innerHTML = '');
  await promise;
});

it('should combine visible with other selectors', async ({ page }) => {
  await page.setContent(`<div>
  <div class="item" style="display: none">Hidden data0</div>
  <div class="item">visible data1</div>
  <div class="item" style="display: none">Hidden data1</div>
  <div class="item">visible data2</div>
  <div class="item" style="display: none">Hidden data1</div>
  <div class="item">visible data3</div>
  </div>`);
  const locator = page.locator('.item >> visible=true').nth(1);
  await expect(locator).toHaveText('visible data2');
  await expect(page.locator('.item >> visible=true >> text=data3')).toHaveText('visible data3');
});

it('locator.count should work with deleted Map in main world', async ({ page }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/11254' });
  await page.evaluate('Map = 1');
  await page.locator('#searchResultTableDiv .x-grid3-row').count();
  await expect(page.locator('#searchResultTableDiv .x-grid3-row')).toHaveCount(0);
});

it('Locator.locator() and FrameLocator.locator() should accept locator', async ({ page }) => {
  await page.setContent(`
    <div><input value=outer></div>
    <iframe srcdoc="<div><input value=inner></div>"></iframe>
  `);

  const inputLocator = page.locator('input');
  expect(await inputLocator.inputValue()).toBe('outer');
  expect(await page.locator('div').locator(inputLocator).inputValue()).toBe('outer');
  expect(await page.frameLocator('iframe').locator(inputLocator).inputValue()).toBe('inner');
  expect(await page.frameLocator('iframe').locator('div').locator(inputLocator).inputValue()).toBe('inner');

  const divLocator = page.locator('div');
  expect(await divLocator.locator('input').inputValue()).toBe('outer');
  expect(await page.frameLocator('iframe').locator(divLocator).locator('input').inputValue()).toBe('inner');
});

