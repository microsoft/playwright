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

import { test as it, expect, rafraf } from './pageTest';

it('should timeout waiting for stable position', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/input/button.html');
  const button = await page.$('button');
  await button.evaluate(button => {
    button.style.transition = 'margin 5s linear 0s';
    button.style.marginLeft = '200px';
  });
  // rafraf for Firefox to kick in the animation.
  await rafraf(page);
  const error = await button.click({ timeout: 3000 }).catch(e => e);
  expect(error.message).toContain('elementHandle.click: Timeout 3000ms exceeded.');
  expect(error.message).toContain('waiting for element to be visible, enabled and stable');
  expect(error.message).toContain('element is not stable');
  expect(error.message).toContain('retrying click action');
});

it('should click for the second time after first timeout', async ({ page, server, mode }) => {
  it.skip(mode !== 'default');

  await page.goto(server.PREFIX + '/input/button.html');
  const __testHookBeforePointerAction = () => new Promise(f => setTimeout(f, 1500));
  const error = await page.click('button', { timeout: 1000, __testHookBeforePointerAction } as any).catch(e => e);
  expect(error.message).toContain('page.click: Timeout 1000ms exceeded.');

  expect(await page.evaluate('result')).toBe('Was not clicked');
  await page.waitForTimeout(2000);
  expect(await page.evaluate('result')).toBe('Was not clicked');

  await page.click('button');
  expect(await page.evaluate('result')).toBe('Clicked');
});

it('should fail to click the button behind a large header after scrolling around', async ({ page, isAndroid }) => {
  it.skip(isAndroid, 'Different viewport size');
  await page.setViewportSize({ width: 500, height: 240 });
  await page.setContent(`
    <style>
    * {
      padding: 0;
      margin: 0;
    }
    li {
      height: 80px;
      border: 1px solid black;
    }
    ol {
      padding-top: 160px;
    }
    div.fixed {
      position: fixed;
      z-index: 1001;
      width: 100%;
      background: rgba(255, 0, 0, 0.2);
      height: 2000px;
    }
    </style>

    <div class=fixed></div>

    <ol>
    <li>hi1</li><li>hi2</li><li>hi3</li><li>hi4</li><li>hi5</li><li>hi6</li><li>hi7</li><li>hi8</li>
    <li id=target onclick="window.__clicked = true">hi9</li>
    <li>hi10</li><li>hi11</li><li>hi12</li><li>hi13</li><li id=li14>hi14</li>
    </ol>

    <script>
      window.scrollTops = [];
      window.addEventListener('scroll', () => {
        window.scrollTops.push(window.scrollY);
      });
    </script>
  `);
  await page.$eval('#li14', e => e.scrollIntoView());
  const error = await page.click('#target', { timeout: 1500 }).catch(e => e);
  expect(error.message).toContain(`<div class="fixed"></div> intercepts pointer events`);
  expect(await page.evaluate(() => window['__clicked'])).toBe(undefined);
  const scrollTops = await page.evaluate(() => window['scrollTops']);
  const distinct = new Set(scrollTops);
  expect(distinct.size).toBeGreaterThan(2);  // At least three different scroll positions.
});
