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

import { test, expect, sanitizeLog } from './inspectorTest';

test.describe('inspector', () => {
  test.skip(({ mode }) => mode !== 'default');

  test.afterEach(async ({ recorderPageGetter }) => {
    try {
      const recorderPage = await recorderPageGetter();
      recorderPage.click('[title=Resume]').catch(() => {});
    } catch (e) {
      // Some tests close context.
    }
  });

  test('should pause on goto, setContent, input and accessors', async ({ page, recorderPageGetter }) => {
    const scriptPromise = (async () => {
      await page.pause();
      await page.goto('about:blank');
      await page.setContent(`<input style="width: 200px">`);
      await page.click('input');
      await page.getAttribute('input', 'style');
      await page.type('input', 'hello');
    })();
    const recorderPage = await recorderPageGetter();
    for (let i = 0; i < 6; i++)
      await recorderPage.click('[title="Step over"]');
    expect(await sanitizeLog(recorderPage)).toEqual([
      'page.pause- XXms',
      'page.goto(about:blank)- XXms',
      'page.setContent- XXms',
      'page.click(input)- XXms',
      'page.getAttribute(input)- XXms',
      'page.type(input)- XXms',
    ]);
    await scriptPromise;
  });
});
