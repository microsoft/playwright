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

import { ManualPromise } from '../../../packages/playwright-core/lib/utils/manualPromise';
import { EventEmitter } from '../../../packages/playwright-core/lib/client/eventEmitter';
import { test, expect } from '@playwright/test';

test('should not throw with ignoreErrors', async () => {
  const ee = new EventEmitter();
  const releaseHandler = new ManualPromise();
  ee.on('console', async () => {
    await releaseHandler;
    throw new Error('Error in console handler');
  });
  ee.emit('console');
  await ee.removeAllListeners('console', { behavior: 'ignoreErrors' });
  releaseHandler.resolve();
});

test('should wait', async () => {
  const ee = new EventEmitter();
  const releaseHandler = new ManualPromise();
  let value = 0;
  ee.on('console', async () => {
    await releaseHandler;
    value = 42;
  });
  ee.emit('console');
  const removePromise = ee.removeAllListeners('console', { behavior: 'wait' });
  releaseHandler.resolve();
  await removePromise;
  expect(value).toBe(42);
});

test('should wait all', async () => {
  const ee = new EventEmitter();
  const releaseHandler = new ManualPromise();
  const values = [];
  ee.on('a', async () => {
    await releaseHandler;
    values.push(42);
  });
  ee.on('b', async () => {
    await releaseHandler;
    values.push(43);
  });
  ee.emit('a');
  ee.emit('b');
  const removePromise = ee.removeAllListeners(undefined, { behavior: 'wait' });
  releaseHandler.resolve();
  await removePromise;
  expect(values).toEqual([42, 43]);
});

test('wait should throw', async () => {
  const ee = new EventEmitter();
  const releaseHandler = new ManualPromise();
  ee.on('console', async () => {
    await releaseHandler;
    throw new Error('Error in handler');
  });
  ee.emit('console');
  const removePromise = ee.removeAllListeners('console', { behavior: 'wait' });
  releaseHandler.resolve();
  await expect(removePromise).rejects.toThrow('Error in handler');
});
