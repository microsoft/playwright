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
import { browserTest as it, expect } from '../config/browserTest';

it('should keep shadow DOM closed by default', async ({ page }) => {
  const mode = await page.evaluate(() => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: 'closed' });
    return shadow.mode;
  });
  expect(mode).toBe('closed');
});

it.describe('forceShadowDOMOpen', () => {
  it.use({ forceShadowDOMOpen: true });

  it('should force closed shadow DOM roots to open', async ({ page }) => {
    const mode = await page.evaluate(() => {
      const host = document.createElement('div');
      document.body.appendChild(host);
      const shadow = host.attachShadow({ mode: 'closed' });
      return shadow.mode;
    });
    expect(mode).toBe('open');
  });

  it('should keep open shadow DOM roots open', async ({ page }) => {
    const mode = await page.evaluate(() => {
      const host = document.createElement('div');
      document.body.appendChild(host);
      const shadow = host.attachShadow({ mode: 'open' });
      return shadow.mode;
    });
    expect(mode).toBe('open');
  });

  it('should allow querying elements inside forced-open shadow DOM', async ({ page }) => {
    await page.setContent('<div id="host"></div>');
    await page.evaluate(() => {
      const host = document.getElementById('host')!;
      const shadow = host.attachShadow({ mode: 'closed' });
      const span = document.createElement('span');
      span.textContent = 'shadow content';
      shadow.appendChild(span);
    });
    await expect(page.locator('#host >> span')).toHaveText('shadow content');
  });

  it('should work in new pages opened in the context', async ({ context }) => {
    const page1 = await context.newPage();
    const page2 = await context.newPage();
    for (const page of [page1, page2]) {
      const mode = await page.evaluate(() => {
        const host = document.createElement('div');
        document.body.appendChild(host);
        const shadow = host.attachShadow({ mode: 'closed' });
        return shadow.mode;
      });
      expect(mode).toBe('open');
    }
  });
});
