/**
 * Copyright 2018 Google Inc. All rights reserved.
 * Modifications copyright (c) Microsoft Corporation.
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

import { test as it } from './pageTest';

it('should not fail with internal error upon navigation', async ({ page, server }) => {
  it.slow();
  (async () => {
    while (true) {
      await page.goto(server.PREFIX + '/input/button.html').catch(() => {});
      await page.waitForTimeout(100).catch(() => {});
    }
  })();
  for (let i = 0; i < 100; ++i)
    await page.click('button');
});
