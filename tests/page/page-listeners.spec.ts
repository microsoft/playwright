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

import { ManualPromise } from '../../packages/playwright-core/lib/utils/manualPromise';
import { test as it, expect } from './pageTest';

// This test is mostly for type checking, the actual tests are in the library/events.

it('should not throw with ignoreErrors', async ({ page }) => {
  const reachedHandler = new ManualPromise();
  const releaseHandler = new ManualPromise();
  page.on('console', async () => {
    reachedHandler.resolve();
    await releaseHandler;
    throw new Error('Error in console handler');
  });
  await page.evaluate('console.log(1)');
  await reachedHandler;
  await page.removeAllListeners('console', { behavior: 'ignoreErrors' });
  releaseHandler.resolve();
  await page.waitForTimeout(1000);
});

it('should wait', async ({ page }) => {
  const reachedHandler = new ManualPromise();
  const releaseHandler = new ManualPromise();
  let value = 0;
  page.on('console', async () => {
    reachedHandler.resolve();
    value = 42;
  });
  await page.evaluate('console.log(1)');
  await reachedHandler;
  const removePromise = page.removeAllListeners('console', { behavior: 'wait' });
  releaseHandler.resolve();
  await removePromise;
  expect(value).toBe(42);
});

it('wait should throw', async ({ page }) => {
  const reachedHandler = new ManualPromise();
  const releaseHandler = new ManualPromise();
  page.on('console', async () => {
    reachedHandler.resolve();
    await releaseHandler;
    throw new Error('Error in handler');
  });
  await page.evaluate('console.log(1)');
  await reachedHandler;
  const removePromise = page.removeAllListeners('console', { behavior: 'wait' });
  releaseHandler.resolve();
  await expect(removePromise).rejects.toThrow('Error in handler');
});
