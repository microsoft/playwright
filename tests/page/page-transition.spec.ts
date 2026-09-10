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

import { test as it, expect } from './pageTest';

it('should not crash when filter transition completes', async ({ page, browserName }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/42637' });
  it.fixme(browserName === 'webkit', 'Web process crashes on the compositor thread when a filter transitions to none');

  await page.setContent(`
    <style>
      div { transition: filter 0.1s; }
      .dim { filter: brightness(0.95); }
    </style>
    ${'<div>hello</div>'.repeat(10)}
  `);
  let crashed = false;
  page.on('crash', () => crashed = true);
  for (let i = 0; i < 10 && !crashed; i++) {
    await page.evaluate(async () => {
      const divs = [...document.querySelectorAll('div')];
      const settled = () => Promise.all(divs.map(div => new Promise(f => div.addEventListener('transitionend', f, { once: true }))));
      let promise = settled();
      divs.forEach(div => div.classList.add('dim'));
      await promise;
      promise = settled();
      divs.forEach(div => div.classList.remove('dim'));
      await promise;
    }).catch(() => {});
  }
  expect(crashed).toBe(false);
});
