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

import { test, expect } from '@playwright/test';
import { raceAgainstTimeout } from '../../packages/playwright-core/src/tools/backend/utils';

test('raceAgainstTimeout resolves when the promise settles before the timeout', async () => {
  const promise = new Promise<string>(resolve => setTimeout(() => resolve('done'), 10));
  const result = await raceAgainstTimeout(promise, 1000);
  expect(result).toEqual({ timedOut: false, result: 'done' });
});

test('raceAgainstTimeout times out when the promise settles after the timeout', async () => {
  const promise = new Promise<string>(resolve => setTimeout(() => resolve('done'), 1000));
  const result = await raceAgainstTimeout(promise, 10);
  expect(result).toEqual({ timedOut: true });
});
