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

test('toMatchText-based assertions should have matcher result', async ({ page }) => {
  await page.setContent('<div id=node>Text content</div>');
  const locator = page.locator('#node');

  {
    const e = await expect(locator).toHaveText(/Text2/, { timeout: 1 }).catch(e => e);
    e.matcherResult.message = stripAnsi(e.matcherResult.message);
    expect.soft(e.matcherResult).toEqual({
      actual: 'Text content',
      expected: /Text2/,
      message: expect.stringContaining(`Timed out 1ms waiting for expect(locator).toHaveText(expected)`),
      name: 'toHaveText',
      pass: false,
      log: expect.any(Array),
      timeout: 1,
    });

    expect.soft(stripAnsi(e.toString())).toContain(`Error: Timed out 1ms waiting for expect(locator).toHaveText(expected)

Locator: locator('#node')
Expected pattern: /Text2/
Received string:  \"Text content\"
Call log`);

  }

  {
    const e = await expect(locator).not.toHaveText(/Text/, { timeout: 1 }).catch(e => e);
    e.matcherResult.message = stripAnsi(e.matcherResult.message);
    expect.soft(e.matcherResult).toEqual({
      actual: 'Text content',
      expected: /Text/,
      message: expect.stringContaining(`Timed out 1ms waiting for expect(locator).not.toHaveText(expected)`),
      name: 'toHaveText',
      pass: true,
      log: expect.any(Array),
      timeout: 1,
    });
    expect.soft(stripAnsi(e.toString())).toContain(`Error: Timed out 1ms waiting for expect(locator).not.toHaveText(expected)

Locator: locator('#node')
Expected pattern: not /Text/
Received string: \"Text content\"
Call log`);

  }

});

test('toBeTruthy-based assertions should have matcher result', async ({ page }) => {
  await page.setContent('<div id=node>Text content</div>');

  {
    const e = await expect(page.locator('#node2')).toBeVisible({ timeout: 1 }).catch(e => e);
    e.matcherResult.message = stripAnsi(e.matcherResult.message);
    expect.soft(e.matcherResult).toEqual({
      actual: 'hidden',
      expected: 'visible',
      message: expect.stringContaining(`Timed out 1ms waiting for expect(locator).toBeVisible()`),
      name: 'toBeVisible',
      pass: false,
      log: expect.any(Array),
      timeout: 1,
    });

    expect.soft(stripAnsi(e.toString())).toContain(`Error: Timed out 1ms waiting for expect(locator).toBeVisible()

Locator: locator('#node2')
Expected: visible
Received: <element(s) not found>
Call log`);

  }

  {
    const e = await expect(page.locator('#node')).not.toBeVisible({ timeout: 1 }).catch(e => e);
    e.matcherResult.message = stripAnsi(e.matcherResult.message);
    expect.soft(e.matcherResult).toEqual({
      actual: 'visible',
      expected: 'visible',
      message: expect.stringContaining(`Timed out 1ms waiting for expect(locator).not.toBeVisible()`),
      name: 'toBeVisible',
      pass: true,
      log: expect.any(Array),
      timeout: 1,
    });

    expect.soft(stripAnsi(e.toString())).toContain(`Error: Timed out 1ms waiting for expect(locator).not.toBeVisible()

Locator: locator('#node')
Expected: not visible
Received: visible
Call log`);

  }
});

test('toEqual-based assertions should have matcher result', async ({ page }) => {
  await page.setContent('<div id=node>Text content</div>');

  {
    const e = await expect(page.locator('#node2')).toHaveCount(1, { timeout: 1 }).catch(e => e);
    e.matcherResult.message = stripAnsi(e.matcherResult.message);
    expect.soft(e.matcherResult).toEqual({
      actual: 0,
      expected: 1,
      message: expect.stringContaining(`Timed out 1ms waiting for expect(locator).toHaveCount(expected)`),
      name: 'toHaveCount',
      pass: false,
      log: expect.any(Array),
      timeout: 1,
    });

    expect.soft(stripAnsi(e.toString())).toContain(`Error: Timed out 1ms waiting for expect(locator).toHaveCount(expected)

Locator: locator('#node2')
Expected: 1
Received: 0
Call log`);
  }

  {
    const e = await expect(page.locator('#node')).not.toHaveCount(1, { timeout: 1 }).catch(e => e);
    e.matcherResult.message = stripAnsi(e.matcherResult.message);
    expect.soft(e.matcherResult).toEqual({
      actual: 1,
      expected: 1,
      message: expect.stringContaining(`Timed out 1ms waiting for expect(locator).not.toHaveCount(expected)`),
      name: 'toHaveCount',
      pass: true,
      log: expect.any(Array),
      timeout: 1,
    });

    expect.soft(stripAnsi(e.toString())).toContain(`Error: Timed out 1ms waiting for expect(locator).not.toHaveCount(expected)

Locator: locator('#node')
Expected: not 1
Received: 1
Call log`);

  }
});

test('toBeChecked({ checked: false }) should have expected: false', async ({ page }) => {
  await page.setContent(`
    <input id=checked type=checkbox checked></input>
    <input id=unchecked type=checkbox></input>
  `);

  {
    const e = await expect(page.locator('#unchecked')).toBeChecked({ timeout: 1 }).catch(e => e);
    e.matcherResult.message = stripAnsi(e.matcherResult.message);
    expect.soft(e.matcherResult).toEqual({
      actual: 'unchecked',
      expected: 'checked',
      message: expect.stringContaining(`Timed out 1ms waiting for expect(locator).toBeChecked()`),
      name: 'toBeChecked',
      pass: false,
      log: expect.any(Array),
      timeout: 1,
    });

    expect.soft(stripAnsi(e.toString())).toContain(`Error: Timed out 1ms waiting for expect(locator).toBeChecked()

Locator: locator('#unchecked')
Expected: checked
Received: unchecked
Call log`);

  }

  {
    const e = await expect(page.locator('#checked')).not.toBeChecked({ timeout: 1 }).catch(e => e);
    e.matcherResult.message = stripAnsi(e.matcherResult.message);
    expect.soft(e.matcherResult).toEqual({
      actual: 'checked',
      expected: 'checked',
      message: expect.stringContaining(`Timed out 1ms waiting for expect(locator).not.toBeChecked()`),
      name: 'toBeChecked',
      pass: true,
      log: expect.any(Array),
      timeout: 1,
    });

    expect.soft(stripAnsi(e.toString())).toContain(`Error: Timed out 1ms waiting for expect(locator).not.toBeChecked()

Locator: locator('#checked')
Expected: not checked
Received: checked
Call log`);

  }

  {
    const e = await expect(page.locator('#checked')).toBeChecked({ checked: false, timeout: 1 }).catch(e => e);
    e.matcherResult.message = stripAnsi(e.matcherResult.message);
    expect.soft(e.matcherResult).toEqual({
      actual: 'checked',
      expected: 'unchecked',
      message: expect.stringContaining(`Timed out 1ms waiting for expect(locator).toBeChecked({ checked: false })`),
      name: 'toBeChecked',
      pass: false,
      log: expect.any(Array),
      timeout: 1,
    });

    expect.soft(stripAnsi(e.toString())).toContain(`Error: Timed out 1ms waiting for expect(locator).toBeChecked({ checked: false })

Locator: locator('#checked')
Expected: unchecked
Received: checked
Call log`);

  }

  {
    const e = await expect(page.locator('#unchecked')).not.toBeChecked({ checked: false, timeout: 1 }).catch(e => e);
    e.matcherResult.message = stripAnsi(e.matcherResult.message);
    expect.soft(e.matcherResult).toEqual({
      actual: 'unchecked',
      expected: 'unchecked',
      message: expect.stringContaining(`Timed out 1ms waiting for expect(locator).not.toBeChecked({ checked: false })`),
      name: 'toBeChecked',
      pass: true,
      log: expect.any(Array),
      timeout: 1,
    });

    expect.soft(stripAnsi(e.toString())).toContain(`Error: Timed out 1ms waiting for expect(locator).not.toBeChecked({ checked: false })

Locator: locator('#unchecked')
Expected: not unchecked
Received: unchecked
Call log`);

  }
});

test('toHaveScreenshot should populate matcherResult', async ({ page, server, isAndroid }) => {
  test.skip(isAndroid);
  await page.setViewportSize({ width: 500, height: 500 });
  await page.goto(server.EMPTY_PAGE);
  const e = await expect(page).toHaveScreenshot('screenshot-sanity.png').catch(e => e);
  e.matcherResult.message = stripAnsi(e.matcherResult.message);

  expect.soft(e.matcherResult).toEqual({
    actual: expect.stringContaining('screenshot-sanity-actual'),
    expected: expect.stringContaining('screenshot-sanity-'),
    diff: expect.stringContaining('screenshot-sanity-diff'),
    message: expect.stringContaining(`Screenshot comparison failed`),
    name: 'toHaveScreenshot',
    pass: false,
    log: expect.any(Array),
  });

  expect.soft(stripAnsi(e.toString())).toContain(`Error: Screenshot comparison failed:

  23362 pixels (ratio 0.10 of all image pixels) are different.

Expected:`);
});
