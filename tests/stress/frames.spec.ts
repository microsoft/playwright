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

import { contextTest as test, expect } from '../config/browserTest';

test.slow();

test('cycle frames', async ({ page, server }) => {
  require('../../packages/playwright-core/lib/server/dispatchers/dispatcher').setMaxDispatchersForTest(100);

  const kFrameCount = 310;

  await page.goto(server.EMPTY_PAGE);
  let cb;
  const promise = new Promise(f => cb = f);
  let counter = 0;
  page.on('frameattached', async () => {
    // Make sure we can access page.
    await page.title();
    if (++counter === kFrameCount)
      cb();
  });

  page.evaluate(async ({ url, count }) => {
    for (let i = 0; i < count; i++) {
      const frame = document.createElement('iframe');
      frame.src = url;
      document.body.appendChild(frame);
      await new Promise(f => setTimeout(f, 10));
      frame.remove();
    }
  }, { url: server.PREFIX + '/one-style.html', count: kFrameCount }).catch(() => {});
  await promise;
  await page.waitForTimeout(500);

  require('../../packages/playwright-core/lib/server/dispatchers/dispatcher').setMaxDispatchersForTest(null);
});

test('cycle handles', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  await page.setContent(`<div><span>hi</span></div>`.repeat(2000));
  const divs = await page.$$('div');
  for (const div of divs) {
    const span = await div.$('span');
    expect(await span.textContent()).toBe('hi');
  }
});
