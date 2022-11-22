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

import { contextTest as test, expect } from '../config/browserTest';

test('should survive shared worker restart', async ({ context, server }) => {
  const page1 = await context.newPage();
  await page1.goto(server.PREFIX + '/shared-worker/shared-worker.html');
  expect(await page1.evaluate('window.sharedWorkerResponsePromise')).toBe('echo:hello');
  await page1.close();

  const page2 = await context.newPage();
  await page2.goto(server.PREFIX + '/shared-worker/shared-worker.html');
  expect(await page2.evaluate('window.sharedWorkerResponsePromise')).toBe('echo:hello');
  await page2.close();
});
