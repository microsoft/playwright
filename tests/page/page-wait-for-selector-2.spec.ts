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
import { attachFrame, detachFrame } from '../config/utils';

const addElement = (tag: string) => document.body.appendChild(document.createElement(tag));

it('should survive cross-process navigation', async ({ page, server }) => {
  let boxFound = false;
  const waitForSelector = page.waitForSelector('.box').then(() => boxFound = true);
  await page.goto(server.EMPTY_PAGE);
  expect(boxFound).toBe(false);
  await page.reload();
  expect(boxFound).toBe(false);
  await page.goto(server.CROSS_PROCESS_PREFIX + '/grid.html');
  await waitForSelector;
  expect(boxFound).toBe(true);
});

it('should wait for visible', async ({ page, server }) => {
  let divFound = false;
  const waitForSelector = page.waitForSelector('div').then(() => divFound = true);
  await page.setContent(`<div style='display: none; visibility: hidden;'>1</div>`);
  expect(divFound).toBe(false);
  await page.evaluate(() => document.querySelector('div')!.style.removeProperty('display'));
  expect(divFound).toBe(false);
  await page.evaluate(() => document.querySelector('div')!.style.removeProperty('visibility'));
  expect(await waitForSelector).toBe(true);
  expect(divFound).toBe(true);
});

it('should not consider visible when zero-sized', async ({ page, server }) => {
  await page.setContent(`<div style='width: 0; height: 0;'>1</div>`);
  let error = await page.waitForSelector('div', { timeout: 1000 }).catch(e => e);
  expect(error.message).toContain('page.waitForSelector: Timeout 1000ms exceeded');
  await page.evaluate(() => document.querySelector('div')!.style.width = '10px');
  error = await page.waitForSelector('div', { timeout: 1000 }).catch(e => e);
  expect(error.message).toContain('page.waitForSelector: Timeout 1000ms exceeded');
  await page.evaluate(() => document.querySelector('div')!.style.height = '10px');
  expect(await page.waitForSelector('div', { timeout: 1000 })).toBeTruthy();
});

it('should wait for visible recursively', async ({ page, server }) => {
  let divVisible = false;
  const waitForSelector = page.waitForSelector('div#inner').then(() => divVisible = true);
  await page.setContent(`<div style='display: none; visibility: hidden;'><div id="inner">hi</div></div>`);
  expect(divVisible).toBe(false);
  await page.evaluate(() => document.querySelector('div')!.style.removeProperty('display'));
  expect(divVisible).toBe(false);
  await page.evaluate(() => document.querySelector('div')!.style.removeProperty('visibility'));
  expect(await waitForSelector).toBe(true);
  expect(divVisible).toBe(true);
});

it('should consider outside of viewport visible', async ({ page }) => {
  await page.setContent(`
    <style>
      .cover {
        position: fixed;
        left: 0;
        top: 0;
        width: 100px;
        height: 100px;
        background-color: red;
        transform: translateX(-200px);
      }
    </style>
    <div class="cover">cover</div>
  `);

  const cover = page.locator('.cover');
  await cover.waitFor({ state: 'visible' });
  await expect(cover).toBeVisible();
});

it('hidden should wait for hidden', async ({ page, server }) => {
  let divHidden = false;
  await page.setContent(`<div style='display: block;'>content</div>`);
  const waitForSelector = page.waitForSelector('div', { state: 'hidden' }).then(() => divHidden = true);
  await page.waitForSelector('div'); // do a round trip
  expect(divHidden).toBe(false);
  await page.evaluate(() => document.querySelector('div')!.style.setProperty('visibility', 'hidden'));
  expect(await waitForSelector).toBe(true);
  expect(divHidden).toBe(true);
});

it('hidden should wait for display: none', async ({ page, server }) => {
  let divHidden = false;
  await page.setContent(`<div style='display: block;'>content</div>`);
  const waitForSelector = page.waitForSelector('div', { state: 'hidden' }).then(() => divHidden = true);
  await page.waitForSelector('div'); // do a round trip
  expect(divHidden).toBe(false);
  await page.evaluate(() => document.querySelector('div')!.style.setProperty('display', 'none'));
  expect(await waitForSelector).toBe(true);
  expect(divHidden).toBe(true);
});

it('hidden should wait for removal', async ({ page, server }) => {
  await page.setContent(`<div>content</div>`);
  let divRemoved = false;
  const waitForSelector = page.waitForSelector('div', { state: 'hidden' }).then(() => divRemoved = true);
  await page.waitForSelector('div'); // do a round trip
  expect(divRemoved).toBe(false);
  await page.evaluate(() => document.querySelector('div')!.remove());
  expect(await waitForSelector).toBe(true);
  expect(divRemoved).toBe(true);
});

it('should return null if waiting to hide non-existing element', async ({ page, server }) => {
  const handle = await page.waitForSelector('non-existing', { state: 'hidden' });
  expect(handle).toBe(null);
});

it('should respect timeout', async ({ page, playwright }) => {
  let error: Error | undefined;
  await page.waitForSelector('div', { timeout: 3000, state: 'attached' }).catch(e => error = e);
  expect(error).toBeTruthy();
  expect(error!.message).toContain('page.waitForSelector: Timeout 3000ms exceeded');
  expect(error!.message).toContain('waiting for locator(\'div\')');
  expect(error).toBeInstanceOf(playwright.errors.TimeoutError);
});

it('should have an error message specifically for awaiting an element to be hidden', async ({ page, server }) => {
  await page.setContent(`<div>content</div>`);
  let error: Error | undefined;
  await page.waitForSelector('div', { state: 'hidden', timeout: 1000 }).catch(e => error = e);
  expect(error).toBeTruthy();
  expect(error!.message).toContain('page.waitForSelector: Timeout 1000ms exceeded');
  expect(error!.message).toContain('waiting for locator(\'div\') to be hidden');
});

it('should respond to node attribute mutation', async ({ page, server }) => {
  let divFound = false;
  const waitForSelector = page.waitForSelector('.zombo', { state: 'attached' }).then(() => divFound = true);
  await page.setContent(`<div class='notZombo'></div>`);
  expect(divFound).toBe(false);
  await page.evaluate(() => document.querySelector('div')!.className = 'zombo');
  expect(await waitForSelector).toBe(true);
});

it('should return the element handle', async ({ page, server }) => {
  const waitForSelector = page.waitForSelector('.zombo');
  await page.setContent(`<div class='zombo'>anything</div>`);
  expect(await page.evaluate(x => x.textContent, await waitForSelector)).toBe('anything');
});

it('should have correct stack trace for timeout', async ({ page, server }) => {
  let error;
  await page.waitForSelector('.zombo', { timeout: 10 }).catch(e => error = e);
  expect(error!.stack).toContain('wait-for-selector');
});

it('should throw for unknown state option', async ({ page, server }) => {
  await page.setContent('<section>test</section>');
  // @ts-expect-error state is not an option of waitForSelector
  const error = await page.waitForSelector('section', { state: 'foo' }).catch(e => e);
  expect(error.message).toContain('state: expected one of (attached|detached|visible|hidden)');
});

it('should throw for visibility option', async ({ page, server }) => {
  await page.setContent('<section>test</section>');
  // @ts-expect-error visibility is not an option of waitForSelector
  const error = await page.waitForSelector('section', { visibility: 'hidden' }).catch(e => e);
  expect(error.message).toContain('options.visibility is not supported, did you mean options.state?');
});

it('should throw for true state option', async ({ page, server }) => {
  await page.setContent('<section>test</section>');
  // @ts-expect-error state is not an option of waitForSelector
  const error = await page.waitForSelector('section', { state: true }).catch(e => e);
  expect(error.message).toContain('state: expected one of (attached|detached|visible|hidden)');
});

it('should throw for false state option', async ({ page, server }) => {
  await page.setContent('<section>test</section>');
  // @ts-expect-error state is not an option of waitForSelector
  const error = await page.waitForSelector('section', { state: false }).catch(e => e);
  expect(error.message).toContain('state: expected one of (attached|detached|visible|hidden)');
});

it('should support >> selector syntax', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  const frame = page.mainFrame();
  const watchdog = frame.waitForSelector('css=div >> css=span', { state: 'attached' });
  await frame.evaluate(addElement, 'br');
  await frame.evaluate(addElement, 'div');
  await frame.evaluate(() => document.querySelector('div')!.appendChild(document.createElement('span')));
  const eHandle = await watchdog;
  const tagName = await eHandle.getProperty('tagName').then(e => e.jsonValue());
  expect(tagName).toBe('SPAN');
});

it('should wait for detached if already detached', async ({ page, server }) => {
  await page.setContent('<section id="testAttribute">43543</section>');
  expect(await page.waitForSelector('css=div', { state: 'detached' })).toBe(null);
});

it('should wait for detached', async ({ page, server }) => {
  await page.setContent('<section id="testAttribute"><div>43543</div></section>');
  let done = false;
  const waitFor = page.waitForSelector('css=div', { state: 'detached' }).then(() => done = true);
  expect(done).toBe(false);
  await page.waitForSelector('css=section');
  expect(done).toBe(false);
  await page.$eval('div', div => div.remove());
  expect(await waitFor).toBe(true);
  expect(done).toBe(true);
});

it('should support some fancy xpath', async ({ page, server }) => {
  await page.setContent(`<p>red herring</p><p>hello  world  </p>`);
  const waitForXPath = page.waitForSelector('//p[normalize-space(.)="hello world"]');
  expect(await page.evaluate(x => x.textContent, await waitForXPath)).toBe('hello  world  ');
});

it('should respect timeout xpath', async ({ page, playwright }) => {
  let error: Error | undefined;
  await page.waitForSelector('//div', { state: 'attached', timeout: 3000 }).catch(e => error = e);
  expect(error).toBeTruthy();
  expect(error!.message).toContain('page.waitForSelector: Timeout 3000ms exceeded');
  expect(error!.message).toContain('waiting for locator(\'//div\')');
  expect(error).toBeInstanceOf(playwright.errors.TimeoutError);
});

it('should run in specified frame xpath', async ({ page, server }) => {
  await attachFrame(page, 'frame1', server.EMPTY_PAGE);
  await attachFrame(page, 'frame2', server.EMPTY_PAGE);
  const frame1 = page.frames()[1];
  const frame2 = page.frames()[2];
  const waitForXPathPromise = frame2.waitForSelector('//div', { state: 'attached' });
  await frame1.evaluate(addElement, 'div');
  await frame2.evaluate(addElement, 'div');
  const eHandle = await waitForXPathPromise;
  expect(await eHandle.ownerFrame()).toBe(frame2);
});

it('should throw when frame is detached xpath', async ({ page, server }) => {
  await attachFrame(page, 'frame1', server.EMPTY_PAGE);
  const frame = page.frames()[1];
  let waitError: Error | undefined;
  const waitPromise = frame.waitForSelector('//*[@class="box"]').catch(e => waitError = e);
  await detachFrame(page, 'frame1');
  await waitPromise;
  expect(waitError).toBeTruthy();
  expect(waitError!.message).toContain('frame.waitForSelector: Frame was detached');
});

it('should return the element handle xpath', async ({ page, server }) => {
  const waitForXPath = page.waitForSelector('//*[@class="zombo"]');
  await page.setContent(`<div class='zombo'>anything</div>`);
  expect(await page.evaluate(x => x.textContent, await waitForXPath)).toBe('anything');
});

it('should allow you to select an element with single slash xpath', async ({ page, server }) => {
  await page.setContent(`<div>some text</div>`);
  const waitForXPath = page.waitForSelector('//html/body/div');
  expect(await page.evaluate(x => x.textContent, await waitForXPath)).toBe('some text');
});

it('should correctly handle hidden shadow host', async ({ page, server }) => {
  await page.setContent(`
    <x-host hidden></x-host>
    <script>
      const host = document.querySelector('x-host');
      const root = host.attachShadow({ mode: 'open' });
      const style = document.createElement('style');
      style.textContent = ':host([hidden]) { display: none; }';
      root.appendChild(style);
      const child = document.createElement('div');
      child.textContent = 'Find me';
      root.appendChild(child);
    </script>
  `);
  expect(await page.textContent('div')).toBe('Find me');
  await page.waitForSelector('div', { state: 'hidden' });
});

it('should work when navigating before node adoption', async ({ page, mode, server }) => {
  it.skip(mode !== 'default');

  await page.goto(server.EMPTY_PAGE);
  await page.setContent(`<div>Hello</div>`);

  let navigatedOnce = false;
  const __testHookBeforeAdoptNode = async () => {
    if (!navigatedOnce) {
      navigatedOnce = true;
      await page.goto(server.PREFIX + '/one-style.html');
    }
  };

  const div = await page.waitForSelector('div', { __testHookBeforeAdoptNode } as any);

  // This text is coming from /one-style.html
  expect(await div.textContent()).toBe('hello, world!');
});

it('should fail when navigating while on handle', async ({ page, mode, server }) => {
  it.skip(mode !== 'default');

  await page.goto(server.EMPTY_PAGE);
  await page.setContent(`<div>Hello</div>`);

  let navigatedOnce = false;
  const __testHookBeforeAdoptNode = async () => {
    if (!navigatedOnce) {
      navigatedOnce = true;
      await page.goto(server.PREFIX + '/one-style.html');
    }
  };

  const body = await page.waitForSelector('body');
  const error = await body.waitForSelector('div', { __testHookBeforeAdoptNode } as any).catch(e => e);
  expect(error.message).toContain(`waiting for locator('div') to be visible`);
});

it('should fail if element handle was detached while waiting', async ({ page, server }) => {
  await page.setContent(`<button>hello</button>`);
  const button = await page.$('button');
  const promise = button.waitForSelector('something').catch(e => e);
  await page.waitForTimeout(100);
  await page.evaluate(() => document.body.innerText = '');
  const error = await promise;
  expect(error.message).toContain('Element is not attached to the DOM');
});

it('should succeed if element handle was detached while waiting for hidden', async ({ page, server }) => {
  await page.setContent(`<button>hello</button>`);
  const button = await page.$('button');
  const promise = button.waitForSelector('something', { state: 'hidden' });
  await page.waitForTimeout(100);
  await page.evaluate(() => document.body.innerText = '');
  await promise;
});

it('should succeed if element handle was detached while waiting for detached', async ({ page, server }) => {
  await page.setContent(`<button>hello</button>`);
  const button = await page.$('button');
  const promise = button.waitForSelector('something', { state: 'detached' });
  await page.waitForTimeout(100);
  await page.evaluate(() => document.body.innerText = '');
  await promise;
});
