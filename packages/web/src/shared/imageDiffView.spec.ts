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

import { expect, test } from '@playwright/test';

import type { Default } from './imageDiffView.story';

test.use({ viewport: { width: 1000, height: 800 } });

test('should render links', async ({ mount }) => {
  const component = await mount<typeof Default>('shared/imageDiffView/Default');
  await expect(component.locator('a')).toHaveText([
    'screenshot-diff.png',
    'screenshot-actual.png',
    'screenshot-expected.png',
  ]);
});

test('should show diff by default', async ({ mount }) => {
  const component = await mount<typeof Default>('shared/imageDiffView/Default');
  const image = component.locator('img');
  const box = await image.boundingBox();
  expect(box).toEqual(expect.objectContaining({ width: 48, height: 48 }));
});
