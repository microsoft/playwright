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

function dimensions() {
  const rect = document.querySelector('textarea').getBoundingClientRect();
  return {
    x: rect.left,
    y: rect.top,
    width: rect.width,
    height: rect.height
  };
}

it('should click the document @smoke', async ({ page, server }) => {
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

it('should dblclick the div', async ({ page, server }) => {
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

it('should pointerdown the div with a custom button', async ({ page, server, browserName }) => {
  await page.setContent(`<div style='width: 100px; height: 100px;'>Click me</div>`);
  await page.evaluate(() => {
    window['pointerdownPromise'] = new Promise(resolve => {
      document.querySelector('div').addEventListener('pointerdown', event => {
        resolve({
          type: event.type,
          detail: event.detail,
          clientX: event.clientX,
          clientY: event.clientY,
          isTrusted: event.isTrusted,
          button: event.button,
          buttons: event.buttons,
          pointerId: event.pointerId,
        });
      });
    });
  });
  await page.mouse.click(50, 60, {
    button: 'middle'
  });
  const event = await page.evaluate(() => window['pointerdownPromise']);
  expect(event.type).toBe('pointerdown');
  expect(event.detail).toBe(browserName === 'webkit' ? 1 : 0);
  expect(event.clientX).toBe(50);
  expect(event.clientY).toBe(60);
  expect(event.isTrusted).toBe(true);
  expect(event.button).toBe(1);
  expect(event.buttons).toBe(4);
  expect(event.pointerId).toBe(browserName === 'firefox' ? 0 : 1);
});

it('should report correct buttons property', async ({ page }) => {
  await page.evaluate(() => {
    (window as any).__EVENTS = [];
    const handler = event => {
      (window as any).__EVENTS.push({
        type: event.type,
        button: event.button,
        buttons: event.buttons,
      });
    };
    window.addEventListener('mousedown', handler, false);
    window.addEventListener('mouseup', handler, false);
  });
  await page.mouse.move(50, 60);
  await page.mouse.down({
    button: 'middle',
  });
  await page.mouse.down({
    button: 'left',
  });
  await page.mouse.up({
    button: 'middle',
  });
  await page.mouse.up({
    button: 'left',
  });
  expect(await page.evaluate(() => (window as any).__EVENTS)).toEqual([
    { type: 'mousedown', button: 1, buttons: 4 },
    { type: 'mousedown', button: 0, buttons: 5 },
    { type: 'mouseup', button: 1, buttons: 1 },
    { type: 'mouseup', button: 0, buttons: 0 },
  ]);
});

it('should select the text with mouse', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/input/textarea.html');
  await page.focus('textarea');
  const text = 'This is the text that we are going to try to select. Let\'s see how it goes.';
  await page.keyboard.type(text);
  // Firefox needs an extra frame here after typing or it will fail to set the scrollTop
  await rafraf(page);
  await page.evaluate(() => document.querySelector('textarea').scrollTop = 0);
  const { x, y } = await page.evaluate(dimensions);
  await page.mouse.move(x + 2, y + 2);
  await page.mouse.down();
  await page.mouse.move(200, 200);
  await page.mouse.up();
  expect(await page.evaluate(() => {
    const textarea = document.querySelector('textarea');
    return textarea.value.substring(textarea.selectionStart, textarea.selectionEnd);
  })).toBe(text);
});

it('should trigger hover state', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/input/scrollable.html');
  await page.hover('#button-6');
  expect(await page.evaluate(() => document.querySelector('button:hover').id)).toBe('button-6');
  await page.hover('#button-2');
  expect(await page.evaluate(() => document.querySelector('button:hover').id)).toBe('button-2');
  await page.hover('#button-91');
  expect(await page.evaluate(() => document.querySelector('button:hover').id)).toBe('button-91');
});

it('should trigger hover state on disabled button', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/input/scrollable.html');
  await page.$eval('#button-6', (button: HTMLButtonElement) => button.disabled = true);
  await page.hover('#button-6', { timeout: 5000 });
  expect(await page.evaluate(() => document.querySelector('button:hover').id)).toBe('button-6');
});

it('should trigger hover state with removed window.Node', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/input/scrollable.html');
  await page.evaluate(() => delete window.Node);
  await page.hover('#button-6');
  expect(await page.evaluate(() => document.querySelector('button:hover').id)).toBe('button-6');
});

it('should set modifier keys on click', async ({ page, server, browserName, isMac }) => {
  await page.goto(server.PREFIX + '/input/scrollable.html');
  await page.evaluate(() => document.querySelector('#button-3').addEventListener('mousedown', e => window['lastEvent'] = e, true));
  const modifiers = { 'Shift': 'shiftKey', 'Control': 'ctrlKey', 'Alt': 'altKey', 'Meta': 'metaKey' };
  // In Firefox, the Meta modifier only exists on Mac
  if (browserName === 'firefox' && !isMac)
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

it('should tween mouse movement', async ({ page, browserName, isAndroid }) => {
  it.skip(isAndroid, 'Bad rounding');

  // The test becomes flaky on WebKit without next line.
  if (browserName === 'webkit')
    await page.evaluate(() => new Promise(requestAnimationFrame));
  await page.mouse.move(100, 100);
  await page.evaluate(() => {
    window['result'] = [];
    document.addEventListener('mousemove', event => {
      window['result'].push([event.clientX, event.clientY]);
    });
  });
  await page.mouse.move(200, 300, { steps: 5 });
  expect(await page.evaluate('result')).toEqual([
    [120, 140],
    [140, 180],
    [160, 220],
    [180, 260],
    [200, 300]
  ]);
});

it('should always round down', async ({ page }) => {
  await page.evaluate(() => {
    document.addEventListener('mousedown', event => {
      window['result'] = [event.clientX, event.clientY];
    });
  });
  await page.mouse.click(50.1, 50.9);
  expect(await page.evaluate('result')).toEqual([50, 50]);
});

it('should not crash on mouse drag with any button', async ({ page }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/16609' });
  await page.evaluate(() => {
    // Do not show contextmenu on right click since it is poorly supported.
    window.addEventListener('contextmenu', e => e.preventDefault(), false);
  });
  for (const button of ['left', 'middle', 'right'] as const) {
    await page.mouse.move(50, 50);
    await page.mouse.down({ button });
    await page.mouse.move(100, 100);
  }
});

it('should dispatch mouse move after context menu was opened', async ({ page, browserName, isWindows }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/20823' });
  it.fixme(browserName === 'firefox');
  it.skip(browserName === 'chromium' && isWindows, 'context menu support is best-effort for Linux and MacOS');
  await page.evaluate(() => {
    window['contextMenuPromise'] = new Promise(x => {
      window.addEventListener('contextmenu', x, false);
    });
  });
  const CX = 100, CY = 100;
  await page.mouse.move(CX, CY);
  await page.mouse.down({ button: 'right' });
  await page.evaluate(() => window['contextMenuPromise']);
  const N = 20;
  for (const radius of [10, 30, 60, 90]) {
    for (let i = 0; i < N; ++i) {
      const angle = 2 * Math.PI * i / N;
      const x = CX + Math.round(radius * Math.cos(angle));
      const y = CY + Math.round(radius * Math.sin(angle));
      await page.mouse.move(x, y);
    }
  }
});

