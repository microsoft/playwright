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

import type { Page, Frame, ElementHandle } from '@playwright/test';
import { contextTest as it, expect } from '../config/browserTest';
import { attachFrame } from '../config/utils';
import type { TestServer } from '../config/testserver';

async function checkSlowMo(toImpl: (api: any) => any, page: Page, task: () => Promise<unknown>) {
  let didSlowMo = false;
  const dispatcherConnection = toImpl((page as any)._connection);
  const orig = dispatcherConnection._doSlowMo;
  dispatcherConnection._doSlowMo = async (sdkObject: any) => {
    if (didSlowMo)
      throw new Error('already did slowmo');
    await new Promise(x => setTimeout(x, 100));
    didSlowMo = true;
  };
  await task();
  expect(!!didSlowMo).toBe(true);
  dispatcherConnection._doSlowMo = orig;
}

async function checkPageSlowMo(toImpl: (api: any) => any, page: Page, task: () => Promise<unknown>) {
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

  it('SL-001 Page SlowMo check', async ({ page, toImpl }) => {
    await checkPageSlowMo(toImpl, page, () => page.check('.check'));
  });
  it('SL-002 Page SlowMo click', async ({ page, toImpl }) => {
    await checkPageSlowMo(toImpl, page, () => page.click('button'));
  });
  it('SL-003 Page SlowMo dblclick', async ({ page, toImpl }) => {
    await checkPageSlowMo(toImpl, page, () => page.dblclick('button'));
  });
  it('SL-004 Page SlowMo dispatchEvent', async ({ page, toImpl }) => {
    await checkPageSlowMo(toImpl, page, () => page.dispatchEvent('button', 'click'));
  });
  it('SL-005 Page SlowMo fill', async ({ page, toImpl }) => {
    await checkPageSlowMo(toImpl, page, () => page.fill('.fill', 'foo'));
  });
  it('SL-006 Page SlowMo focus', async ({ page, toImpl }) => {
    await checkPageSlowMo(toImpl, page, () => page.focus('button'));
  });
  it('SL-007 Page SlowMo goto', async ({ page, toImpl }) => {
    await checkPageSlowMo(toImpl, page, () => page.goto('about:blank'));
  });
  it('SL-008 Page SlowMo hover', async ({ page, toImpl }) => {
    await checkPageSlowMo(toImpl, page, () => page.hover('button'));
  });
  it('SL-009 Page SlowMo press', async ({ page, toImpl }) => {
    await checkPageSlowMo(toImpl, page, () => page.press('button', 'Enter'));
  });
  it('SL-010 Page SlowMo reload', async ({ page, toImpl }) => {
    await checkPageSlowMo(toImpl, page, () => page.reload());
  });
  it('SL-011 Page SlowMo selectOption', async ({ page, toImpl }) => {
    await checkPageSlowMo(toImpl, page, () => page.selectOption('select', 'foo'));
  });
  it('SL-012 Page SlowMo setInputFiles', async ({ page, toImpl }) => {
    await checkPageSlowMo(toImpl, page, () => page.setInputFiles('.file', []));
  });
  it('SL-013 Page SlowMo type', async ({ page, toImpl }) => {
    await checkPageSlowMo(toImpl, page, () => page.type('.fill', 'a'));
  });
  it('SL-014 Page SlowMo uncheck', async ({ page, toImpl }) => {
    await checkPageSlowMo(toImpl, page, () => page.uncheck('.uncheck'));
  });
  it('SL-015 Frame SlowMo check', async ({ page, server, toImpl }) => {
    await checkFrameSlowMo(toImpl, page, server, frame => frame.check('.check'));
  });
  it('SL-016 Frame SlowMo click', async ({ page, server, toImpl }) => {
    await checkFrameSlowMo(toImpl, page, server, frame => frame.click('button'));
  });
  it('SL-017 Frame SlowMo dblclick', async ({ page, server, toImpl }) => {
    await checkFrameSlowMo(toImpl, page, server, frame => frame.dblclick('button'));
  });
  it('SL-018 Frame SlowMo dispatchEvent', async ({ page, server, toImpl }) => {
    await checkFrameSlowMo(toImpl, page, server, frame => frame.dispatchEvent('button', 'click'));
  });
  it('SL-019 Frame SlowMo fill', async ({ page, server, toImpl }) => {
    await checkFrameSlowMo(toImpl, page, server, frame => frame.fill('.fill', 'foo'));
  });
  it('SL-020 Frame SlowMo focus', async ({ page, server, toImpl }) => {
    await checkFrameSlowMo(toImpl, page, server, frame => frame.focus('button'));
  });
  it('SL-021 Frame SlowMo goto', async ({ page, server, toImpl }) => {
    await checkFrameSlowMo(toImpl, page, server, frame => frame.goto('about:blank'));
  });
  it('SL-022 Frame SlowMo hover', async ({ page, server, toImpl }) => {
    await checkFrameSlowMo(toImpl, page, server, frame => frame.hover('button'));
  });
  it('SL-023 Frame SlowMo press', async ({ page, server, toImpl }) => {
    await checkFrameSlowMo(toImpl, page, server, frame => frame.press('button', 'Enter'));
  });
  it('SL-024 Frame SlowMo selectOption', async ({ page, server, toImpl }) => {
    await checkFrameSlowMo(toImpl, page, server, frame => frame.selectOption('select', 'foo'));
  });
  it('SL-025 Frame SlowMo setInputFiles', async ({ page, server, toImpl }) => {
    await checkFrameSlowMo(toImpl, page, server, frame => frame.setInputFiles('.file', []));
  });
  it('SL-026 Frame SlowMo type', async ({ page, server, toImpl }) => {
    await checkFrameSlowMo(toImpl, page, server, frame => frame.type('.fill', 'a'));
  });
  it('SL-027 Frame SlowMo uncheck', async ({ page, server, toImpl }) => {
    await checkFrameSlowMo(toImpl, page, server, frame => frame.uncheck('.uncheck'));
  });
  it('SL-028 ElementHandle SlowMo check', async ({ page, toImpl }) => {
    await checkElementSlowMo(toImpl, page, '.check', element => element.check());
  });
  it('SL-029 ElementHandle SlowMo click', async ({ page, toImpl }) => {
    await checkElementSlowMo(toImpl, page, 'button', element => element.click());
  });
  it('SL-030 ElementHandle SlowMo dblclick', async ({ page, toImpl }) => {
    await checkElementSlowMo(toImpl, page, 'button', element => element.dblclick());
  });
  it('SL-031 ElementHandle SlowMo dispatchEvent', async ({ page, toImpl }) => {
    await checkElementSlowMo(toImpl, page, 'button', element => element.dispatchEvent('click'));
  });
  it('SL-032 ElementHandle SlowMo fill', async ({ page, toImpl }) => {
    await checkElementSlowMo(toImpl, page, '.fill', element => element.fill('foo'));
  });
  it('SL-033 ElementHandle SlowMo focus', async ({ page, toImpl }) => {
    await checkElementSlowMo(toImpl, page, 'button', element => element.focus());
  });
  it('SL-034 ElementHandle SlowMo hover', async ({ page, toImpl }) => {
    await checkElementSlowMo(toImpl, page, 'button', element => element.hover());
  });
  it('SL-035 ElementHandle SlowMo press', async ({ page, toImpl }) => {
    await checkElementSlowMo(toImpl, page, 'button', element => element.press('Enter'));
  });
  it('SL-036 ElementHandle SlowMo selectOption', async ({ page, toImpl }) => {
    await checkElementSlowMo(toImpl, page, 'select', element => element.selectOption('foo'));
  });
  it('SL-037 ElementHandle SlowMo setInputFiles', async ({ page, toImpl }) => {
    await checkElementSlowMo(toImpl, page, '.file', element => element.setInputFiles([]));
  });
  it('SL-038 ElementHandle SlowMo type', async ({ page, toImpl }) => {
    await checkElementSlowMo(toImpl, page, '.fill', element => element.type('a'));
  });
  it('SL-039 ElementHandle SlowMo uncheck', async ({ page, toImpl }) => {
    await checkElementSlowMo(toImpl, page, '.uncheck', element => element.uncheck());
  });
});

async function checkFrameSlowMo(toImpl: (api: any) => any, page: Page, server: TestServer, task: (frame: Frame) => Promise<unknown>) {
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


async function checkElementSlowMo(toImpl: (api: any) => any, page: Page, selector: string, task: (element: ElementHandle<HTMLElement>) => Promise<unknown>) {
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
  const element = (await page.$(selector)) as ElementHandle<HTMLElement>;
  await checkSlowMo(toImpl, page, task.bind(null, element));
}
