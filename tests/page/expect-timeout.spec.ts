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

test('should print element not found', async ({ page }) => {
  await page.setContent('<div id=node>Text content</div>');
  const error = await expect(page.locator('no-such-thing')).toHaveText('hey', { timeout: 1000 }).catch(e => e);
  expect(stripAnsi(error.message)).toContain(`expect(locator).toHaveText(expected) failed

Locator: locator('no-such-thing')
Expected: "hey"
Timeout: 1000ms
Error: element(s) not found

Call log:
`);
});

test('should print timed out error message when value does not match', async ({ page }) => {
  await page.setContent('<div id=node>Text content</div>');
  const error = await expect(page.locator('div')).toHaveText('hey', { timeout: 1000 }).catch(e => e);
  expect(stripAnsi(error.message)).toContain(`expect(locator).toHaveText(expected) failed

Locator:  locator('div')
Expected: "hey"
Received: "Text content"
Timeout:  1000ms

Call log:
`);
});

test('should print timed out error message with impossible timeout', async ({ page }) => {
  await page.setContent('<div id=node>Text content</div>');
  const error = await expect(page.locator('no-such-thing')).toHaveText('hey', { timeout: 1 }).catch(e => e);
  expect(stripAnsi(error.message)).toContain(`expect(locator).toHaveText(expected) failed

Locator: locator('no-such-thing')
Expected: "hey"
Timeout: 1ms
Error: element(s) not found

Call log:`);
});

test('should print timed out error message when value does not match with impossible timeout', async ({ page }) => {
  await page.setContent('<div id=node>Text content</div>');
  const error = await expect(page.locator('div')).toHaveText('hey', { timeout: 1 }).catch(e => e);
  expect(stripAnsi(error.message)).toContain(`expect(locator).toHaveText(expected) failed

Locator:  locator('div')
Expected: "hey"
Received: "Text content"
Timeout:  1ms

Call log:
`);
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

Locator:  locator('span')
Expected: "bye"
Received: ""
Timeout:  3000ms

Call log:
`);
  expect(error.message).toContain(`locator handler has finished, waiting for locator('div') to be hidden`);
  expect(error.message).toContain(`locator resolved to visible <div>hello</div>`);
});

test('should not miss element that appears between retries before the deadline', async ({ page }) => {
  await page.setContent(`<div id="target" style="display:none">content</div>`);
  await page.evaluate(() => {
    window.builtins.setTimeout(() => {
      document.getElementById('target')!.style.display = 'block';
    }, 1500);
  });
  await expect(page.locator('#target')).toBeVisible({ timeout: 1800 });
});

test('should fail like a timeout when the signal is aborted mid-assertion', async ({ page }) => {
  await page.setContent('<div>content</div>');
  const controller = new AbortController();
  const promise = expect(page.locator('span')).toBeVisible({ timeout: 5000, signal: controller.signal }).catch(e => e);
  await page.waitForTimeout(500);
  controller.abort(new Error('stop it'));
  const error = await promise;
  expect(error.name).not.toBe('AbortError');
  expect(stripAnsi(error.message)).toContain(`expect(locator).toBeVisible() failed

Locator: locator('span')
Expected: visible
Error: The assertion was aborted

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('span')`);
});

test('should fail like a timeout when toHaveText is aborted mid-assertion', async ({ page }) => {
  await page.setContent('<div>content</div>');
  const controller = new AbortController();
  const promise = expect(page.locator('span')).toHaveText('missing', { timeout: 5000, signal: controller.signal }).catch(e => e);
  await page.waitForTimeout(300);
  controller.abort(new Error('stop it'));
  const error = await promise;
  expect(error.name).not.toBe('AbortError');
  expect(stripAnsi(error.message)).toContain(`expect(locator).toHaveText(expected) failed`);
});

test('should fail like a timeout when toHaveCount is aborted mid-assertion', async ({ page }) => {
  await page.setContent('<div>content</div>');
  const controller = new AbortController();
  const promise = expect(page.locator('span')).toHaveCount(3, { timeout: 5000, signal: controller.signal }).catch(e => e);
  await page.waitForTimeout(300);
  controller.abort(new Error('stop it'));
  const error = await promise;
  expect(error.name).not.toBe('AbortError');
  expect(stripAnsi(error.message)).toContain(`expect(locator).toHaveCount(expected) failed`);
});

test('should fail like a timeout when toMatchAriaSnapshot is aborted mid-assertion', async ({ page }) => {
  await page.setContent('<div>content</div>');
  const controller = new AbortController();
  const promise = expect(page.locator('body')).toMatchAriaSnapshot(`- list`, { timeout: 5000, signal: controller.signal }).catch(e => e);
  await page.waitForTimeout(300);
  controller.abort(new Error('stop it'));
  const error = await promise;
  expect(error.name).not.toBe('AbortError');
  expect(stripAnsi(error.message)).toContain(`expect(locator).toMatchAriaSnapshot(expected) failed`);
});

test('should fail like a timeout when toHaveURL is aborted mid-assertion', async ({ page }) => {
  await page.setContent('<div>content</div>');
  const controller = new AbortController();
  const promise = expect(page).toHaveURL('https://example.com/', { timeout: 5000, signal: controller.signal }).catch(e => e);
  await page.waitForTimeout(500);
  controller.abort(new Error('stop it'));
  const error = await promise;
  expect(error.name).not.toBe('AbortError');
  expect(stripAnsi(error.message)).toContain(`expect(page).toHaveURL(expected) failed`);
});

test('should fail the assertion when the signal is already aborted', async ({ page, server }) => {
  await page.setContent('<div>content</div>');
  {
    const controller = new AbortController();
    controller.abort(new Error('already aborted'));
    const error = await expect(page.locator('div')).toBeVisible({ timeout: 5000, signal: controller.signal }).catch(e => e);
    expect(error.name).not.toBe('AbortError');
    expect(stripAnsi(error.message)).toContain(`expect(locator).toBeVisible() failed

Locator: locator('div')
Expected: visible
Error: The assertion was aborted`);
  }
  {
    const controller = new AbortController();
    controller.abort('stop it');
    const error = await expect(page).toHaveURL(server.EMPTY_PAGE, { timeout: 5000, signal: controller.signal }).catch(e => e);
    expect(error.name).not.toBe('AbortError');
    expect(stripAnsi(error.message)).toContain(`expect(page).toHaveURL(expected) failed

Expected: ${JSON.stringify(server.EMPTY_PAGE)}
Error: The assertion was aborted`);
  }
});
