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

import type { Default } from './splitView.story';

test.use({ viewport: { width: 500, height: 500 } });

test('should render', async ({ mount }) => {
  const component = await mount<typeof Default>('components/splitView/Default');
  const mainBox = await component.locator('#main').boundingBox();
  const sidebarBox = await component.locator('#sidebar').boundingBox();
  expect.soft(mainBox).toEqual({ x: 0, y: 0, width: 500, height: 400 });
  expect.soft(sidebarBox).toEqual({ x: 0, y: 401, width: 500, height: 99 });
});

test('should render sidebar first', async ({ mount }) => {
  const component = await mount<typeof Default>('components/splitView/Default', { sidebarIsFirst: true });
  const mainBox = await component.locator('#main').boundingBox();
  const sidebarBox = await component.locator('#sidebar').boundingBox();
  expect.soft(mainBox).toEqual({ x: 0, y: 100, width: 500, height: 400 });
  expect.soft(sidebarBox).toEqual({ x: 0, y: 0, width: 500, height: 99 });
});

test('should render horizontal split', async ({ mount }) => {
  const component = await mount<typeof Default>('components/splitView/Default', { sidebarIsFirst: true, orientation: 'horizontal' });
  const mainBox = await component.locator('#main').boundingBox();
  const sidebarBox = await component.locator('#sidebar').boundingBox();
  expect.soft(mainBox).toEqual({ x: 100, y: 0, width: 400, height: 500 });
  expect.soft(sidebarBox).toEqual({ x: 0, y: 0, width: 99, height: 500 });
});

test('should hide sidebar', async ({ mount }) => {
  const component = await mount<typeof Default>('components/splitView/Default', { orientation: 'horizontal', sidebarHidden: true });
  const mainBox = await component.locator('#main').boundingBox();
  expect.soft(mainBox).toEqual({ x: 0, y: 0, width: 500, height: 500 });
});

test('drag resize', async ({ page, mount }) => {
  const component = await mount<typeof Default>('components/splitView/Default');
  await page.mouse.move(25, 400);
  await page.mouse.down();
  await page.mouse.move(25, 100);
  await page.mouse.up();
  const mainBox = await component.locator('#main').boundingBox();
  const sidebarBox = await component.locator('#sidebar').boundingBox();
  expect.soft(mainBox).toEqual({ x: 0, y: 0, width: 500, height: 100 });
  expect.soft(sidebarBox).toEqual({ x: 0, y: 101, width: 500, height: 399 });
});
