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

declare const renderComponent;
declare const e;
declare const MyButton;

it('should report that selector does not match anymore', async ({ page, server }) => {
  it.fixme();

  await page.goto(server.PREFIX + '/react.html');
  await page.evaluate(() => {
    renderComponent(e('div', {}, [e(MyButton, { name: 'button1' }), e(MyButton, { name: 'button2' })]));
  });
  const __testHookAfterStable = () => page.evaluate(() => {
    window['counter'] = (window['counter'] || 0) + 1;
    if (window['counter'] === 1)
      renderComponent(e('div', {}, [e(MyButton, { name: 'button2' }), e(MyButton, { name: 'button1' })]));
    else
      renderComponent(e('div', {}, []));
  });
  const error = await page.dblclick('text=button1', { __testHookAfterStable, timeout: 3000 } as any).catch(e => e);
  expect(await page.evaluate('window.button1')).toBe(undefined);
  expect(await page.evaluate('window.button2')).toBe(undefined);
  expect(error.message).toContain('page.dblclick: Timeout 3000ms exceeded.');
  expect(error.message).toContain('element does not match the selector anymore');
});

it('should not retarget the handle when element is recycled', async ({ page, server }) => {
  it.fixme();

  await page.goto(server.PREFIX + '/react.html');
  await page.evaluate(() => {
    renderComponent(e('div', {}, [e(MyButton, { name: 'button1' }), e(MyButton, { name: 'button2', disabled: true })]));
  });
  const __testHookBeforeStable = () => page.evaluate(() => {
    window['counter'] = (window['counter'] || 0) + 1;
    if (window['counter'] === 1)
      renderComponent(e('div', {}, [e(MyButton, { name: 'button2', disabled: true }), e(MyButton, { name: 'button1' })]));
  });
  const handle = await page.$('text=button1');
  const error = await handle.click({ __testHookBeforeStable, timeout: 3000 } as any).catch(e => e);
  expect(await page.evaluate('window.button1')).toBe(undefined);
  expect(await page.evaluate('window.button2')).toBe(undefined);
  expect(error.message).toContain('elementHandle.click: Timeout 3000ms exceeded.');
  expect(error.message).toContain('element is disabled - waiting');
});

it('should timeout when click opens alert', async ({ page, server }) => {
  const dialogPromise = page.waitForEvent('dialog');
  await page.setContent(`<div onclick='window.alert(123)'>Click me</div>`);
  const error = await page.click('div', { timeout: 3000 }).catch(e => e);
  expect(error.message).toContain('page.click: Timeout 3000ms exceeded.');
  const dialog = await dialogPromise;
  await dialog.dismiss();
});

it('should retarget when element is recycled during hit testing', async ({ page, server }) => {
  it.fixme();

  await page.goto(server.PREFIX + '/react.html');
  await page.evaluate(() => {
    renderComponent(e('div', {}, [e(MyButton, { name: 'button1' }), e(MyButton, { name: 'button2' })]));
  });
  const __testHookAfterStable = () => page.evaluate(() => {
    window['counter'] = (window['counter'] || 0) + 1;
    if (window['counter'] === 1)
      renderComponent(e('div', {}, [e(MyButton, { name: 'button2' }), e(MyButton, { name: 'button1' })]));
  });
  await page.click('text=button1', { __testHookAfterStable } as any);
  expect(await page.evaluate('window.button1')).toBe(true);
  expect(await page.evaluate('window.button2')).toBe(undefined);
});

it('should retarget when element is recycled before enabled check', async ({ page, server }) => {
  it.fixme();

  await page.goto(server.PREFIX + '/react.html');
  await page.evaluate(() => {
    renderComponent(e('div', {}, [e(MyButton, { name: 'button1' }), e(MyButton, { name: 'button2', disabled: true })]));
  });
  const __testHookBeforeStable = () => page.evaluate(() => {
    window['counter'] = (window['counter'] || 0) + 1;
    if (window['counter'] === 1)
      renderComponent(e('div', {}, [e(MyButton, { name: 'button2', disabled: true }), e(MyButton, { name: 'button1' })]));
  });
  await page.click('text=button1', { __testHookBeforeStable } as any);
  expect(await page.evaluate('window.button1')).toBe(true);
  expect(await page.evaluate('window.button2')).toBe(undefined);
});

it('should not retarget when element changes on hover', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/react.html');
  await page.evaluate(() => {
    renderComponent(e('div', {}, [e(MyButton, { name: 'button1', renameOnHover: true }), e(MyButton, { name: 'button2' })]));
  });
  await page.click('text=button1');
  expect(await page.evaluate('window.button1')).toBe(true);
  expect(await page.evaluate('window.button2')).toBe(undefined);
});

it('should not retarget when element is recycled on hover', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/react.html');
  await page.evaluate(() => {
    function shuffle() {
      renderComponent(e('div', {}, [e(MyButton, { name: 'button2' }), e(MyButton, { name: 'button1' })]));
    }
    renderComponent(e('div', {}, [e(MyButton, { name: 'button1', onHover: shuffle }), e(MyButton, { name: 'button2' })]));
  });
  await page.click('text=button1');
  expect(await page.evaluate('window.button1')).toBe(undefined);
  expect(await page.evaluate('window.button2')).toBe(true);
});
