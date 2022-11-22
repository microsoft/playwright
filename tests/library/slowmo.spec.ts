/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { contextTest as it, expect } from '../config/browserTest';
import { attachFrame } from '../config/utils';

async function checkSlowMo(toImpl, page, task) {
  let didSlowMo = false;
  const contextDebugger = toImpl(page.context()).debugger();
  contextDebugger._slowMo = 100;
  const orig = contextDebugger._doSlowMo;
  contextDebugger._doSlowMo = async () => {
    if (didSlowMo)
      throw new Error('already did slowmo');
    await new Promise(x => setTimeout(x, 100));
    didSlowMo = true;
    return orig.call(contextDebugger);
  };
  await task();
  expect(!!didSlowMo).toBe(true);
}

async function checkPageSlowMo(toImpl, page, task) {
  await page.setContent(`
    <button>a</button>
    <input type="checkbox" class="check">
    <input type="checkbox" checked=true class="uncheck">
    <input class="fill">
    <select>
      <option>foo</option>
    </select>
    <input type="file" class="file">
  `);
  await checkSlowMo(toImpl, page, task);
}

it.describe('slowMo', () => {
  it.skip(({ mode }) => mode !== 'default');

  it('Page SlowMo $$eval', async ({ page, toImpl }) => {
    await checkPageSlowMo(toImpl, page, () => page.$$eval('button', () => void 0));
  });
  it('Page SlowMo $eval', async ({ page, toImpl }) => {
    await checkPageSlowMo(toImpl, page, () => page.$eval('button', () => void 0));
  });
  it('Page SlowMo check', async ({ page, toImpl }) => {
    await checkPageSlowMo(toImpl, page, () => page.check('.check'));
  });
  it('Page SlowMo click', async ({ page, toImpl }) => {
    await checkPageSlowMo(toImpl, page, () => page.click('button'));
  });
  it('Page SlowMo dblclick', async ({ page, toImpl }) => {
    await checkPageSlowMo(toImpl, page, () => page.dblclick('button'));
  });
  it('Page SlowMo dispatchEvent', async ({ page, toImpl }) => {
    await checkPageSlowMo(toImpl, page, () => page.dispatchEvent('button', 'click'));
  });
  it('Page SlowMo emulateMedia', async ({ page, toImpl }) => {
    await checkPageSlowMo(toImpl, page, () => page.emulateMedia({ media: 'print' }));
  });
  it('Page SlowMo evaluate', async ({ page, toImpl }) => {
    await checkPageSlowMo(toImpl, page, () => page.evaluate(() => void 0));
  });
  it('Page SlowMo evaluateHandle', async ({ page, toImpl }) => {
    await checkPageSlowMo(toImpl, page, () => page.evaluateHandle(() => window));
  });
  it('Page SlowMo fill', async ({ page, toImpl }) => {
    await checkPageSlowMo(toImpl, page, () => page.fill('.fill', 'foo'));
  });
  it('Page SlowMo focus', async ({ page, toImpl }) => {
    await checkPageSlowMo(toImpl, page, () => page.focus('button'));
  });
  it('Page SlowMo goto', async ({ page, toImpl }) => {
    await checkPageSlowMo(toImpl, page, () => page.goto('about:blank'));
  });
  it('Page SlowMo hover', async ({ page, toImpl }) => {
    await checkPageSlowMo(toImpl, page, () => page.hover('button'));
  });
  it('Page SlowMo press', async ({ page, toImpl }) => {
    await checkPageSlowMo(toImpl, page, () => page.press('button', 'Enter'));
  });
  it('Page SlowMo reload', async ({ page, toImpl }) => {
    await checkPageSlowMo(toImpl, page, () => page.reload());
  });
  it('Page SlowMo setContent', async ({ page, toImpl }) => {
    await checkPageSlowMo(toImpl, page, () => page.setContent('hello world'));
  });
  it('Page SlowMo selectOption', async ({ page, toImpl }) => {
    await checkPageSlowMo(toImpl, page, () => page.selectOption('select', 'foo'));
  });
  it('Page SlowMo setInputFiles', async ({ page, toImpl }) => {
    await checkPageSlowMo(toImpl, page, () => page.setInputFiles('.file', []));
  });
  it('Page SlowMo setViewportSize', async ({ page, toImpl }) => {
    await checkPageSlowMo(toImpl, page, () => page.setViewportSize({ height: 400, width: 400 }));
  });
  it('Page SlowMo type', async ({ page, toImpl }) => {
    await checkPageSlowMo(toImpl, page, () => page.type('.fill', 'a'));
  });
  it('Page SlowMo uncheck', async ({ page, toImpl }) => {
    await checkPageSlowMo(toImpl, page, () => page.uncheck('.uncheck'));
  });
  it('Frame SlowMo $$eval', async ({ page, server, toImpl }) => {
    await checkFrameSlowMo(toImpl, page, server, frame => frame.$$eval('button', () => void 0));
  });
  it('Frame SlowMo $eval', async ({ page, server, toImpl }) => {
    await checkFrameSlowMo(toImpl, page, server, frame => frame.$eval('button', () => void 0));
  });
  it('Frame SlowMo check', async ({ page, server, toImpl }) => {
    await checkFrameSlowMo(toImpl, page, server, frame => frame.check('.check'));
  });
  it('Frame SlowMo click', async ({ page, server, toImpl }) => {
    await checkFrameSlowMo(toImpl, page, server, frame => frame.click('button'));
  });
  it('Frame SlowMo dblclick', async ({ page, server, toImpl }) => {
    await checkFrameSlowMo(toImpl, page, server, frame => frame.dblclick('button'));
  });
  it('Frame SlowMo dispatchEvent', async ({ page, server, toImpl }) => {
    await checkFrameSlowMo(toImpl, page, server, frame => frame.dispatchEvent('button', 'click'));
  });
  it('Frame SlowMo evaluate', async ({ page, server, toImpl }) => {
    await checkFrameSlowMo(toImpl, page, server, frame => frame.evaluate(() => void 0));
  });
  it('Frame SlowMo evaluateHandle', async ({ page, server, toImpl }) => {
    await checkFrameSlowMo(toImpl, page, server, frame => frame.evaluateHandle(() => window));
  });
  it('Frame SlowMo fill', async ({ page, server, toImpl }) => {
    await checkFrameSlowMo(toImpl, page, server, frame => frame.fill('.fill', 'foo'));
  });
  it('Frame SlowMo focus', async ({ page, server, toImpl }) => {
    await checkFrameSlowMo(toImpl, page, server, frame => frame.focus('button'));
  });
  it('Frame SlowMo goto', async ({ page, server, toImpl }) => {
    await checkFrameSlowMo(toImpl, page, server, frame => frame.goto('about:blank'));
  });
  it('Frame SlowMo hover', async ({ page, server, toImpl }) => {
    await checkFrameSlowMo(toImpl, page, server, frame => frame.hover('button'));
  });
  it('Frame SlowMo press', async ({ page, server, toImpl }) => {
    await checkFrameSlowMo(toImpl, page, server, frame => frame.press('button', 'Enter'));
  });
  it('Frame SlowMo setContent', async ({ page, server, toImpl }) => {
    await checkFrameSlowMo(toImpl, page, server, frame => frame.setContent('hello world'));
  });
  it('Frame SlowMo selectOption', async ({ page, server, toImpl }) => {
    await checkFrameSlowMo(toImpl, page, server, frame => frame.selectOption('select', 'foo'));
  });
  it('Frame SlowMo setInputFiles', async ({ page, server, toImpl }) => {
    await checkFrameSlowMo(toImpl, page, server, frame => frame.setInputFiles('.file', []));
  });
  it('Frame SlowMo type', async ({ page, server, toImpl }) => {
    await checkFrameSlowMo(toImpl, page, server, frame => frame.type('.fill', 'a'));
  });
  it('Frame SlowMo uncheck', async ({ page, server, toImpl }) => {
    await checkFrameSlowMo(toImpl, page, server, frame => frame.uncheck('.uncheck'));
  });
  it('ElementHandle SlowMo $$eval', async ({ page, toImpl }) => {
    await checkElementSlowMo(toImpl, page, 'body', element => element.$$eval('button', () => void 0));
  });
  it('ElementHandle SlowMo $eval', async ({ page, toImpl }) => {
    await checkElementSlowMo(toImpl, page, 'body', element => element.$eval('button', () => void 0));
  });
  it('ElementHandle SlowMo check', async ({ page, toImpl }) => {
    await checkElementSlowMo(toImpl, page, '.check', element => element.check());
  });
  it('ElementHandle SlowMo click', async ({ page, toImpl }) => {
    await checkElementSlowMo(toImpl, page, 'button', element => element.click());
  });
  it('ElementHandle SlowMo dblclick', async ({ page, toImpl }) => {
    await checkElementSlowMo(toImpl, page, 'button', element => element.dblclick());
  });
  it('ElementHandle SlowMo dispatchEvent', async ({ page, toImpl }) => {
    await checkElementSlowMo(toImpl, page, 'button', element => element.dispatchEvent('click'));
  });
  it('ElementHandle SlowMo evaluate', async ({ page, toImpl }) => {
    await checkElementSlowMo(toImpl, page, 'button', element => element.evaluate(() => void 0));
  });
  it('ElementHandle SlowMo evaluateHandle', async ({ page, toImpl }) => {
    await checkElementSlowMo(toImpl, page, 'button', element => element.evaluateHandle(() => void 0));
  });
  it('ElementHandle SlowMo fill', async ({ page, toImpl }) => {
    await checkElementSlowMo(toImpl, page, '.fill', element => element.fill('foo'));
  });
  it('ElementHandle SlowMo focus', async ({ page, toImpl }) => {
    await checkElementSlowMo(toImpl, page, 'button', element => element.focus());
  });
  it('ElementHandle SlowMo hover', async ({ page, toImpl }) => {
    await checkElementSlowMo(toImpl, page, 'button', element => element.hover());
  });
  it('ElementHandle SlowMo press', async ({ page, toImpl }) => {
    await checkElementSlowMo(toImpl, page, 'button', element => element.press('Enter'));
  });
  it('ElementHandle SlowMo selectOption', async ({ page, toImpl }) => {
    await checkElementSlowMo(toImpl, page, 'select', element => element.selectOption('foo'));
  });
  it('ElementHandle SlowMo setInputFiles', async ({ page, toImpl }) => {
    await checkElementSlowMo(toImpl, page, '.file', element => element.setInputFiles([]));
  });
  it('ElementHandle SlowMo type', async ({ page, toImpl }) => {
    await checkElementSlowMo(toImpl, page, '.fill', element => element.type('a'));
  });
  it('ElementHandle SlowMo uncheck', async ({ page, toImpl }) => {
    await checkElementSlowMo(toImpl, page, '.uncheck', element => element.uncheck());
  });
});

async function checkFrameSlowMo(toImpl, page, server, task) {
  const frame = await attachFrame(page, 'frame1', server.EMPTY_PAGE);
  await frame.setContent(`
    <button>a</button>
    <input type="checkbox" class="check">
    <input type="checkbox" checked=true class="uncheck">
    <input class="fill">
    <select>
      <option>foo</option>
    </select>
    <input type="file" class="file">
  `);
  await checkSlowMo(toImpl, page, task.bind(null, frame));
}


async function checkElementSlowMo(toImpl, page, selector, task) {
  await page.setContent(`
    <button>a</button>
    <input type="checkbox" class="check">
    <input type="checkbox" checked=true class="uncheck">
    <input class="fill">
    <select>
      <option>foo</option>
    </select>
    <input type="file" class="file">
  `);
  const element = await page.$(selector);
  await checkSlowMo(toImpl, page, task.bind(null, element));
}
