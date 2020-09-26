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

import { it, expect, xdescribe } from './fixtures';

function dimensions() {
  const rect = document.querySelector('textarea').getBoundingClientRect();
  return {
    x: rect.left,
    y: rect.top,
    width: rect.width,
    height: rect.height
  };
}

it('should click the document', (test, { browserName, platform }) => {
  test.flaky(browserName === 'firefox' && platform === 'win32', 'Occasionally times out on options.FIREFOX on Windows: https://github.com/microsoft/playwright/pull/1911/checks?check_run_id=607149016');
}, async ({page, server}) => {
  await page.evaluate(() => {
    window['clickPromise'] = new Promise(resolve => {
      document.addEventListener('click', event => {
        resolve({
          type: event.type,
          detail: event.detail,
          clientX: event.clientX,
          clientY: event.clientY,
          isTrusted: event.isTrusted,
          button: event.button
        });
      });
    });
  });
  await page.mouse.click(50, 60);
  const event = await page.evaluate(() => window['clickPromise']);
  expect(event.type).toBe('click');
  expect(event.detail).toBe(1);
  expect(event.clientX).toBe(50);
  expect(event.clientY).toBe(60);
  expect(event.isTrusted).toBe(true);
  expect(event.button).toBe(0);
});

it('should dblclick the div', async ({page, server}) => {
  await page.setContent(`<div style='width: 100px; height: 100px;'>Click me</div>`);
  await page.evaluate(() => {
    window['dblclickPromise'] = new Promise(resolve => {
      document.querySelector('div').addEventListener('dblclick', event => {
        resolve({
          type: event.type,
          detail: event.detail,
          clientX: event.clientX,
          clientY: event.clientY,
          isTrusted: event.isTrusted,
          button: event.button,
        });
      });
    });
  });
  await page.mouse.dblclick(50, 60);
  const event = await page.evaluate(() => window['dblclickPromise']);
  expect(event.type).toBe('dblclick');
  expect(event.detail).toBe(2);
  expect(event.clientX).toBe(50);
  expect(event.clientY).toBe(60);
  expect(event.isTrusted).toBe(true);
  expect(event.button).toBe(0);
});

it('should select the text with mouse', async ({page, server}) => {
  await page.goto(server.PREFIX + '/input/textarea.html');
  await page.focus('textarea');
  const text = 'This is the text that we are going to try to select. Let\'s see how it goes.';
  await page.keyboard.type(text);
  // Firefox needs an extra frame here after typing or it will fail to set the scrollTop
  await page.evaluate(() => new Promise(requestAnimationFrame));
  await page.evaluate(() => document.querySelector('textarea').scrollTop = 0);
  const {x, y} = await page.evaluate(dimensions);
  await page.mouse.move(x + 2,y + 2);
  await page.mouse.down();
  await page.mouse.move(200,200);
  await page.mouse.up();
  expect(await page.evaluate(() => {
    const textarea = document.querySelector('textarea');
    return textarea.value.substring(textarea.selectionStart, textarea.selectionEnd);
  })).toBe(text);
});

it('should trigger hover state', async ({page, server}) => {
  await page.goto(server.PREFIX + '/input/scrollable.html');
  await page.hover('#button-6');
  expect(await page.evaluate(() => document.querySelector('button:hover').id)).toBe('button-6');
  await page.hover('#button-2');
  expect(await page.evaluate(() => document.querySelector('button:hover').id)).toBe('button-2');
  await page.hover('#button-91');
  expect(await page.evaluate(() => document.querySelector('button:hover').id)).toBe('button-91');
});

it('should trigger hover state on disabled button', async ({page, server}) => {
  await page.goto(server.PREFIX + '/input/scrollable.html');
  await page.$eval('#button-6', (button: HTMLButtonElement) => button.disabled = true);
  await page.hover('#button-6', { timeout: 5000 });
  expect(await page.evaluate(() => document.querySelector('button:hover').id)).toBe('button-6');
});

it('should trigger hover state with removed window.Node', async ({page, server}) => {
  await page.goto(server.PREFIX + '/input/scrollable.html');
  await page.evaluate(() => delete window.Node);
  await page.hover('#button-6');
  expect(await page.evaluate(() => document.querySelector('button:hover').id)).toBe('button-6');
});

it('should set modifier keys on click', async ({page, server, isFirefox, isMac}) => {
  await page.goto(server.PREFIX + '/input/scrollable.html');
  await page.evaluate(() => document.querySelector('#button-3').addEventListener('mousedown', e => window['lastEvent'] = e, true));
  const modifiers = {'Shift': 'shiftKey', 'Control': 'ctrlKey', 'Alt': 'altKey', 'Meta': 'metaKey'};
  // In Firefox, the Meta modifier only exists on Mac
  if (isFirefox && !isMac)
    delete modifiers['Meta'];
  for (const modifier in modifiers) {
    await page.keyboard.down(modifier);
    await page.click('#button-3');
    if (!(await page.evaluate(mod => window['lastEvent'][mod], modifiers[modifier])))
      throw new Error(modifiers[modifier] + ' should be true');
    await page.keyboard.up(modifier);
  }
  await page.click('#button-3');
  for (const modifier in modifiers) {
    if ((await page.evaluate(mod => window['lastEvent'][mod], modifiers[modifier])))
      throw new Error(modifiers[modifier] + ' should be false');
  }
});

it('should tween mouse movement', async ({page, isWebKit}) => {
  // The test becomes flaky on WebKit without next line.
  if (isWebKit)
    await page.evaluate(() => new Promise(requestAnimationFrame));
  await page.mouse.move(100, 100);
  await page.evaluate(() => {
    window['result'] = [];
    document.addEventListener('mousemove', event => {
      window['result'].push([event.clientX, event.clientY]);
    });
  });
  await page.mouse.move(200, 300, {steps: 5});
  expect(await page.evaluate('result')).toEqual([
    [120, 140],
    [140, 180],
    [160, 220],
    [180, 260],
    [200, 300]
  ]);
});

it('should work with mobile viewports and cross process navigations', (test, { browserName }) => {
  test.skip(browserName === 'firefox');
}, async ({browser, server}) => {
  // @see https://crbug.com/929806
  const context = await browser.newContext({ viewport: {width: 360, height: 640}, isMobile: true });
  const page = await context.newPage();
  await page.goto(server.EMPTY_PAGE);
  await page.goto(server.CROSS_PROCESS_PREFIX + '/mobile.html');
  await page.evaluate(() => {
    document.addEventListener('click', event => {
      window['result'] = {x: event.clientX, y: event.clientY};
    });
  });

  await page.mouse.click(30, 40);

  expect(await page.evaluate('result')).toEqual({x: 30, y: 40});
  await context.close();
});

xdescribe('Drag and Drop', function() {
  it('should work', async ({server, page}) => {
    await page.goto(server.PREFIX + '/drag-n-drop.html');
    await page.hover('#source');
    await page.mouse.down();
    await page.hover('#target');
    await page.mouse.up();
    expect(await page.$eval('#target', target => target.contains(document.querySelector('#source')))).toBe(true); // could not find source in target
  });
});
