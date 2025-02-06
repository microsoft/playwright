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

import { MultiMap } from '../../packages/playwright-core/lib/utils/isomorphic/multimap';
import { test, expect } from './pageTest';

function leakedJSHandles(): string {
  const map = new MultiMap();
  for (const [h, e] of (globalThis as any).leakedJSHandles) {
    const name = `[${h.worldNameForTest()}] ${h.preview()}`;
    if (name === '[main] UtilityScript' || name === '[utility] UtilityScript' || name === '[electron] UtilityScript' || name === '[main] InjectedScript' || name === '[utility] InjectedScript' || name === '[electron] ElectronModule')
      continue;
    map.set(e.stack, name);
  }

  if (!map.size)
    return '';

  const lines: string[] = [];
  lines.push('=============================');
  lines.push('Leaked JSHandles:');
  for (const key of map.keys()) {
    lines.push('=============================');
    for (const value of map.get(key))
      lines.push(value);
    lines.push('in ' + key);
  }
  return lines.join('\n');
}

async function weakRefObjects(pageImpl: any, selector: string) {
  for (const world of ['main', 'utility']) {
    const context = await pageImpl.mainFrame()._context(world);
    await context.evaluate(selector => {
      const elements = document.querySelectorAll(selector);
      globalThis.weakRefs = globalThis.weakRefs || [];
      for (const element of elements)
        globalThis.weakRefs.push(new WeakRef(element));
    }, selector);
  }
}

async function weakRefCount(pageImpl): Promise<{ main: number, utility: number }> {
  const result = { main: 0, utility: 0 };
  for (const world of ['main', 'utility']) {
    await pageImpl.requestGC();
    const context = await pageImpl.mainFrame()._context(world);
    result[world] = await context.evaluate(() => globalThis.weakRefs.filter(r => !!r.deref()).length);
  }
  return result;
}

async function checkWeakRefs(pageImpl, from: number, to: number) {
  await expect(async () => {
    const counts = await weakRefCount(pageImpl);
    expect(counts.main + counts.utility).toBeGreaterThanOrEqual(from);
    expect(counts.main + counts.utility).toBeLessThan(to);
  }).toPass();
}

test.beforeEach(() => {
  (globalThis as any).leakedJSHandles = new Map();
});

test.afterEach(() => {
  (globalThis as any).leakedJSHandles = null;
});

test('click should not leak', async ({ page, toImpl }) => {
  await page.setContent(`
    <button>static button 1</button>
    <button>static button 2</button>
    <div id="buttons"></div>
  `);

  for (let i = 0; i < 25; ++i) {
    await page.evaluate(i => {
      const element = document.createElement('button');
      element.textContent = 'dynamic ' + i;
      document.getElementById('buttons').appendChild(element);
    }, i);
    await page.locator('#buttons > button').last().click();
  }

  await weakRefObjects(toImpl(page), 'button');
  await page.evaluate(() => {
    document.getElementById('buttons').textContent = '';
  });

  expect(leakedJSHandles()).toBeFalsy();
  await checkWeakRefs(toImpl(page), 2, 25);
});

test('fill should not leak', async ({ page, mode, toImpl }) => {
  test.skip(mode !== 'default');

  await page.setContent(`
    <input value="static input 1"</input>
    <input value="static input 2"</input>
    <div id="inputs"></div>
  `);

  for (let i = 0; i < 25; ++i) {
    await page.evaluate(() => {
      const element = document.createElement('input');
      document.getElementById('inputs').appendChild(element);
    });
    await page.locator('#inputs > input').last().fill('input ' + i);
  }

  await weakRefObjects(toImpl(page), 'input');
  await page.evaluate(() => {
    document.getElementById('inputs').textContent = '';
  });

  expect(leakedJSHandles()).toBeFalsy();
  await checkWeakRefs(toImpl(page), 2, 25);
});

test('expect should not leak', async ({ page, mode, toImpl }) => {
  test.skip(mode !== 'default');

  await page.setContent(`
    <button>static button 1</button>
    <button>static button 2</button>
    <div id="buttons"></div>
  `);
  await weakRefObjects(toImpl(page), 'button');

  for (let i = 0; i < 25; ++i) {
    await page.evaluate(i => {
      const element = document.createElement('button');
      element.textContent = 'dynamic ' + i;
      document.getElementById('buttons').appendChild(element);
    }, i);
    await expect(page.locator('#buttons > button').last()).toBeVisible();
  }

  await weakRefObjects(toImpl(page), 'button');
  await page.evaluate(() => {
    document.getElementById('buttons').textContent = '';
  });

  expect(leakedJSHandles()).toBeFalsy();
  await checkWeakRefs(toImpl(page), 2, 25);
});

test('waitFor should not leak', async ({ page, mode, toImpl }) => {
  test.skip(mode !== 'default');

  await page.setContent(`
    <button>static button 1</button>
    <button>static button 2</button>
    <div id="buttons"></div>
  `);

  for (let i = 0; i < 25; ++i) {
    await page.evaluate(i => {
      const element = document.createElement('button');
      element.textContent = 'dynamic ' + i;
      document.getElementById('buttons').appendChild(element);
    }, i);
    await page.locator('#buttons > button').last().waitFor();
  }

  await weakRefObjects(toImpl(page), 'button');
  await page.evaluate(() => {
    document.getElementById('buttons').textContent = '';
  });

  expect(leakedJSHandles()).toBeFalsy();
  await checkWeakRefs(toImpl(page), 2, 25);
});
