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

import { test as it, expect } from './pageTest';

it('should dispatch click event @smoke', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/input/button.html');
  await page.dispatchEvent('button', 'click');
  expect(await page.evaluate(() => window['result'])).toBe('Clicked');
});

it('should dispatch click event properties', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/input/button.html');
  await page.dispatchEvent('button', 'click');
  expect(await page.evaluate('bubbles')).toBeTruthy();
  expect(await page.evaluate('cancelable')).toBeTruthy();
  expect(await page.evaluate('composed')).toBeTruthy();
});

it('should dispatch click svg', async ({ page }) => {
  await page.setContent(`
    <svg height="100" width="100">
      <circle onclick="javascript:window.__CLICKED=42" cx="50" cy="50" r="40" stroke="black" stroke-width="3" fill="red" />
    </svg>
  `);
  await page.dispatchEvent('circle', 'click');
  expect(await page.evaluate(() => window['__CLICKED'])).toBe(42);
});

it('should dispatch click on a span with an inline element inside', async ({ page }) => {
  await page.setContent(`
    <style>
    span::before {
      content: 'q';
    }
    </style>
    <span onclick='javascript:window.CLICKED=42'></span>
  `);
  await page.dispatchEvent('span', 'click');
  expect(await page.evaluate(() => window['CLICKED'])).toBe(42);
});

it('should dispatch click after navigation ', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/input/button.html');
  await page.dispatchEvent('button', 'click');
  await page.goto(server.PREFIX + '/input/button.html');
  await page.dispatchEvent('button', 'click');
  expect(await page.evaluate(() => window['result'])).toBe('Clicked');
});

it('should dispatch click after a cross origin navigation ', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/input/button.html');
  await page.dispatchEvent('button', 'click');
  await page.goto(server.CROSS_PROCESS_PREFIX + '/input/button.html');
  await page.dispatchEvent('button', 'click');
  expect(await page.evaluate(() => window['result'])).toBe('Clicked');
});

it('should not fail when element is blocked on hover', async ({ page }) => {
  await page.setContent(`<style>
    container { display: block; position: relative; width: 200px; height: 50px; }
    div, button { position: absolute; left: 0; top: 0; bottom: 0; right: 0; }
    div { pointer-events: none; }
    container:hover div { pointer-events: auto; background: red; }
  </style>
  <container>
    <button onclick="window.clicked=true">Click me</button>
    <div></div>
  </container>`);
  await page.dispatchEvent('button', 'click');
  expect(await page.evaluate(() => window['clicked'])).toBeTruthy();
});

it('should dispatch click when node is added in shadow dom', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  const watchdog = page.dispatchEvent('span', 'click');
  await page.evaluate(() => {
    const div = document.createElement('div');
    div.attachShadow({ mode: 'open' });
    document.body.appendChild(div);
  });
  await page.evaluate(() => new Promise(f => setTimeout(f, 100)));
  await page.evaluate(() => {
    const span = document.createElement('span');
    span.textContent = 'Hello from shadow';
    span.addEventListener('click', () => window['clicked'] = true);
    document.querySelector('div').shadowRoot.appendChild(span);
  });
  await watchdog;
  expect(await page.evaluate(() => window['clicked'])).toBe(true);
});

it('should be atomic', async ({ playwright, page }) => {
  const createDummySelector = () => ({
    query(root, selector) {
      const result = root.querySelector(selector);
      if (result)
        Promise.resolve().then(() => result.onclick = '');
      return result;
    },
    queryAll(root: HTMLElement, selector: string) {
      const result = Array.from(root.querySelectorAll(selector));
      for (const e of result)
        Promise.resolve().then(() => (e as HTMLElement).onclick = null);
      return result;
    }
  });
  await playwright.selectors.register('dispatchEvent', createDummySelector);
  await page.setContent(`<div onclick="window._clicked=true">Hello</div>`);
  await page.dispatchEvent('dispatchEvent=div', 'click');
  expect(await page.evaluate(() => window['_clicked'])).toBe(true);
});

it('should dispatch drag drop events', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/drag-n-drop.html');
  const dataTransfer = await page.evaluateHandle(() => new DataTransfer());
  await page.dispatchEvent('#source', 'dragstart', { dataTransfer });
  await page.dispatchEvent('#target', 'drop', { dataTransfer });
  const source = await page.$('#source');
  const target = await page.$('#target');
  expect(await page.evaluate(({ source, target }) => {
    return source.parentElement === target;
  }, { source, target })).toBeTruthy();
});

it('should dispatch drag drop events via ElementHandles', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/drag-n-drop.html');
  const dataTransfer = await page.evaluateHandle(() => new DataTransfer());
  const source = await page.$('#source');
  await source.dispatchEvent('dragstart', { dataTransfer });
  const target = await page.$('#target');
  await target.dispatchEvent('drop', { dataTransfer });
  expect(await page.evaluate(({ source, target }) => {
    return source.parentElement === target;
  }, { source, target })).toBeTruthy();
});

it('should dispatch click event via ElementHandles', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/input/button.html');
  const button = await page.$('button');
  await button.dispatchEvent('click');
  expect(await page.evaluate(() => window['result'])).toBe('Clicked');
});

it('should dispatch wheel event', async ({ page, server }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/15562' });
  await page.goto(server.PREFIX + '/input/scrollable.html');
  const eventsHandle = await page.locator('body').evaluateHandle(e => {
    const events = [];
    e.addEventListener('wheel', event => {
      events.push(event);
      console.log(event);
    });
    return events;
  });
  await page.locator('body').dispatchEvent('wheel', { deltaX: 100, deltaY: 200 });
  expect(await eventsHandle.evaluate(e => e.length)).toBe(1);
  expect(await eventsHandle.evaluate(e => e[0] instanceof WheelEvent)).toBeTruthy();
  expect(await eventsHandle.evaluate(e => ({ deltaX: e[0].deltaX, deltaY: e[0].deltaY }))).toEqual({ deltaX: 100, deltaY: 200 });
});
