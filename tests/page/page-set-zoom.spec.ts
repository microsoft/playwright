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

import { test as it, expect } from './pageTest';

it('should set zoom to 200%', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/grid.html');
  await page.setZoom(2);
  // At 200% zoom, the visual viewport should be smaller.
  const innerWidth = await page.evaluate(() => window.innerWidth);
  const viewportSize = page.viewportSize()!;
  // At 2x zoom, the innerWidth should be roughly half the viewport width.
  expect(innerWidth).toBeLessThanOrEqual(viewportSize.width / 1.5);
});

it('should set zoom to 50%', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/grid.html');
  await page.setZoom(0.5);
  // At 50% zoom, the visual viewport should be larger.
  const innerWidth = await page.evaluate(() => window.innerWidth);
  const viewportSize = page.viewportSize()!;
  // At 0.5x zoom, the innerWidth should be roughly double the viewport width.
  expect(innerWidth).toBeGreaterThanOrEqual(viewportSize.width * 1.5);
});

it('should reset zoom to default', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/grid.html');
  const originalWidth = await page.evaluate(() => window.innerWidth);
  await page.setZoom(2);
  await page.setZoom(1);
  const resetWidth = await page.evaluate(() => window.innerWidth);
  expect(resetWidth).toBe(originalWidth);
});

it('should affect layout at 150% zoom', async ({ page, server }) => {
  await page.setViewportSize({ width: 800, height: 600 });
  await page.goto(server.PREFIX + '/grid.html');
  const originalWidth = await page.evaluate(() => window.innerWidth);
  await page.setZoom(1.5);
  const zoomedWidth = await page.evaluate(() => window.innerWidth);
  // Zooming in shrinks the effective viewport.
  expect(zoomedWidth).toBeLessThan(originalWidth);
});
