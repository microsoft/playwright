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

import { test as it, expect } from './pageTest';
import { attachFrame } from '../config/utils';

it('should work', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  await attachFrame(page, 'frame1', server.EMPTY_PAGE);
  const elementHandle = await page.$('#frame1');
  const frame = await elementHandle.contentFrame();
  expect(frame).toBe(page.frames()[1]);
});

it('should work for cross-process iframes', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  await attachFrame(page, 'frame1', server.CROSS_PROCESS_PREFIX + '/empty.html');
  const elementHandle = await page.$('#frame1');
  const frame = await elementHandle.contentFrame();
  expect(frame).toBe(page.frames()[1]);
});

it('should work for cross-frame evaluations', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  await attachFrame(page, 'frame1', server.EMPTY_PAGE);
  const frame = page.frames()[1];
  const elementHandle = await frame.evaluateHandle(() => window.top.document.querySelector('#frame1'));
  expect(await elementHandle.contentFrame()).toBe(frame);
});

it('should return null for non-iframes', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  await attachFrame(page, 'frame1', server.EMPTY_PAGE);
  const frame = page.frames()[1];
  const elementHandle = await frame.evaluateHandle(() => document.body);
  expect(await elementHandle.contentFrame()).toBe(null);
});

it('should return null for document.documentElement', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  await attachFrame(page, 'frame1', server.EMPTY_PAGE);
  const frame = page.frames()[1];
  const elementHandle = await frame.evaluateHandle(() => document.documentElement);
  expect(await elementHandle.contentFrame()).toBe(null);
});
