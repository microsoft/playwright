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

import type { Frame } from '@playwright/test';
import { test as it, expect, rafraf } from './pageTest';
import { attachFrame, detachFrame } from '../config/utils';

async function giveItTimeToLog(frame: Frame) {
  await rafraf(frame, 2);
}

const addElement = (tag: string) => document.body.appendChild(document.createElement(tag));

it('should throw on waitFor', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  let error;
  // @ts-expect-error waitFor is undocumented
  await page.waitForSelector('*', { waitFor: 'attached' }).catch(e => error = e);
  expect(error!.message).toContain('options.waitFor is not supported, did you mean options.state?');
});

it('should tolerate waitFor=visible', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  let error = false;
  // @ts-expect-error waitFor is undocumented
  await page.waitForSelector('*', { waitFor: 'visible' }).catch(() => error = true);
  expect(error).toBe(false);
});

it('should immediately resolve promise if node exists', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  const frame = page.mainFrame();
  await frame.waitForSelector('*');
  await frame.evaluate(addElement, 'div');
  await frame.waitForSelector('div', { state: 'attached' });
});

it('elementHandle.waitForSelector should immediately resolve if node exists', async ({ page }) => {
  await page.setContent(`<span>extra</span><div><span>target</span></div>`);
  const div = (await page.$('div'))!;
  const span = await div.waitForSelector('span', { state: 'attached' });
  expect(await span.evaluate(e => e.textContent)).toBe('target');
});

it('elementHandle.waitForSelector should wait', async ({ page }) => {
  await page.setContent(`<div></div>`);
  const div = (await page.$('div'))!;
  const promise = div.waitForSelector('span', { state: 'attached' });
  await div.evaluate(div => div.innerHTML = '<span>target</span>');
  const span = await promise;
  expect(await span.evaluate(e => e.textContent)).toBe('target');
});

it('elementHandle.waitForSelector should timeout', async ({ page }) => {
  await page.setContent(`<div></div>`);
  const div = (await page.$('div'))!;
  const error = await div.waitForSelector('span', { timeout: 100 }).catch(e => e);
  expect(error.message).toContain('Timeout 100ms exceeded.');
});

it('elementHandle.waitForSelector should throw on navigation', async ({ page, server }) => {
  await page.setContent(`<div></div>`);
  const div = (await page.$('div'))!;
  const promise = div.waitForSelector('span').catch(e => e);
  // Give it some time before navigating.
  for (let i = 0; i < 10; i++)
    await page.evaluate(() => 1);
  await page.goto(server.EMPTY_PAGE);
  const error = await promise;
  expect(error.message).toContain(`waiting for locator('span') to be visible`);
});

it('should work with removed MutationObserver', async ({ page }) => {
  await page.evaluate(() => delete (window as any).MutationObserver);
  const [handle] = await Promise.all([
    page.waitForSelector('.zombo'),
    page.setContent(`<div class='zombo'>anything</div>`),
  ]);
  expect(await page.evaluate(x => x.textContent, handle)).toBe('anything');
});

it('should resolve promise when node is added', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  const frame = page.mainFrame();
  const watchdog = frame.waitForSelector('div', { state: 'attached' });
  await frame.evaluate(addElement, 'br');
  await frame.evaluate(addElement, 'div');
  const eHandle = await watchdog;
  const tagName = await eHandle.getProperty('tagName').then(e => e.jsonValue());
  expect(tagName).toBe('DIV');
});

it('should report logs while waiting for visible', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  const frame = page.mainFrame();
  const watchdog = frame.waitForSelector('div', { timeout: 5000 });

  await frame.evaluate(() => {
    const div = document.createElement('div');
    div.className = 'foo bar';
    div.id = 'mydiv';
    div.setAttribute('style', 'display: none');
    div.setAttribute('foo', '123456789012345678901234567890123456789012345678901234567890');
    div.textContent = 'abcdefghijklmnopqrstuvwyxzabcdefghijklmnopqrstuvwyxzabcdefghijklmnopqrstuvwyxz';
    document.body.appendChild(div);
  });
  await giveItTimeToLog(frame);

  await frame.evaluate(() => document.querySelector('div')!.remove());
  await giveItTimeToLog(frame);

  await frame.evaluate(() => {
    const div = document.createElement('div');
    div.className = 'another';
    div.style.display = 'none';
    document.body.appendChild(div);
  });
  await giveItTimeToLog(frame);

  const error = await watchdog.catch(e => e);
  expect(error.message).toContain(`frame.waitForSelector: Timeout 5000ms exceeded.`);
  expect(error.message).toContain(`waiting for locator(\'div\') to be visible`);
  expect(error.message).toContain(`locator resolved to hidden <div id="mydiv" class="foo bar" foo=\"123456789012345678901234567890123456789012345678901234567890\">abcdefghijklmnopqrstuvwyxzabcdefghijklmnopqrstuvw…</div>`);
  expect(error.message).toContain(`locator resolved to hidden <div class="another"></div>`);
});

it('should report logs while waiting for hidden', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  const frame = page.mainFrame();
  await frame.evaluate(() => {
    const div = document.createElement('div');
    div.className = 'foo bar';
    div.id = 'mydiv';
    div.textContent = 'hello';
    document.body.appendChild(div);
  });

  const watchdog = frame.waitForSelector('div', { state: 'hidden', timeout: 5000 });
  await giveItTimeToLog(frame);

  await frame.evaluate(() => {
    document.querySelector('div')!.remove();
    const div = document.createElement('div');
    div.className = 'another';
    div.textContent = 'hello';
    document.body.appendChild(div);
  });
  await giveItTimeToLog(frame);

  const error = await watchdog.catch(e => e);
  expect(error.message).toContain(`frame.waitForSelector: Timeout 5000ms exceeded.`);
  expect(error.message).toContain(`waiting for locator(\'div\') to be hidden`);
  expect(error.message).toContain(`locator resolved to visible <div id="mydiv" class="foo bar">hello</div>`);
  expect(error.message).toContain(`locator resolved to visible <div class="another">hello</div>`);
});

it('should report logs when the selector resolves to multiple elements', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  await page.setContent(`
    <button style="display: none; position: absolute; top: 0px; left: 0px; width: 100%;">Reset</button>
    <button>Reset</button>
  `);
  const error = await page.click('text=Reset', {
    timeout: 1000
  }).catch(e => e);
  expect(error.toString()).toContain('locator resolved to 2 elements. Proceeding with the first one: <button>Reset</button>');
});

it('should resolve promise when node is added in shadow dom', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  const watchdog = page.waitForSelector('span');
  await page.evaluate(() => {
    const div = document.createElement('div');
    div.attachShadow({ mode: 'open' });
    document.body.appendChild(div);
  });
  await page.waitForTimeout(100);
  await page.evaluate(() => {
    const span = document.createElement('span');
    span.textContent = 'Hello from shadow';
    document.querySelector('div')!.shadowRoot!.appendChild(span);
  });
  const handle = await watchdog;
  expect(await handle.evaluate(e => e.textContent)).toBe('Hello from shadow');
});

it('should work when node is added through innerHTML', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  const watchdog = page.waitForSelector('h3 div', { state: 'attached' });
  await page.evaluate(addElement, 'span');
  await page.evaluate(() => document.querySelector('span')!.innerHTML = '<h3><div></div></h3>');
  await watchdog;
});

it('page.waitForSelector is shortcut for main frame', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  await attachFrame(page, 'frame1', server.EMPTY_PAGE);
  const otherFrame = page.frames()[1];
  const watchdog = page.waitForSelector('div', { state: 'attached' });
  await otherFrame.evaluate(addElement, 'div');
  await page.evaluate(addElement, 'div');
  const eHandle = await watchdog;
  expect(await eHandle.ownerFrame()).toBe(page.mainFrame());
});

it('should run in specified frame', async ({ page, server }) => {
  await attachFrame(page, 'frame1', server.EMPTY_PAGE);
  await attachFrame(page, 'frame2', server.EMPTY_PAGE);
  const frame1 = page.frames()[1];
  const frame2 = page.frames()[2];
  const waitForSelectorPromise = frame2.waitForSelector('div', { state: 'attached' });
  await frame1.evaluate(addElement, 'div');
  await frame2.evaluate(addElement, 'div');
  const eHandle = await waitForSelectorPromise;
  expect(await eHandle.ownerFrame()).toBe(frame2);
});

it('should throw when frame is detached', async ({ page, server }) => {
  await attachFrame(page, 'frame1', server.EMPTY_PAGE);
  const frame = page.frames()[1];
  let waitError = null;
  const waitPromise = frame.waitForSelector('.box').catch(e => waitError = e);
  await detachFrame(page, 'frame1');
  await waitPromise;
  expect(waitError).toBeTruthy();
  expect(waitError!.message).toContain('frame.waitForSelector: Frame was detached');
});
