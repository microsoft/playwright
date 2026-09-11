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

// Diagnostic for the WebKit r2359 GC regression. DO NOT MERGE.
//
// `page-leaks.spec.ts` › `expect should not leak` fails ~70% of runs on webkit-macos-15-xlarge
// since the r2359 roll, while the click/fill/waitFor variants next to it are 100% green. This
// file asks whether that asymmetry is real or an artifact of timing, by running the same
// scenario once per locator call and once per equivalent raw-DOM call.
//
// A standalone reduction hit wholesale retention on the waitFor equivalent, which does not fit
// the "expect-specific" story, hence this matrix. The raw-DOM variants run in the main world;
// the locator variants go through the injected script in the utility world.

import { server as coreServer } from '../../packages/playwright-core/lib/coreBundle';
const { nullProgress } = coreServer;
import { test, expect } from './pageTest';

const COUNT = 25;

async function weakRefObjects(pageImpl: any, selector: string) {
  for (const world of ['main', 'utility']) {
    const context = await pageImpl.mainFrame().context(world);
    await context.evaluate(selector => {
      const elements = document.querySelectorAll(selector);
      globalThis.weakRefs = globalThis.weakRefs || [];
      for (const element of elements)
        globalThis.weakRefs.push(new WeakRef(element));
    }, selector);
  }
}

async function weakRefCount(pageImpl: any): Promise<{ main: number, utility: number }> {
  const result = { main: 0, utility: 0 };
  for (const world of ['main', 'utility']) {
    await pageImpl.requestGC(nullProgress);
    const context = await pageImpl.mainFrame().context(world);
    result[world] = await context.evaluate(() => globalThis.weakRefs.filter(r => !!r.deref()).length);
  }
  return result;
}

// Same bounds as page-leaks.spec.ts. The failure is wholesale — every ref stays alive, so the
// count jumps straight to 58 — and it is sticky, so a short toPass window is enough and keeps a
// failing run from burning the whole test timeout.
async function checkWeakRefs(pageImpl: any, from: number, to: number) {
  await expect(async () => {
    const counts = await weakRefCount(pageImpl);
    expect(counts.main + counts.utility).toBeGreaterThanOrEqual(from);
    expect(counts.main + counts.utility).toBeLessThan(to);
  }).toPass({ timeout: 5000 });
}

const kVariants = ['expect', 'waitFor', 'click', 'dom-style', 'dom-event', 'dom-both', 'none'] as const;

for (const variant of kVariants) {
  test(`${variant} should not leak`, async ({ page, mode, toImpl }) => {
    test.skip(mode !== 'default');

    await page.setContent(`
      <button>static button 1</button>
      <button>static button 2</button>
      <div id="buttons"></div>
    `);
    await weakRefObjects(toImpl(page), 'button');

    const last = () => page.locator('#buttons > button').last();
    const visit = async () => {
      switch (variant) {
        case 'expect':
          await expect(last()).toBeVisible();
          break;
        case 'waitFor':
          await last().waitFor();
          break;
        case 'click':
          await last().click();
          break;
        case 'dom-style':
          await page.evaluate(() => {
            const element = document.querySelector('#buttons > button:last-child')!;
            const display = getComputedStyle(element).display;
            element.getBoundingClientRect();
            return display;
          });
          break;
        case 'dom-event':
          await page.evaluate(() => {
            const element = document.querySelector('#buttons > button:last-child')!;
            element.dispatchEvent(new CustomEvent('__mark__', { bubbles: true, cancelable: true, composed: true }));
          });
          break;
        case 'dom-both':
          await page.evaluate(() => {
            const element = document.querySelector('#buttons > button:last-child')!;
            const display = getComputedStyle(element).display;
            element.getBoundingClientRect();
            element.dispatchEvent(new CustomEvent('__mark__', { bubbles: true, cancelable: true, composed: true }));
            return display;
          });
          break;
        case 'none':
          break;
      }
    };

    for (let i = 0; i < COUNT; ++i) {
      await page.evaluate(i => {
        const element = document.createElement('button');
        element.textContent = 'dynamic ' + i;
        document.getElementById('buttons').appendChild(element);
      }, i);
      await visit();
    }

    await weakRefObjects(toImpl(page), 'button');
    await page.evaluate(() => {
      document.getElementById('buttons').textContent = '';
    });

    await checkWeakRefs(toImpl(page), 2, COUNT);
  });
}
