/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
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

import { browserTest as it, expect } from '../config/browserTest';

it('SM-011 should not fail page.textContent in non-strict mode', async ({ page }) => {
  await page.setContent(`<span>span1</span><div><span>target</span></div>`);
  expect(await page.textContent('span', { strict: false })).toBe('span1');
});

it.describe('locator visibility', () => {
  it.use({
    contextOptions: async ({ contextOptions }, use) => {
      await use({ ...contextOptions, locatorIncludeHidden: false });
    }
  });

  it('SM-015 should ignore hidden matches only when resolving locators', {
    annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/43855' },
  }, async ({ page }) => {
    await page.setContent(`
      <div hidden><button data-testid="save" title="Save">Save</button></div>
      <div style="width: 0; height: 0"><button data-testid="save" title="Save">Save</button></div>
    `);
    const save = page.getByTestId('save');
    expect(await save.count()).toBe(1);
    await expect(save).toHaveCount(1);
    await save.click();
    const normalized = await save.normalize();
    expect(await save.evaluateAll(elements => elements.length)).toBe(1);
    const all = await save.all();
    expect(all).toHaveLength(1);
    await all[0].click();
    expect(await page.getByText('Save', { exact: true }).count()).toBe(1);
    expect(await page.getByTitle('Save').count()).toBe(1);
    expect(await page.locator('div').getByTestId('save').count()).toBe(1);
    expect(await page.locator('div').locator(save).count()).toBe(1);
    expect(await save.first().count()).toBe(0);
    expect(await save.last().count()).toBe(1);

    const unfiltered = page.getByTestId('save', { includeHidden: true });
    expect(await unfiltered.count()).toBe(2);
    await expect(unfiltered.first().describe('cached button').filter({ hasText: 'Save' })).toBeAttached();
    expect(await unfiltered.and(page.locator('button', { includeHidden: true })).count()).toBe(2);
    expect(await unfiltered.or(page.locator('missing')).count()).toBe(2);
    expect(await unfiltered.visible().count()).toBe(1);
    expect(await page.locator('button', { includeHidden: true }).count()).toBe(2);
    expect(await page.getByRole('button', { includeHidden: true }).count()).toBe(2);
    expect(await page.locator('div', { includeHidden: true }).getByTestId('save').count()).toBe(1);
    expect(await page.locator('div', { includeHidden: true }).filter({ has: save }).count()).toBe(1);

    await page.locator('button', { includeHidden: true }).evaluateAll(elements => elements.forEach(element => element.setAttribute('hidden', '')));
    await expect(save).toBeHidden();
    expect(await normalized.count()).toBe(0);
    await save.waitFor({ state: 'hidden' });
    await expect(unfiltered.last()).toBeAttached();
    await unfiltered.last().waitFor({ state: 'attached' });

    await page.setContent(`<iframe srcdoc='<button hidden data-testid="save">Save</button><button data-testid="save">Save</button>'></iframe>`);
    const frame = page.frameLocator('iframe');
    await expect(frame.getByTestId('save')).toHaveCount(1);
    await expect(frame.getByTestId('save', { includeHidden: true })).toHaveCount(2);
    await expect(page.frames()[1].getByTestId('save')).toHaveCount(1);
    await expect(page.frames()[1].getByTestId('save', { includeHidden: true })).toHaveCount(2);
    await page.locator('iframe').evaluate(element => element.setAttribute('hidden', ''));
    expect(await frame.owner().count()).toBe(0);
    expect(await page.locator('iframe', { includeHidden: true }).contentFrame().owner().count()).toBe(1);
  });
});

it.describe('strict context mode', () => {
  it.use({
    contextOptions: async ({ contextOptions }, use) => {
      const options = { ...contextOptions, strictSelectors: true };
      await use(options);
    }
  });

  it('SM-012 should fail page.textContent in strict mode', async ({ page }) => {
    await page.setContent(`<span>span1</span><div><span>target</span></div>`);
    const error = await page.textContent('span').catch(e => e);
    expect(error.message).toContain('strict mode violation');
  });

  it('SM-013 should fail page.click in strict mode', async ({ page }) => {
    await page.setContent(`<button>button1</button><button>target</button>`);
    const error = await page.click('button').catch(e => e);
    expect(error.message).toContain('strict mode violation');
  });

  it('SM-014 should opt out of strict mode', async ({ page }) => {
    await page.setContent(`<span>span1</span><div><span>target</span></div>`);
    expect(await page.textContent('span', { strict: false })).toBe('span1');
  });
});
