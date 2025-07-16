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

import { stripAnsi } from '../config/utils';
import { test, expect } from './pageTest';

test('should print timed out error message', async ({ page }) => {
  await page.setContent('<div id=node>Text content</div>');
  const error = await expect(page.locator('no-such-thing')).toHaveText('hey', { timeout: 1000 }).catch(e => e);
  expect(stripAnsi(error.message)).toContain(`expect(locator).toHaveText(expected) failed

Locator: locator('no-such-thing')
Expected string: "hey"
Received: <element(s) not found>
Timeout: 1000ms`);
});

test('should print timed out error message when value does not match', async ({ page }) => {
  await page.setContent('<div id=node>Text content</div>');
  const error = await expect(page.locator('div')).toHaveText('hey', { timeout: 1000 }).catch(e => e);
  expect(stripAnsi(error.message)).toContain(`expect(locator).toHaveText(expected) failed

Locator: locator('div')
Expected string: "hey"
Received string: "Text content"
Timeout: 1000ms`);
});

test('should print timed out error message with impossible timeout', async ({ page }) => {
  await page.setContent('<div id=node>Text content</div>');
  const error = await expect(page.locator('no-such-thing')).toHaveText('hey', { timeout: 1 }).catch(e => e);
  expect(stripAnsi(error.message)).toContain(`expect(locator).toHaveText(expected) failed

Locator: locator('no-such-thing')
Expected string: "hey"
Received: <element(s) not found>
Timeout: 1ms`);
});

test('should print timed out error message when value does not match with impossible timeout', async ({ page }) => {
  await page.setContent('<div id=node>Text content</div>');
  const error = await expect(page.locator('div')).toHaveText('hey', { timeout: 1 }).catch(e => e);
  expect(stripAnsi(error.message)).toContain(`expect(locator).toHaveText(expected) failed

Locator: locator('div')
Expected string: "hey"
Received string: "Text content"
Timeout: 1ms`);
});

test('should have timeout error name', async ({ page }) => {
  const error = await page.waitForSelector('#not-found', { timeout: 1 }).catch(e => e);
  expect(error.name).toBe('TimeoutError');
});

test('should not throw when navigating during one-shot check', async ({ page, server }) => {
  await page.setContent(`<div>hello</div>`);
  const promise = expect(page.locator('div')).toHaveText('bye');
  await page.goto(server.EMPTY_PAGE);
  await page.setContent(`<div>bye</div>`);
  await promise;
});

test('should not throw when navigating during first locator handler check', async ({ page, server }) => {
  await page.addLocatorHandler(page.locator('span'), async locator => {});
  await page.setContent(`<div>hello</div>`);
  const promise = expect(page.locator('div')).toHaveText('bye');
  await page.goto(server.EMPTY_PAGE);
  await page.setContent(`<div>bye</div>`);
  await promise;
});

test('should timeout during first locator handler check', async ({ page, server }) => {
  await page.addLocatorHandler(page.locator('div'), async locator => {});
  await page.setContent(`<div>hello</div><span>bye</span>`);
  const error = await expect(page.locator('span')).toHaveText('bye', { timeout: 3000 }).catch(e => e);
  expect(stripAnsi(error.message)).toContain(`expect(locator).toHaveText(expected) failed

Locator: locator('span')
Expected string: "bye"
Received string: ""
Timeout: 3000ms`);
  expect(error.message).toContain(`locator handler has finished, waiting for locator('div') to be hidden`);
  expect(error.message).toContain(`locator resolved to visible <div>hello</div>`);
});
