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

import { test, expect } from '@playwright/test';
import Counter from './Counter.svelte';

test.use({ viewport: { width: 500, height: 500 } });

test('should work', async ({ mount }) => {
  const changes = [];

  const component = await mount(Counter, {
    props: {
      units: 's',
    },
    on: {
      changed: c => changes.push(c)
    }
  });

  const increment = component.locator('button[aria-label*=Increase]');
  const decrement = component.locator('button[aria-label*=Decrease]');
  await expect(component).toContainText('0s');

  await increment.click();
  await expect(component).toContainText('1s');
  expect(changes).toEqual([{ count: 1 }]);

  await increment.click();
  await expect(component).toContainText('2s');
  expect(changes).toEqual([{ count: 1 }, { count: 2 }]);

  await decrement.click();
  await expect(component).toContainText('1s');
  expect(changes).toEqual([{ count: 1 }, { count: 2 }, { count: 1 }]);
});
