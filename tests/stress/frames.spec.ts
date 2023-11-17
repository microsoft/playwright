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

import { contextTest as test } from '../config/browserTest';

test.slow();

test('cycle frames', async ({ page, server }) => {
  const kFrameCount = 1200;

  await page.goto(server.EMPTY_PAGE);
  let cb;
  const promise = new Promise(f => cb = f);
  let counter = 0;
  page.on('frameattached', () => {
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
  await new Promise(f => setTimeout(f, 500));
});
