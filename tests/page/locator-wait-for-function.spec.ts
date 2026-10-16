/**
 * Copyright (c) Microsoft Corporation.
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

it('LO-183 should wait for an attribute to appear', async ({ page }) => {
  await page.setContent('<button id=toggle>Menu</button>');
  await page.evaluate(() => window.builtins.setTimeout(() => document.querySelector('#toggle')!.setAttribute('aria-expanded', 'true'), 1000));
  await page.locator('#toggle').waitForFunction(element => element.hasAttribute('aria-expanded'));
});

it('LO-184 should return immediately when already truthy', async ({ page }) => {
  await page.setContent('<div id=target>yes</div>');
  expect(await page.locator('#target').waitForFunction(element => element.textContent === 'yes')).toBe(undefined);
});

it('LO-185 should accept ElementHandle arguments', async ({ page }) => {
  await page.setContent('<div id=a></div><div id=b>value</div>');
  const handle = await page.$('#b');
  await page.locator('#a').waitForFunction((element, other) => other.textContent === 'value', handle);
});

it('LO-186 should accept string expression', async ({ page }) => {
  await page.setContent('<div id=target>yes</div>');
  await page.locator('#target').waitForFunction(`element => element.textContent === 'yes'`);
});

it('LO-187 should resolve a promise returned by the predicate', async ({ page }) => {
  await page.setContent('<div id=target>yes</div>');
  await page.locator('#target').waitForFunction(async element => element.textContent === 'yes');
});

it('LO-188 should wait for element to appear and survive rerender', async ({ page }) => {
  await page.setContent('<span>nothing here</span>');
  await page.evaluate(() => {
    let count = 0;
    let prev: Element | null = null;
    const tick = () => {
      ++count;
      const next = document.createElement('div');
      next.id = 'target';
      next.textContent = String(count);
      if (prev)
        prev.remove();
      document.body.appendChild(next);
      prev = next;
      if (count < 3)
        window.builtins.setTimeout(tick, 500);
    };
    window.builtins.setTimeout(tick, 500);
  });
  await page.locator('#target').waitForFunction(element => element.textContent === '3');
});

it('LO-189 should throw when predicate throws', async ({ page }) => {
  await page.setContent('<div id=target>no</div>');
  const error = await page.locator('#target').waitForFunction(() => {
    throw new Error('oh my');
  }).catch(e => e);
  expect(error.message).toContain('oh my');
});

it('LO-190 should throw on strict mode violation', async ({ page }) => {
  await page.setContent('<div class=x>1</div><div class=x>2</div>');
  const error = await page.locator('div.x').waitForFunction(() => true).catch(e => e);
  expect(error.message).toContain('strict mode violation');
});

it('LO-191 should abort via signal', async ({ page }) => {
  await page.setContent('<div id=target>no</div>');
  const controller = new AbortController();
  const promise = page.locator('#target').waitForFunction(element => element.textContent === 'yes', undefined, { timeout: 0, signal: controller.signal }).catch(e => e);
  await page.waitForTimeout(100);
  const reason = new Error('Aborted by user');
  controller.abort(reason);
  const error = await promise;
  expect(error.name).toBe('AbortError');
  expect(error.cause).toBe(reason);
});

it('LO-192 should abort via already-aborted signal', async ({ page }) => {
  await page.setContent('<div id=target>no</div>');
  const controller = new AbortController();
  controller.abort('already aborted');
  const error = await page.locator('#target').waitForFunction(() => true, undefined, { signal: controller.signal }).catch(e => e);
  expect(error.name).toBe('AbortError');
  expect(error.cause).toBe('already aborted');
});
