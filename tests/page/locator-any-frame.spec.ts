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
  // Wait for all child frames to load their content, so that the search
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
  await page.anyFrame().getByRole('button', { name: 'Click me' }).click();
  expect(await page.frames()[1].evaluate(() => (window as any).__clicked)).toBe(true);
});

it('should click a button in the main frame', async ({ page, server }) => {
  await routePage(page, 'empty.html', `<iframe src="a.html"></iframe><button onclick="window.__clicked = true">Click me</button>`);
  await routePage(page, 'a.html', `<div>No buttons here</div>`);
  await page.goto(server.EMPTY_PAGE);
  await page.anyFrame().locator('button').click();
  expect(await page.evaluate(() => (window as any).__clicked)).toBe(true);
});

it('should fail click when elements match in multiple frames', async ({ page, server }) => {
  await routePage(page, 'empty.html', `<iframe src="a.html"></iframe><iframe src="b.html"></iframe>`);
  await routePage(page, 'a.html', `<button>one</button>`);
  await routePage(page, 'b.html', `<button>two</button>`);
  await page.goto(server.EMPTY_PAGE);
  await waitForAllFrames(page, 3, 'button');
  const error = await page.anyFrame().locator('button').click({ timeout: 3000 }).catch(e => e);
  expect(error.message).toContain('anyFrame() matched elements in multiple frames');
  expect(error.message).toContain(`waiting for anyFrame().locator('button')`);
});

it('should fail click upon strict mode violation inside a single frame', async ({ page, server }) => {
  await routePage(page, 'empty.html', `<iframe src="a.html"></iframe>`);
  await routePage(page, 'a.html', `<button>one</button><button>two</button>`);
  await page.goto(server.EMPTY_PAGE);
  await waitForAllFrames(page, 2, 'button');
  const error = await page.anyFrame().locator('button').click({ timeout: 3000 }).catch(e => e);
  expect(error.message).toContain('strict mode violation');
  expect(error.message).toContain(`waiting for anyFrame().locator('button')`);
});

it('should time out on click when there are no matches', async ({ page, server }) => {
  await routePage(page, 'empty.html', `<iframe src="a.html"></iframe>`);
  await routePage(page, 'a.html', `<div>Nothing here</div>`);
  await page.goto(server.EMPTY_PAGE);
  const error = await page.anyFrame().locator('button').click({ timeout: 1000 }).catch(e => e);
  expect(error.message).toContain('Timeout 1000ms exceeded');
  expect(error.message).toContain(`waiting for anyFrame().locator('button')`);
});

it('should count elements in a single frame', async ({ page, server }) => {
  await routePage(page, 'empty.html', `<iframe src="a.html"></iframe>`);
  await routePage(page, 'a.html', `<div>1</div><div>2</div><div>3</div>`);
  await page.goto(server.EMPTY_PAGE);
  await waitForAllFrames(page, 2, 'div');
  expect(await page.anyFrame().locator('div').count()).toBe(3);
  expect(await page.anyFrame().locator('button').count()).toBe(0);
});

it('should fail count when elements match in multiple frames', async ({ page, server }) => {
  await routePage(page, 'empty.html', `<div>main</div><iframe src="a.html"></iframe>`);
  await routePage(page, 'a.html', `<div>child</div>`);
  await page.goto(server.EMPTY_PAGE);
  await waitForAllFrames(page, 2, 'div');
  const error = await page.anyFrame().locator('div').count().catch(e => e);
  expect(error.message).toContain('anyFrame() matched elements in multiple frames');
});

it('should support toHaveCount', async ({ page, server }) => {
  await routePage(page, 'empty.html', `<iframe src="a.html"></iframe>`);
  await routePage(page, 'a.html', `<span>one</span><span>two</span>`);
  await page.goto(server.EMPTY_PAGE);
  await expect(page.anyFrame().locator('span')).toHaveCount(2);
  await expect(page.anyFrame().locator('button')).toHaveCount(0);
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
  await expect(page.anyFrame().locator('span')).toHaveCount(2);
});

it('should fail toHaveCount when elements match in multiple frames', async ({ page, server }) => {
  await routePage(page, 'empty.html', `<iframe src="a.html"></iframe><iframe src="b.html"></iframe>`);
  await routePage(page, 'a.html', `<span>one</span>`);
  await routePage(page, 'b.html', `<span>two</span>`);
  await page.goto(server.EMPTY_PAGE);
  await waitForAllFrames(page, 3, 'span');
  const error = await expect(page.anyFrame().locator('span')).toHaveCount(2, { timeout: 3000 }).catch(e => e);
  expect(error.message).toContain('anyFrame() matched elements in multiple frames');
  expect(error.message).toContain(`Locator: anyFrame().locator('span')`);
});

it('should support toHaveText', async ({ page, server }) => {
  await routePage(page, 'empty.html', `<iframe src="a.html"></iframe>`);
  await routePage(page, 'a.html', `<div>Hello iframe</div>`);
  await page.goto(server.EMPTY_PAGE);
  await expect(page.anyFrame().locator('div')).toHaveText('Hello iframe');
});

it('should support toHaveText with an array', async ({ page, server }) => {
  await routePage(page, 'empty.html', `<iframe src="a.html"></iframe>`);
  await routePage(page, 'a.html', `<span>one</span><span>two</span>`);
  await page.goto(server.EMPTY_PAGE);
  await expect(page.anyFrame().locator('span')).toHaveText(['one', 'two']);
});

it('should fail toHaveText when elements match in multiple frames', async ({ page, server }) => {
  await routePage(page, 'empty.html', `<iframe src="a.html"></iframe><iframe src="b.html"></iframe>`);
  await routePage(page, 'a.html', `<div>one</div>`);
  await routePage(page, 'b.html', `<div>two</div>`);
  await page.goto(server.EMPTY_PAGE);
  await waitForAllFrames(page, 3, 'div');
  const error = await expect(page.anyFrame().locator('div')).toHaveText('one', { timeout: 3000 }).catch(e => e);
  expect(error.message).toContain('anyFrame() matched elements in multiple frames');
  expect(error.message).toContain(`Locator: anyFrame().locator('div')`);
});

it('should fail toHaveText with an array when elements match in multiple frames', async ({ page, server }) => {
  await routePage(page, 'empty.html', `<iframe src="a.html"></iframe><iframe src="b.html"></iframe>`);
  await routePage(page, 'a.html', `<span>one</span>`);
  await routePage(page, 'b.html', `<span>two</span>`);
  await page.goto(server.EMPTY_PAGE);
  await waitForAllFrames(page, 3, 'span');
  const error = await expect(page.anyFrame().locator('span')).toHaveText(['one', 'two'], { timeout: 3000 }).catch(e => e);
  expect(error.message).toContain('anyFrame() matched elements in multiple frames');
});

it('should fail toHaveText upon strict mode violation inside a single frame', async ({ page, server }) => {
  await routePage(page, 'empty.html', `<iframe src="a.html"></iframe>`);
  await routePage(page, 'a.html', `<div>one</div><div>two</div>`);
  await page.goto(server.EMPTY_PAGE);
  await waitForAllFrames(page, 2, 'div');
  const error = await expect(page.anyFrame().locator('div')).toHaveText('one', { timeout: 3000 }).catch(e => e);
  expect(error.message).toContain('strict mode violation');
  expect(error.message).toContain(`Locator: anyFrame().locator('div')`);
});

it('should support evaluate', async ({ page, server }) => {
  await routePage(page, 'empty.html', `<iframe src="a.html"></iframe>`);
  await routePage(page, 'a.html', `<div data-foo="bar">Hello</div>`);
  await page.goto(server.EMPTY_PAGE);
  expect(await page.anyFrame().locator('div').evaluate(e => e.getAttribute('data-foo'))).toBe('bar');
});

it('should fail evaluate when elements match in multiple frames', async ({ page, server }) => {
  await routePage(page, 'empty.html', `<iframe src="a.html"></iframe><iframe src="b.html"></iframe>`);
  await routePage(page, 'a.html', `<div>one</div>`);
  await routePage(page, 'b.html', `<div>two</div>`);
  await page.goto(server.EMPTY_PAGE);
  await waitForAllFrames(page, 3, 'div');
  const error = await page.anyFrame().locator('div').evaluate(e => e.textContent, undefined, { timeout: 3000 }).catch(e => e);
  expect(error.message).toContain('anyFrame() matched elements in multiple frames');
});

it('should time out on evaluate when there are no matches', async ({ page, server }) => {
  await routePage(page, 'empty.html', `<iframe src="a.html"></iframe>`);
  await routePage(page, 'a.html', `<div>Nothing here</div>`);
  await page.goto(server.EMPTY_PAGE);
  const error = await page.anyFrame().locator('button').evaluate(e => e.textContent, undefined, { timeout: 1000 }).catch(e => e);
  expect(error.message).toContain('Timeout 1000ms exceeded');
  expect(error.message).toContain(`waiting for anyFrame().locator('button')`);
});

it('should support evaluateAll', async ({ page, server }) => {
  await routePage(page, 'empty.html', `<iframe src="a.html"></iframe>`);
  await routePage(page, 'a.html', `<span>one</span><span>two</span>`);
  await page.goto(server.EMPTY_PAGE);
  await waitForAllFrames(page, 2, 'span');
  expect(await page.anyFrame().locator('span').evaluateAll(els => els.map(e => e.textContent))).toEqual(['one', 'two']);
  expect(await page.anyFrame().locator('button').evaluateAll(els => els.length)).toBe(0);
});

it('should fail evaluateAll when elements match in multiple frames', async ({ page, server }) => {
  await routePage(page, 'empty.html', `<iframe src="a.html"></iframe><iframe src="b.html"></iframe>`);
  await routePage(page, 'a.html', `<span>one</span>`);
  await routePage(page, 'b.html', `<span>two</span>`);
  await page.goto(server.EMPTY_PAGE);
  await waitForAllFrames(page, 3, 'span');
  const error = await page.anyFrame().locator('span').evaluateAll(els => els.length).catch(e => e);
  expect(error.message).toContain('anyFrame() matched elements in multiple frames');
});

it('should support hasText filter', async ({ page, server }) => {
  await routePage(page, 'empty.html', `<iframe src="a.html"></iframe>`);
  await routePage(page, 'a.html', `<div>foo</div><div>bar</div>`);
  await page.goto(server.EMPTY_PAGE);
  await expect(page.anyFrame().locator('div', { hasText: 'bar' })).toHaveText('bar');
});

it('should support first/last/nth', async ({ page, server }) => {
  await routePage(page, 'empty.html', `<iframe src="a.html"></iframe>`);
  await routePage(page, 'a.html', `<span>one</span><span>two</span><span>three</span>`);
  await page.goto(server.EMPTY_PAGE);
  await waitForAllFrames(page, 2, 'span');
  await expect(page.anyFrame().locator('span').first()).toHaveText('one');
  await expect(page.anyFrame().locator('span').last()).toHaveText('three');
  await expect(page.anyFrame().locator('span').nth(1)).toHaveText('two');
});

it('should support nth in the middle of the chain', async ({ page, server }) => {
  await routePage(page, 'empty.html', `<iframe src="a.html"></iframe>`);
  await routePage(page, 'a.html', `<div><span>one</span></div><div><span>two</span></div>`);
  await page.goto(server.EMPTY_PAGE);
  await expect(page.anyFrame().locator('div').nth(1).locator('span')).toHaveText('two');
});

it('should support composite locators', async ({ page, server }) => {
  await routePage(page, 'empty.html', `<iframe src="a.html"></iframe>`);
  await routePage(page, 'a.html', `<div><span>foo</span></div><div><i>bar</i></div>`);
  await page.goto(server.EMPTY_PAGE);
  await expect(page.anyFrame().locator('div', { has: page.locator('span') })).toHaveText('foo');
});

it('should support capture', async ({ page, server }) => {
  await routePage(page, 'empty.html', `<iframe src="a.html"></iframe>`);
  await routePage(page, 'a.html', `<div id="target"><span>hello</span></div>`);
  await page.goto(server.EMPTY_PAGE);
  await expect(page.anyFrame().locator('*css=div >> span')).toHaveAttribute('id', 'target');
});

it('should find a frame inside the scope', async ({ page, server }) => {
  await routePage(page, 'empty.html', `<section><iframe src="a.html"></iframe></section><button>outside</button>`);
  await routePage(page, 'a.html', `<button>inside</button>`);
  await page.goto(server.EMPTY_PAGE);
  await waitForAllFrames(page, 2, 'button');
  const scope = (await page.$('section'))!;
  const buttons = await scope.$$('internal:control=any-frame >> button');
  expect(buttons.length).toBe(1);
  expect(await buttons[0].textContent()).toBe('inside');
});

it('should find a nested frame inside the scope', async ({ page, server }) => {
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
  const buttons = await scope.$$('internal:control=any-frame >> button');
  expect(buttons.length).toBe(1);
  expect(await buttons[0].textContent()).toBe('deep');
});

it('should find a frame inside the scope while another iframe is stalled', async ({ page, server }) => {
  await routePage(page, 'empty.html', `<section><iframe src="a.html"></iframe><iframe src="stall.html"></iframe></section>`);
  await routePage(page, 'a.html', `<button>inside</button>`);
  await page.route('**/stall.html', () => {});
  await page.goto(server.EMPTY_PAGE, { waitUntil: 'domcontentloaded' });
  await expect.poll(() => page.frames().length).toBe(3);
  const scope = (await page.$('section'))!;
  const buttons = await scope.$$('internal:control=any-frame >> button');
  expect(buttons.length).toBe(1);
  expect(await buttons[0].textContent()).toBe('inside');
});

it('should respect the scope without a frame inside the scope', async ({ page, server }) => {
  await routePage(page, 'empty.html', `<section><button>target</button></section><iframe src="a.html"></iframe>`);
  await routePage(page, 'a.html', `<button>in-frame</button>`);
  await page.goto(server.EMPTY_PAGE);
  await waitForAllFrames(page, 2, 'button');
  const scope = (await page.$('section'))!;
  const buttons = await scope.$$('internal:control=any-frame >> button');
  expect(buttons.length).toBe(1);
  expect(await buttons[0].textContent()).toBe('target');
});

it('should not match a chain across a frame boundary', async ({ page, server }) => {
  await routePage(page, 'empty.html', `<section><iframe src="a.html"></iframe></section>`);
  await routePage(page, 'a.html', `<iframe src="b.html"></iframe>`);
  await routePage(page, 'b.html', `<button>deep</button>`);
  await page.goto(server.EMPTY_PAGE);
  await expect.poll(() => page.frames().length).toBe(3);
  const deepFrame = page.frames().find(f => f.url().includes('b.html'))!;
  await deepFrame.waitForSelector('button', { state: 'attached' });
  // "section" lives in the main frame, while the button is two frames below it.
  await expect(page.anyFrame().locator('section').locator('button')).toHaveCount(0);
  await expect(page.anyFrame().locator('button')).toHaveText('deep');
});

it('should only search frames inside the starting frame', async ({ page, server }) => {
  await routePage(page, 'empty.html', `<iframe src="a.html"></iframe><button>main</button>`);
  await routePage(page, 'a.html', `<iframe src="b.html"></iframe>`);
  await routePage(page, 'b.html', `<button>deep</button>`);
  await page.goto(server.EMPTY_PAGE);
  await expect.poll(() => page.frames().length).toBe(3);
  const deepFrame = page.frames().find(f => f.url().includes('b.html'))!;
  await deepFrame.waitForSelector('button', { state: 'attached' });
  const middleFrame = page.frames().find(f => f.url().includes('a.html'))!;
  await expect(middleFrame.anyFrame().locator('button')).toHaveText('deep');
});

it('should enter a frame found in a nested frame', async ({ page, server }) => {
  await routePage(page, 'empty.html', `<iframe src="a.html"></iframe><button>main</button>`);
  await routePage(page, 'a.html', `<iframe id="target" src="b.html"></iframe><button>decoy</button>`);
  await routePage(page, 'b.html', `<button>inside</button>`);
  await page.goto(server.EMPTY_PAGE);
  await expect(page.anyFrame().frameLocator('#target').locator('button')).toHaveText('inside');
});

it('should click inside an entered frame', async ({ page, server }) => {
  await routePage(page, 'empty.html', `<iframe src="a.html"></iframe>`);
  await routePage(page, 'a.html', `<iframe id="target" src="b.html"></iframe><button>Click me</button>`);
  await routePage(page, 'b.html', `<button onclick="window.__clicked = true">Click me</button>`);
  await page.goto(server.EMPTY_PAGE);
  await page.anyFrame().frameLocator('#target').getByRole('button', { name: 'Click me' }).click();
  const frame = page.frames().find(f => f.url().includes('b.html'))!;
  expect(await frame.evaluate(() => (window as any).__clicked)).toBe(true);
});

it('should not search nested frames after entering a frame', async ({ page, server }) => {
  await routePage(page, 'empty.html', `<iframe id="target" src="a.html"></iframe><button>main</button>`);
  await routePage(page, 'a.html', `<iframe src="b.html"></iframe>`);
  await routePage(page, 'b.html', `<button>deep</button>`);
  await page.goto(server.EMPTY_PAGE);
  await expect.poll(() => page.frames().length).toBe(3);
  // The entered frame itself has no button, and we do not look inside its nested frames.
  await expect(page.anyFrame().frameLocator('#target').locator('button')).toHaveCount(0);
});

it('should support two frameLocators', async ({ page, server }) => {
  await routePage(page, 'empty.html', `<iframe src="a.html"></iframe>`);
  await routePage(page, 'a.html', `<iframe id="x" src="b.html"></iframe>`);
  await routePage(page, 'b.html', `<iframe id="y" src="c.html"></iframe><button>decoy</button>`);
  await routePage(page, 'c.html', `<button>bottom</button>`);
  await page.goto(server.EMPTY_PAGE);
  await expect(page.anyFrame().frameLocator('#x').frameLocator('#y').locator('button')).toHaveText('bottom');
});

it('should support locator before frameLocator', async ({ page, server }) => {
  await routePage(page, 'empty.html', `<iframe src="a.html"></iframe>`);
  await routePage(page, 'a.html', `<section><iframe src="b.html"></iframe></section><iframe src="c.html"></iframe>`);
  await routePage(page, 'b.html', `<button>in-section</button>`);
  await routePage(page, 'c.html', `<button>outside</button>`);
  await page.goto(server.EMPTY_PAGE);
  await expect(page.anyFrame().locator('section').frameLocator('iframe').locator('button')).toHaveText('in-section');
});

it('should support owner of a frameLocator', async ({ page, server }) => {
  await routePage(page, 'empty.html', `<iframe src="a.html"></iframe>`);
  await routePage(page, 'a.html', `<iframe id="target" src="b.html"></iframe>`);
  await routePage(page, 'b.html', `<button>inside</button>`);
  await page.goto(server.EMPTY_PAGE);
  expect(await page.anyFrame().frameLocator('#target').owner().getAttribute('id')).toBe('target');
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
  await expect(page.anyFrame().frameLocator('#late').locator('button')).toHaveText('late');
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
  const error = await page.anyFrame().frameLocator('.inner').locator('button').click({ timeout: 3000 }).catch(e => e);
  expect(error.message).toContain('anyFrame() matched elements in multiple frames');
});

it('should support contentFrame', async ({ page, server }) => {
  await routePage(page, 'empty.html', `<iframe src="a.html"></iframe>`);
  await routePage(page, 'a.html', `<iframe id="target" src="b.html"></iframe><button>decoy</button>`);
  await routePage(page, 'b.html', `<button>inside</button>`);
  await page.goto(server.EMPTY_PAGE);
  await expect(page.anyFrame().locator('#target').contentFrame().locator('button')).toHaveText('inside');
});

it('should render anyFrame in the locator description', async ({ page }) => {
  expect(String(page.anyFrame().frameLocator('#x').locator('button'))).toBe(`anyFrame().locator('#x').contentFrame().locator('button')`);
  expect(String(page.anyFrame().locator('section').frameLocator('iframe').getByText('foo'))).toBe(`anyFrame().locator('section').locator('iframe').contentFrame().getByText('foo')`);
});

it('should not allow anyFrame inside a composite locator', async ({ page, server }) => {
  await routePage(page, 'empty.html', `<button>main</button><iframe src="a.html"></iframe>`);
  await routePage(page, 'a.html', `<a href="#">link</a>`);
  await page.goto(server.EMPTY_PAGE);
  await waitForAllFrames(page, 2, 'a');

  const error = await page.locator('button').or(page.anyFrame().locator('a')).count().catch(e => e);
  expect(error.message).toContain(`anyFrame() is not allowed inside composite locators, while querying "locator('button').or(anyFrame().locator('a'))"`);

  const error2 = await page.locator('button').filter({ has: page.anyFrame().locator('a') }).count().catch(e => e);
  expect(error2.message).toContain(`anyFrame() is not allowed inside composite locators`);

  // Repeating anyFrame() in the operand is not allowed either, even though the outer locator has it.
  const error3 = await page.anyFrame().locator('button').or(page.anyFrame().locator('a')).count().catch(e => e);
  expect(error3.message).toContain(`anyFrame() is not allowed inside composite locators, while querying "anyFrame().locator('button').or(anyFrame().locator('a'))"`);

  // Repeating anyFrame() is not allowed even when the rest of the frame chain matches.
  const error4 = await page.anyFrame().frameLocator('#f').locator('a').or(page.anyFrame().frameLocator('#f').locator('button')).count().catch(e => e);
  expect(error4.message).toContain(`anyFrame() is not allowed inside composite locators`);

  // With anyFrame() first, the token applies to the whole locator, so both operands are searched in every frame.
  const error5 = await page.anyFrame().locator('a').or(page.locator('button')).count().catch(e => e);
  expect(error5.message).toContain(`anyFrame() matched elements in multiple frames`);
});

it('should support a composite locator under anyFrame', async ({ page, server }) => {
  await routePage(page, 'empty.html', `<iframe src="a.html"></iframe>`);
  await routePage(page, 'a.html', `<div class="classname">first</div><button>second</button>`);
  await page.goto(server.EMPTY_PAGE);
  await waitForAllFrames(page, 2, 'button');
  await expect(page.anyFrame().locator('.classname').or(page.getByRole('button'))).toHaveText(['first', 'second']);
});

it('should support a composite locator under anyFrame and a frame locator', async ({ page, server }) => {
  await routePage(page, 'empty.html', `<iframe src="a.html"></iframe>`);
  await routePage(page, 'a.html', `<iframe id="f" src="b.html"></iframe>`);
  await routePage(page, 'b.html', `<div class="classname">first</div><button>second</button>`);
  await page.goto(server.EMPTY_PAGE);
  await expect.poll(() => page.frames().length).toBe(3);
  await expect(page.anyFrame().frameLocator('#f').locator('.classname').or(page.frameLocator('#f').getByRole('button'))).toHaveText(['first', 'second']);
});

it('should not allow first/last/nth on anyFrame', async ({ page }) => {
  expect(() => page.anyFrame().first()).toThrow('Selecting the nth frame is not allowed on anyFrame()');
  expect(() => page.anyFrame().last()).toThrow('Selecting the nth frame is not allowed on anyFrame()');
  expect(() => page.anyFrame().nth(1)).toThrow('Selecting the nth frame is not allowed on anyFrame()');
});

it('should not allow owner on anyFrame', async ({ page }) => {
  const error = await page.anyFrame().owner().count().catch(e => e);
  expect(error.message).toContain('Selector cannot be empty after anyFrame()');
});

it('should resolve aria-ref selectors', async ({ page, server }) => {
  await routePage(page, 'empty.html', `<button>main</button><iframe src="a.html"></iframe>`);
  await routePage(page, 'a.html', `<button>inside</button>`);
  await page.goto(server.EMPTY_PAGE);
  await waitForAllFrames(page, 2, 'button');
  const snapshot = await page.ariaSnapshot({ mode: 'ai' });
  // Refs are unique across frames, so every starting frame resolves them to the same element.
  const insideMatch = snapshot.match(/button "inside" \[ref=(.*?)\]/);
  expect(insideMatch![1]).toMatch(/^f\d+e\d+$/);
  await expect(page.anyFrame().locator(`aria-ref=${insideMatch![1]}`)).toHaveText('inside');
});

it('should click while another iframe is stalled', async ({ page, server }) => {
  await routePage(page, 'empty.html', `<iframe src="a.html"></iframe><iframe src="stall.html"></iframe>`);
  await routePage(page, 'a.html', `<button onclick="window.__clicked = true">Click me</button>`);
  await page.route('**/stall.html', () => {});
  await page.goto(server.EMPTY_PAGE, { waitUntil: 'domcontentloaded' });
  await expect.poll(() => page.frames().length).toBe(3);
  await page.anyFrame().locator('button').click();
  const frame = page.frames().find(f => f.url().includes('a.html'))!;
  expect(await frame.evaluate(() => (window as any).__clicked)).toBe(true);
});

it('should support toBeVisible while another iframe is stalled', async ({ page, server }) => {
  await routePage(page, 'empty.html', `<iframe src="a.html"></iframe><iframe src="stall.html"></iframe>`);
  await routePage(page, 'a.html', `<button>Click me</button>`);
  await page.route('**/stall.html', () => {});
  await page.goto(server.EMPTY_PAGE, { waitUntil: 'domcontentloaded' });
  await expect.poll(() => page.frames().length).toBe(3);
  await expect(page.anyFrame().locator('button')).toBeVisible();
});

it('should support toHaveCount while another iframe is stalled', async ({ page, server }) => {
  await routePage(page, 'empty.html', `<iframe src="a.html"></iframe><iframe src="stall.html"></iframe>`);
  await routePage(page, 'a.html', `<button>Click me</button>`);
  await page.route('**/stall.html', () => {});
  await page.goto(server.EMPTY_PAGE, { waitUntil: 'domcontentloaded' });
  await expect.poll(() => page.frames().length).toBe(3);
  await expect(page.anyFrame().locator('button')).toHaveCount(1);
});
