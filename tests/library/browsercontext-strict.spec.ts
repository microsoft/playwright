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

it('should not fail page.textContent in non-strict mode', async ({ page }) => {
  await page.setContent(`<span>span1</span><div><span>target</span></div>`);
  expect(await page.textContent('span', { strict: false })).toBe('span1');
});

it.describe('strict context mode', () => {
  it.use({
    contextOptions: async ({ contextOptions }, use) => {
      const options = { ...contextOptions, strictSelectors: true };
      await use(options);
    }
  });

  it('should fail page.textContent in strict mode', async ({ page }) => {
    await page.setContent(`<span>span1</span><div><span>target</span></div>`);
    const error = await page.textContent('span').catch(e => e);
    expect(error.message).toContain('strict mode violation');
  });

  it('should fail page.click in strict mode', async ({ page }) => {
    await page.setContent(`<button>button1</button><button>target</button>`);
    const error = await page.click('button').catch(e => e);
    expect(error.message).toContain('strict mode violation');
  });

  it('should opt out of strict mode', async ({ page }) => {
    await page.setContent(`<span>span1</span><div><span>target</span></div>`);
    expect(await page.textContent('span', { strict: false })).toBe('span1');
  });
});
