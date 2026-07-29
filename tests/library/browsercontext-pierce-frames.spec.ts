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

it('should not pierce frames without the context option', async ({ page }) => {
  await page.setContent(`<iframe srcdoc="<button>inside</button>"></iframe>`);
  await expect.poll(() => page.frames().length).toBe(2);
  await page.frames()[1].waitForSelector('button', { state: 'attached' });
  await expect(page.locator('button')).toHaveCount(0);
});

it.describe('pierceFrames context option', () => {
  it.use({
    contextOptions: async ({ contextOptions }, use) => {
      await use({ ...contextOptions, pierceFrames: true });
    }
  });

  it('should pierce frames by default', async ({ page }) => {
    await page.setContent(`<iframe srcdoc="<button onclick='window.top.__clicked = true'>Click me</button>"></iframe>`);
    await expect(page.locator('button')).toHaveText('Click me');
    await page.locator('button').click();
    expect(await page.evaluate(() => (window as any).__clicked)).toBe(true);
  });

  it('should pierce nested frames by default', async ({ page }) => {
    await page.setContent(`<iframe srcdoc="<iframe srcdoc='<div id=target>deep</div>'></iframe>"></iframe>`);
    await expect(page.locator('#target')).toHaveText('deep');
  });

  it('should fail when elements match in multiple frames', async ({ page }) => {
    await page.setContent(`<div>main</div><iframe srcdoc="<div>child</div>"></iframe>`);
    await expect.poll(() => page.frames().length).toBe(2);
    await page.frames()[1].waitForSelector('div', { state: 'attached' });
    const error = await page.locator('div').count().catch(e => e);
    expect(error.message).toContain('Pierce-frame mode matched elements from multiple frames');
  });

  it('should opt out with pierceFrames({ pierce: false })', async ({ page }) => {
    await page.setContent(`<div id="main">main</div><iframe srcdoc="<div id=inner>inner</div>"></iframe>`);
    await expect(page.locator('#inner')).toHaveText('inner');
    await expect(page.pierceFrames({ pierce: false }).locator('#inner')).toHaveCount(0);
    await expect(page.pierceFrames({ pierce: false }).locator('#main')).toHaveText('main');
  });

  it('should support frameLocator with the context option', async ({ page }) => {
    await page.setContent(`<iframe srcdoc="<iframe id=target srcdoc='<button>hi</button>'></iframe><button>decoy</button>"></iframe>`);
    await expect(page.frameLocator('#target').locator('button')).toHaveText('hi');
  });

  it('should support frameLocator chains with pierceFrames({ pierce: false })', async ({ page }) => {
    await page.setContent(`<iframe id="direct" srcdoc="<button>direct</button>"></iframe>`);
    await expect(page.pierceFrames({ pierce: false }).frameLocator('#direct').locator('button')).toHaveText('direct');
  });

  it('should resolve aria-ref selectors', async ({ page }) => {
    await page.setContent(`<button>main</button><iframe srcdoc="<button>inside</button>"></iframe>`);
    await expect.poll(() => page.frames().length).toBe(2);
    await page.frames()[1].waitForSelector('button', { state: 'attached' });
    const snapshot = await page.ariaSnapshot({ mode: 'ai' });
    const mainMatch = snapshot.match(/button "main" \[ref=(.*?)\]/);
    await expect(page.locator(`aria-ref=${mainMatch![1]}`)).toHaveText('main');
    // Refs are unique across frames, so piercing resolves them in the right frame.
    const insideMatch = snapshot.match(/button "inside" \[ref=(.*?)\]/);
    expect(insideMatch![1]).toMatch(/^f\d+e\d+$/);
    await expect(page.locator(`aria-ref=${insideMatch![1]}`)).toHaveText('inside');
  });

  it('should support ai snapshot with nested frames', async ({ page }) => {
    await page.setContent(`<iframe srcdoc="<iframe srcdoc='<button>deep</button>'></iframe>"></iframe>`);
    await expect.poll(() => page.frames().length).toBe(3);
    await expect.poll(() => page.ariaSnapshot({ mode: 'ai' })).toContain('button "deep"');
  });
});
