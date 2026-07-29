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

import type { Page } from 'playwright-core';
import { test as it, expect } from './pageTest';

function routePage(page: Page, url: string, body: string) {
  return page.route('**/' + url, route => {
    route.fulfill({ body, contentType: 'text/html' }).catch(() => {});
  });
}

async function waitForAllFrames(page: Page, frameCount: number, selector: string) {
  // Wait for all child frames to load their content, so that piercing
  // deterministically sees elements in all of them.
  await expect.poll(() => page.frames().length).toBe(frameCount);
  for (const frame of page.frames()) {
    if (frame !== page.mainFrame())
      await frame.waitForSelector(selector, { state: 'attached' });
  }
}

it('should click a button inside an iframe', async ({ page, server }) => {
  await routePage(page, 'empty.html', `<iframe src="a.html"></iframe>`);
  await routePage(page, 'a.html', `<button onclick="window.__clicked = true">Click me</button>`);
  await page.goto(server.EMPTY_PAGE);
  await page.pierceFrames().getByRole('button', { name: 'Click me' }).click();
  expect(await page.frames()[1].evaluate(() => (window as any).__clicked)).toBe(true);
});

it('should click a button in the main frame', async ({ page, server }) => {
  await routePage(page, 'empty.html', `<iframe src="a.html"></iframe><button onclick="window.__clicked = true">Click me</button>`);
  await routePage(page, 'a.html', `<div>No buttons here</div>`);
  await page.goto(server.EMPTY_PAGE);
  await page.pierceFrames().locator('button').click();
  expect(await page.evaluate(() => (window as any).__clicked)).toBe(true);
});

it('should fail click when elements match in multiple frames', async ({ page, server }) => {
  await routePage(page, 'empty.html', `<iframe src="a.html"></iframe><iframe src="b.html"></iframe>`);
  await routePage(page, 'a.html', `<button>one</button>`);
  await routePage(page, 'b.html', `<button>two</button>`);
  await page.goto(server.EMPTY_PAGE);
  await waitForAllFrames(page, 3, 'button');
  const error = await page.pierceFrames().locator('button').click({ timeout: 3000 }).catch(e => e);
  expect(error.message).toContain('Pierce-frame mode matched elements from multiple frames');
  expect(error.message).toContain(`waiting for pierceFrames().locator('button')`);
});

it('should fail click upon strict mode violation inside a single frame', async ({ page, server }) => {
  await routePage(page, 'empty.html', `<iframe src="a.html"></iframe>`);
  await routePage(page, 'a.html', `<button>one</button><button>two</button>`);
  await page.goto(server.EMPTY_PAGE);
  await waitForAllFrames(page, 2, 'button');
  const error = await page.pierceFrames().locator('button').click({ timeout: 3000 }).catch(e => e);
  expect(error.message).toContain('strict mode violation');
  expect(error.message).toContain(`waiting for pierceFrames().locator('button')`);
});

it('should time out on click when there are no matches', async ({ page, server }) => {
  await routePage(page, 'empty.html', `<iframe src="a.html"></iframe>`);
  await routePage(page, 'a.html', `<div>Nothing here</div>`);
  await page.goto(server.EMPTY_PAGE);
  const error = await page.pierceFrames().locator('button').click({ timeout: 1000 }).catch(e => e);
  expect(error.message).toContain('Timeout 1000ms exceeded');
  expect(error.message).toContain(`waiting for pierceFrames().locator('button')`);
});

it('should count elements in a single frame', async ({ page, server }) => {
  await routePage(page, 'empty.html', `<iframe src="a.html"></iframe>`);
  await routePage(page, 'a.html', `<div>1</div><div>2</div><div>3</div>`);
  await page.goto(server.EMPTY_PAGE);
  await waitForAllFrames(page, 2, 'div');
  expect(await page.pierceFrames().locator('div').count()).toBe(3);
  expect(await page.pierceFrames().locator('button').count()).toBe(0);
});

it('should fail count when elements match in multiple frames', async ({ page, server }) => {
  await routePage(page, 'empty.html', `<div>main</div><iframe src="a.html"></iframe>`);
  await routePage(page, 'a.html', `<div>child</div>`);
  await page.goto(server.EMPTY_PAGE);
  await waitForAllFrames(page, 2, 'div');
  const error = await page.pierceFrames().locator('div').count().catch(e => e);
  expect(error.message).toContain('Pierce-frame mode matched elements from multiple frames');
});

it('should support toHaveCount', async ({ page, server }) => {
  await routePage(page, 'empty.html', `<iframe src="a.html"></iframe>`);
  await routePage(page, 'a.html', `<span>one</span><span>two</span>`);
  await page.goto(server.EMPTY_PAGE);
  await expect(page.pierceFrames().locator('span')).toHaveCount(2);
  await expect(page.pierceFrames().locator('button')).toHaveCount(0);
});

it('should wait for a frame to appear with toHaveCount', async ({ page, server }) => {
  await routePage(page, 'empty.html', `<div>No frames yet</div>`);
  await routePage(page, 'a.html', `<span>one</span><span>two</span>`);
  await page.goto(server.EMPTY_PAGE);
  await page.evaluate(() => {
    window.builtins.setTimeout(() => {
      const iframe = document.createElement('iframe');
      iframe.src = 'a.html';
      document.body.appendChild(iframe);
    }, 500);
  });
  await expect(page.pierceFrames().locator('span')).toHaveCount(2);
});

it('should fail toHaveCount when elements match in multiple frames', async ({ page, server }) => {
  await routePage(page, 'empty.html', `<iframe src="a.html"></iframe><iframe src="b.html"></iframe>`);
  await routePage(page, 'a.html', `<span>one</span>`);
  await routePage(page, 'b.html', `<span>two</span>`);
  await page.goto(server.EMPTY_PAGE);
  await waitForAllFrames(page, 3, 'span');
  const error = await expect(page.pierceFrames().locator('span')).toHaveCount(2, { timeout: 3000 }).catch(e => e);
  expect(error.message).toContain('Pierce-frame mode matched elements from multiple frames');
  expect(error.message).toContain(`Locator: pierceFrames().locator('span')`);
});

it('should support toHaveText', async ({ page, server }) => {
  await routePage(page, 'empty.html', `<iframe src="a.html"></iframe>`);
  await routePage(page, 'a.html', `<div>Hello iframe</div>`);
  await page.goto(server.EMPTY_PAGE);
  await expect(page.pierceFrames().locator('div')).toHaveText('Hello iframe');
});

it('should support toHaveText with an array', async ({ page, server }) => {
  await routePage(page, 'empty.html', `<iframe src="a.html"></iframe>`);
  await routePage(page, 'a.html', `<span>one</span><span>two</span>`);
  await page.goto(server.EMPTY_PAGE);
  await expect(page.pierceFrames().locator('span')).toHaveText(['one', 'two']);
});

it('should fail toHaveText when elements match in multiple frames', async ({ page, server }) => {
  await routePage(page, 'empty.html', `<iframe src="a.html"></iframe><iframe src="b.html"></iframe>`);
  await routePage(page, 'a.html', `<div>one</div>`);
  await routePage(page, 'b.html', `<div>two</div>`);
  await page.goto(server.EMPTY_PAGE);
  await waitForAllFrames(page, 3, 'div');
  const error = await expect(page.pierceFrames().locator('div')).toHaveText('one', { timeout: 3000 }).catch(e => e);
  expect(error.message).toContain('Pierce-frame mode matched elements from multiple frames');
  expect(error.message).toContain(`Locator: pierceFrames().locator('div')`);
});

it('should fail toHaveText with an array when elements match in multiple frames', async ({ page, server }) => {
  await routePage(page, 'empty.html', `<iframe src="a.html"></iframe><iframe src="b.html"></iframe>`);
  await routePage(page, 'a.html', `<span>one</span>`);
  await routePage(page, 'b.html', `<span>two</span>`);
  await page.goto(server.EMPTY_PAGE);
  await waitForAllFrames(page, 3, 'span');
  const error = await expect(page.pierceFrames().locator('span')).toHaveText(['one', 'two'], { timeout: 3000 }).catch(e => e);
  expect(error.message).toContain('Pierce-frame mode matched elements from multiple frames');
});

it('should fail toHaveText upon strict mode violation inside a single frame', async ({ page, server }) => {
  await routePage(page, 'empty.html', `<iframe src="a.html"></iframe>`);
  await routePage(page, 'a.html', `<div>one</div><div>two</div>`);
  await page.goto(server.EMPTY_PAGE);
  await waitForAllFrames(page, 2, 'div');
  const error = await expect(page.pierceFrames().locator('div')).toHaveText('one', { timeout: 3000 }).catch(e => e);
  expect(error.message).toContain('strict mode violation');
  expect(error.message).toContain(`Locator: pierceFrames().locator('div')`);
});

it('should support evaluate', async ({ page, server }) => {
  await routePage(page, 'empty.html', `<iframe src="a.html"></iframe>`);
  await routePage(page, 'a.html', `<div data-foo="bar">Hello</div>`);
  await page.goto(server.EMPTY_PAGE);
  expect(await page.pierceFrames().locator('div').evaluate(e => e.getAttribute('data-foo'))).toBe('bar');
});

it('should fail evaluate when elements match in multiple frames', async ({ page, server }) => {
  await routePage(page, 'empty.html', `<iframe src="a.html"></iframe><iframe src="b.html"></iframe>`);
  await routePage(page, 'a.html', `<div>one</div>`);
  await routePage(page, 'b.html', `<div>two</div>`);
  await page.goto(server.EMPTY_PAGE);
  await waitForAllFrames(page, 3, 'div');
  const error = await page.pierceFrames().locator('div').evaluate(e => e.textContent, undefined, { timeout: 3000 }).catch(e => e);
  expect(error.message).toContain('Pierce-frame mode matched elements from multiple frames');
});

it('should time out on evaluate when there are no matches', async ({ page, server }) => {
  await routePage(page, 'empty.html', `<iframe src="a.html"></iframe>`);
  await routePage(page, 'a.html', `<div>Nothing here</div>`);
  await page.goto(server.EMPTY_PAGE);
  const error = await page.pierceFrames().locator('button').evaluate(e => e.textContent, undefined, { timeout: 1000 }).catch(e => e);
  expect(error.message).toContain('Timeout 1000ms exceeded');
  expect(error.message).toContain(`waiting for pierceFrames().locator('button')`);
});

it('should support evaluateAll', async ({ page, server }) => {
  await routePage(page, 'empty.html', `<iframe src="a.html"></iframe>`);
  await routePage(page, 'a.html', `<span>one</span><span>two</span>`);
  await page.goto(server.EMPTY_PAGE);
  await waitForAllFrames(page, 2, 'span');
  expect(await page.pierceFrames().locator('span').evaluateAll(els => els.map(e => e.textContent))).toEqual(['one', 'two']);
  expect(await page.pierceFrames().locator('button').evaluateAll(els => els.length)).toBe(0);
});

it('should fail evaluateAll when elements match in multiple frames', async ({ page, server }) => {
  await routePage(page, 'empty.html', `<iframe src="a.html"></iframe><iframe src="b.html"></iframe>`);
  await routePage(page, 'a.html', `<span>one</span>`);
  await routePage(page, 'b.html', `<span>two</span>`);
  await page.goto(server.EMPTY_PAGE);
  await waitForAllFrames(page, 3, 'span');
  const error = await page.pierceFrames().locator('span').evaluateAll(els => els.length).catch(e => e);
  expect(error.message).toContain('Pierce-frame mode matched elements from multiple frames');
});

it('should support hasText filter', async ({ page, server }) => {
  await routePage(page, 'empty.html', `<iframe src="a.html"></iframe>`);
  await routePage(page, 'a.html', `<div>foo</div><div>bar</div>`);
  await page.goto(server.EMPTY_PAGE);
  await expect(page.pierceFrames().locator('div', { hasText: 'bar' })).toHaveText('bar');
});

it('should support first/last/nth as the last operation', async ({ page, server }) => {
  await routePage(page, 'empty.html', `<iframe src="a.html"></iframe>`);
  await routePage(page, 'a.html', `<span>one</span><span>two</span><span>three</span>`);
  await page.goto(server.EMPTY_PAGE);
  await waitForAllFrames(page, 2, 'span');
  await expect(page.pierceFrames().locator('span').first()).toHaveText('one');
  await expect(page.pierceFrames().locator('span').last()).toHaveText('three');
  await expect(page.pierceFrames().locator('span').nth(1)).toHaveText('two');
});

it('should pierce a frame inside the scope', async ({ page, server }) => {
  await routePage(page, 'empty.html', `<section><iframe src="a.html"></iframe></section><button>outside</button>`);
  await routePage(page, 'a.html', `<button>inside</button>`);
  await page.goto(server.EMPTY_PAGE);
  await waitForAllFrames(page, 2, 'button');
  const scope = (await page.$('section'))!;
  const buttons = await scope.$$('internal:control=pierce-frames >> button');
  expect(buttons.length).toBe(1);
  expect(await buttons[0].textContent()).toBe('inside');
});

it('should pierce a nested frame inside the scope', async ({ page, server }) => {
  await routePage(page, 'empty.html', `<section><iframe src="a.html"></iframe></section><iframe src="b.html"></iframe>`);
  await routePage(page, 'a.html', `<iframe src="c.html"></iframe>`);
  await routePage(page, 'b.html', `<button>outside</button>`);
  await routePage(page, 'c.html', `<button>deep</button>`);
  await page.goto(server.EMPTY_PAGE);
  await expect.poll(() => page.frames().length).toBe(4);
  for (const frame of page.frames()) {
    if (frame.url().includes('b.html') || frame.url().includes('c.html'))
      await frame.waitForSelector('button', { state: 'attached' });
  }
  const scope = (await page.$('section'))!;
  const buttons = await scope.$$('internal:control=pierce-frames >> button');
  expect(buttons.length).toBe(1);
  expect(await buttons[0].textContent()).toBe('deep');
});

it('should respect the scope without a frame inside the scope', async ({ page, server }) => {
  await routePage(page, 'empty.html', `<section><button>target</button></section><iframe src="a.html"></iframe>`);
  await routePage(page, 'a.html', `<button>in-frame</button>`);
  await page.goto(server.EMPTY_PAGE);
  await waitForAllFrames(page, 2, 'button');
  const scope = (await page.$('section'))!;
  const buttons = await scope.$$('internal:control=pierce-frames >> button');
  expect(buttons.length).toBe(1);
  expect(await buttons[0].textContent()).toBe('target');
});

it('should pierce nested frames below a matching prefix', async ({ page, server }) => {
  await routePage(page, 'empty.html', `<section><iframe src="a.html"></iframe></section>`);
  await routePage(page, 'a.html', `<iframe src="b.html"></iframe>`);
  await routePage(page, 'b.html', `<button>deep</button>`);
  await page.goto(server.EMPTY_PAGE);
  await expect.poll(() => page.frames().length).toBe(3);
  const deepFrame = page.frames().find(f => f.url().includes('b.html'))!;
  await deepFrame.waitForSelector('button', { state: 'attached' });
  await expect(page.pierceFrames().locator('section').locator('button')).toHaveText('deep');
});

it('should pierce only frames inside the starting frame', async ({ page, server }) => {
  await routePage(page, 'empty.html', `<iframe src="a.html"></iframe><button>main</button>`);
  await routePage(page, 'a.html', `<iframe src="b.html"></iframe>`);
  await routePage(page, 'b.html', `<button>deep</button>`);
  await page.goto(server.EMPTY_PAGE);
  await expect.poll(() => page.frames().length).toBe(3);
  const deepFrame = page.frames().find(f => f.url().includes('b.html'))!;
  await deepFrame.waitForSelector('button', { state: 'attached' });
  const middleFrame = page.frames().find(f => f.url().includes('a.html'))!;
  await expect(middleFrame.pierceFrames().locator('button')).toHaveText('deep');
});

it('should enter a frame found in a nested frame', async ({ page, server }) => {
  await routePage(page, 'empty.html', `<iframe src="a.html"></iframe><button>main</button>`);
  await routePage(page, 'a.html', `<iframe id="target" src="b.html"></iframe><button>decoy</button>`);
  await routePage(page, 'b.html', `<button>inside</button>`);
  await page.goto(server.EMPTY_PAGE);
  await expect(page.pierceFrames().frameLocator('#target').locator('button')).toHaveText('inside');
});

it('should click inside an entered frame', async ({ page, server }) => {
  await routePage(page, 'empty.html', `<iframe src="a.html"></iframe>`);
  await routePage(page, 'a.html', `<iframe id="target" src="b.html"></iframe><button>Click me</button>`);
  await routePage(page, 'b.html', `<button onclick="window.__clicked = true">Click me</button>`);
  await page.goto(server.EMPTY_PAGE);
  await page.pierceFrames().frameLocator('#target').getByRole('button', { name: 'Click me' }).click();
  const frame = page.frames().find(f => f.url().includes('b.html'))!;
  expect(await frame.evaluate(() => (window as any).__clicked)).toBe(true);
});

it('should pierce frames inside the entered frame', async ({ page, server }) => {
  await routePage(page, 'empty.html', `<iframe id="target" src="a.html"></iframe><button>main</button>`);
  await routePage(page, 'a.html', `<iframe src="b.html"></iframe>`);
  await routePage(page, 'b.html', `<button>deep</button>`);
  await page.goto(server.EMPTY_PAGE);
  await expect(page.pierceFrames().frameLocator('#target').locator('button')).toHaveText('deep');
});

it('should support two frameLocators while piercing', async ({ page, server }) => {
  await routePage(page, 'empty.html', `<iframe src="a.html"></iframe>`);
  await routePage(page, 'a.html', `<iframe id="x" src="b.html"></iframe>`);
  await routePage(page, 'b.html', `<iframe id="y" src="c.html"></iframe><button>decoy</button>`);
  await routePage(page, 'c.html', `<button>bottom</button>`);
  await page.goto(server.EMPTY_PAGE);
  await expect(page.pierceFrames().frameLocator('#x').frameLocator('#y').locator('button')).toHaveText('bottom');
});

it('should support locator before frameLocator while piercing', async ({ page, server }) => {
  await routePage(page, 'empty.html', `<iframe src="a.html"></iframe>`);
  await routePage(page, 'a.html', `<section><iframe src="b.html"></iframe></section><iframe src="c.html"></iframe>`);
  await routePage(page, 'b.html', `<button>in-section</button>`);
  await routePage(page, 'c.html', `<button>outside</button>`);
  await page.goto(server.EMPTY_PAGE);
  await expect(page.pierceFrames().locator('section').frameLocator('iframe').locator('button')).toHaveText('in-section');
});

it('should support owner of a frameLocator while piercing', async ({ page, server }) => {
  await routePage(page, 'empty.html', `<iframe src="a.html"></iframe>`);
  await routePage(page, 'a.html', `<iframe id="target" src="b.html"></iframe>`);
  await routePage(page, 'b.html', `<button>inside</button>`);
  await page.goto(server.EMPTY_PAGE);
  expect(await page.pierceFrames().frameLocator('#target').owner().getAttribute('id')).toBe('target');
});

it('should wait for the frame to enter to appear', async ({ page, server }) => {
  await routePage(page, 'empty.html', `<iframe src="a.html"></iframe>`);
  await routePage(page, 'a.html', `<div>Nothing yet</div>`);
  await routePage(page, 'b.html', `<button>late</button>`);
  await page.goto(server.EMPTY_PAGE);
  await expect.poll(() => page.frames().length).toBe(2);
  await page.frames()[1].evaluate(() => {
    window.builtins.setTimeout(() => {
      const iframe = document.createElement('iframe');
      iframe.id = 'late';
      iframe.src = 'b.html';
      document.body.appendChild(iframe);
    }, 3000);
  });
  await expect(page.pierceFrames().frameLocator('#late').locator('button')).toHaveText('late');
});

it('should fail when the frame to enter matches in multiple frames', async ({ page, server }) => {
  await routePage(page, 'empty.html', `<iframe src="a.html"></iframe><iframe src="b.html"></iframe>`);
  await routePage(page, 'a.html', `<iframe class="inner" src="c.html"></iframe>`);
  await routePage(page, 'b.html', `<iframe class="inner" src="c.html"></iframe>`);
  await routePage(page, 'c.html', `<button>Click me</button>`);
  await page.goto(server.EMPTY_PAGE);
  await expect.poll(() => page.frames().length).toBe(5);
  for (const frame of page.frames()) {
    if (frame.url().includes('c.html'))
      await frame.waitForSelector('button', { state: 'attached' });
  }
  const error = await page.pierceFrames().frameLocator('.inner').locator('button').click({ timeout: 3000 }).catch(e => e);
  expect(error.message).toContain('Pierce-frame mode matched elements from multiple frames');
});

it('should support contentFrame while piercing', async ({ page, server }) => {
  await routePage(page, 'empty.html', `<iframe src="a.html"></iframe>`);
  await routePage(page, 'a.html', `<iframe id="target" src="b.html"></iframe><button>decoy</button>`);
  await routePage(page, 'b.html', `<button>inside</button>`);
  await page.goto(server.EMPTY_PAGE);
  await expect(page.pierceFrames().locator('#target').contentFrame().locator('button')).toHaveText('inside');
});

it('should enter only the frame element when the selector matches other elements too', async ({ page, server }) => {
  await routePage(page, 'empty.html', `<div class="foo">not a frame</div><iframe class="foo" src="a.html"></iframe>`);
  await routePage(page, 'a.html', `<iframe src="b.html"></iframe>`);
  await routePage(page, 'b.html', `<div id="target">found</div>`);
  await page.goto(server.EMPTY_PAGE);
  await expect(page.pierceFrames().locator('.foo').contentFrame().locator('#target')).toHaveText('found');
});

it('should render frameLocator while piercing in the locator description', async ({ page }) => {
  expect(String(page.pierceFrames().frameLocator('#x').locator('button'))).toBe(`pierceFrames().locator('#x').contentFrame().locator('button')`);
  expect(String(page.pierceFrames().locator('section').frameLocator('iframe').getByText('foo'))).toBe(`pierceFrames().locator('section').locator('iframe').contentFrame().getByText('foo')`);
});

it('should not allow nth in the middle', async ({ page }) => {
  const error = await page.pierceFrames().locator('div').first().locator('span').count().catch(e => e);
  expect(error.message).toContain(`nth can only be the last locator when piercing frames, while querying "pierceFrames().locator('div').first().locator('span')"`);
});

it('should not allow first/last/nth after pierceFrames', async ({ page }) => {
  expect(() => page.pierceFrames().first()).toThrow('Selecting the nth frame is not allowed while piercing frames');
  expect(() => page.pierceFrames().last()).toThrow('Selecting the nth frame is not allowed while piercing frames');
  expect(() => page.pierceFrames().nth(1)).toThrow('Selecting the nth frame is not allowed while piercing frames');
  expect(() => page.pierceFrames().frameLocator('#x').first()).toThrow('Selecting the nth frame is not allowed while piercing frames');
});

it('should not allow composite locators', async ({ page }) => {
  const error = await page.pierceFrames().locator('div', { has: page.locator('span') }).count().catch(e => e);
  expect(error.message).toContain(`Composite locators are not supported with piercing frames, while querying "pierceFrames().locator('div').filter({ has: locator('span') })"`);
});

it('should not allow owner', async ({ page }) => {
  const error = await page.pierceFrames().owner().count().catch(e => e);
  expect(error.message).toContain('Selector cannot be empty when piercing frames');
});

it('should render pierceFrames in the locator description', async ({ page }) => {
  expect(String(page.pierceFrames().locator('button'))).toBe(`pierceFrames().locator('button')`);
  expect(String(page.pierceFrames().getByText('foo'))).toBe(`pierceFrames().getByText('foo')`);
});

it('should click while another iframe is stalled', async ({ page, server }) => {
  await routePage(page, 'empty.html', `<iframe src="a.html"></iframe><iframe src="stall.html"></iframe>`);
  await routePage(page, 'a.html', `<button onclick="window.__clicked = true">Click me</button>`);
  await page.route('**/stall.html', () => {});
  await page.goto(server.EMPTY_PAGE, { waitUntil: 'domcontentloaded' });
  await expect.poll(() => page.frames().length).toBe(3);
  await page.pierceFrames().locator('button').click();
  const frame = page.frames().find(f => f.url().includes('a.html'))!;
  expect(await frame.evaluate(() => (window as any).__clicked)).toBe(true);
});

it('should support toBeVisible while another iframe is stalled', async ({ page, server }) => {
  await routePage(page, 'empty.html', `<iframe src="a.html"></iframe><iframe src="stall.html"></iframe>`);
  await routePage(page, 'a.html', `<button>Click me</button>`);
  await page.route('**/stall.html', () => {});
  await page.goto(server.EMPTY_PAGE, { waitUntil: 'domcontentloaded' });
  await expect.poll(() => page.frames().length).toBe(3);
  await expect(page.pierceFrames().locator('button')).toBeVisible();
});

it('should support toHaveCount while another iframe is stalled', async ({ page, server }) => {
  await routePage(page, 'empty.html', `<iframe src="a.html"></iframe><iframe src="stall.html"></iframe>`);
  await routePage(page, 'a.html', `<button>Click me</button>`);
  await page.route('**/stall.html', () => {});
  await page.goto(server.EMPTY_PAGE, { waitUntil: 'domcontentloaded' });
  await expect.poll(() => page.frames().length).toBe(3);
  await expect(page.pierceFrames().locator('button')).toHaveCount(1);
});
