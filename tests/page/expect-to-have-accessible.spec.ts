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

import { test, expect } from './pageTest';

test('EX-259 toHaveAccessibleName', async ({ page }) => {
  await page.setContent(`
    <div role="button" aria-label="Hello"></div>
  `);
  await expect(page.locator('div')).toHaveAccessibleName('Hello');
  await expect(page.locator('div')).not.toHaveAccessibleName('hello');
  await expect(page.locator('div')).toHaveAccessibleName('hello', { ignoreCase: true });
  await expect(page.locator('div')).toHaveAccessibleName(/ell\w/);
  await expect(page.locator('div')).not.toHaveAccessibleName(/hello/);
  await expect(page.locator('div')).toHaveAccessibleName(/hello/, { ignoreCase: true });

  await page.setContent(`<button>foo&nbsp;bar\nbaz</button>`);
  await expect(page.locator('button')).toHaveAccessibleName('foo bar baz');

  await page.setContent(`
    <select>
      <option>&nbsp;HTML</option>
    </select>
  `);
  await expect(page.locator('option')).toHaveAccessibleName('HTML');
});

test('EX-260 toHaveAccessibleDescription', async ({ page }) => {
  await page.setContent(`
    <div role="button" aria-description="Hello"></div>
  `);
  await expect(page.locator('div')).toHaveAccessibleDescription('Hello');
  await expect(page.locator('div')).not.toHaveAccessibleDescription('hello');
  await expect(page.locator('div')).toHaveAccessibleDescription('hello', { ignoreCase: true });
  await expect(page.locator('div')).toHaveAccessibleDescription(/ell\w/);
  await expect(page.locator('div')).not.toHaveAccessibleDescription(/hello/);
  await expect(page.locator('div')).toHaveAccessibleDescription(/hello/, { ignoreCase: true });

  await page.setContent(`
    <div role="button" aria-describedby="desc"></div>
    <span id="desc">foo&nbsp;bar\nbaz</span>
  `);
  await expect(page.locator('div')).toHaveAccessibleDescription('foo bar baz');
});

test('EX-261 toHaveAccessibleErrorMessage', async ({ page }) => {
  await page.setContent(`
    <form>
      <input role="textbox" aria-invalid="true" aria-errormessage="error-message" />
      <div id="error-message">Hello</div>
      <div id="irrelevant-error">This should not be considered.</div>
    </form>
  `);

  const locator = page.locator('input[role="textbox"]');
  await expect(locator).toHaveAccessibleErrorMessage('Hello');
  await expect(locator).not.toHaveAccessibleErrorMessage('hello');
  await expect(locator).toHaveAccessibleErrorMessage('hello', { ignoreCase: true });
  await expect(locator).toHaveAccessibleErrorMessage(/ell\w/);
  await expect(locator).not.toHaveAccessibleErrorMessage(/hello/);
  await expect(locator).toHaveAccessibleErrorMessage(/hello/, { ignoreCase: true });
  await expect(locator).not.toHaveAccessibleErrorMessage('This should not be considered.');
});

test('EX-262 toHaveAccessibleErrorMessage should handle multiple aria-errormessage references', async ({ page }) => {
  await page.setContent(`
    <form>
      <input role="textbox" aria-invalid="true" aria-errormessage="error1 error2" />
      <div id="error1">First error message.</div>
      <div id="error2">Second error message.</div>
      <div id="irrelevant-error">This should not be considered.</div>
    </form>
  `);

  const locator = page.locator('input[role="textbox"]');

  await expect(locator).toHaveAccessibleErrorMessage('First error message. Second error message.');
  await expect(locator).toHaveAccessibleErrorMessage(/first error message./i);
  await expect(locator).toHaveAccessibleErrorMessage(/second error message./i);
  await expect(locator).not.toHaveAccessibleErrorMessage(/This should not be considered./i);
});

test.describe('toHaveAccessibleErrorMessage should handle aria-invalid attribute', () => {
  const errorMessageText = 'Error message';

  async function setupPage(page, ariaInvalidValue: string | null) {
    const ariaInvalidAttr = ariaInvalidValue === null ? '' : `aria-invalid="${ariaInvalidValue}"`;
    await page.setContent(`
        <form>
          <input id="node" role="textbox" ${ariaInvalidAttr} aria-errormessage="error-msg" />
          <div id="error-msg">${errorMessageText}</div>
        </form>
      `);
    return page.locator('#node');
  }

  test.describe('evaluated in false', () => {
    test('EX-263 no aria-invalid attribute', async ({ page }) => {
      const locator = await setupPage(page, null);
      await expect(locator).not.toHaveAccessibleErrorMessage(errorMessageText);
    });
    test('EX-264 aria-invalid="false"', async ({ page }) => {
      const locator = await setupPage(page, 'false');
      await expect(locator).not.toHaveAccessibleErrorMessage(errorMessageText);
    });
    test('EX-265 aria-invalid="" (empty string)', async ({ page }) => {
      const locator = await setupPage(page, '');
      await expect(locator).not.toHaveAccessibleErrorMessage(errorMessageText);
    });
  });
  test.describe('evaluated in true', () => {
    test('EX-266 aria-invalid="true"', async ({ page }) => {
      const locator = await setupPage(page, 'true');
      await expect(locator).toHaveAccessibleErrorMessage(errorMessageText);
    });
    test('EX-267 aria-invalid="foo" (unrecognized value)', async ({ page }) => {
      const locator = await setupPage(page, 'foo');
      await expect(locator).toHaveAccessibleErrorMessage(errorMessageText);
    });
  });
});

const errorMessageText = 'Error message';

test('EX-268 should show error message when validity is false and aria-invalid is true', async ({ page }) => {
  await page.setContent(`
    <form>
      <input id="node" role="textbox" type="number" min="1" max="100" aria-invalid="true" aria-errormessage="error-msg" />
      <div id="error-msg">${errorMessageText}</div>
    </form>
  `);
  const locator = page.locator('#node');
  await locator.fill('101');
  await expect(locator).toHaveAccessibleErrorMessage(errorMessageText);
});

test('EX-269 should show error message when validity is true and aria-invalid is true', async ({ page }) => {
  await page.setContent(`
    <form>
      <input id="node" role="textbox" type="number" min="1" max="100" aria-invalid="true" aria-errormessage="error-msg" />
      <div id="error-msg">${errorMessageText}</div>
    </form>
  `);
  const locator = page.locator('#node');
  await locator.fill('99');
  await expect(locator).toHaveAccessibleErrorMessage(errorMessageText);
});

test('EX-270 should show error message when validity is false and aria-invalid is false', async ({ page }) => {
  await page.setContent(`
    <form>
      <input id="node" role="textbox" type="number" min="1" max="100" aria-invalid="false" aria-errormessage="error-msg" />
      <div id="error-msg">${errorMessageText}</div>
    </form>
  `);
  const locator = page.locator('#node');
  await locator.fill('101');
  await expect(locator).toHaveAccessibleErrorMessage(errorMessageText);
});

test('EX-271 should not show error message when validity is true and aria-invalid is false', async ({ page }) => {
  await page.setContent(`
    <form>
      <input id="node" role="textbox" type="number" min="1" max="100" aria-invalid="false" aria-errormessage="error-msg" />
      <div id="error-msg">${errorMessageText}</div>
    </form>
  `);
  const locator = page.locator('#node');
  await locator.fill('99');
  await expect(locator).not.toHaveAccessibleErrorMessage(errorMessageText);
});

test('EX-272 should show error message for all roles', async ({ page }) => {
  await page.setContent(`
    <label for="file">File input</label>
    <input id="file" aria-invalid="true" aria-errormessage="file-error-id" type="file" />
    <p id="file-error-id" role="alert">File is incorrect</p>
  `);
  const locator = page.getByLabel('File input');
  await expect(locator).toHaveAccessibleErrorMessage('File is incorrect');
});

test('EX-273 toHaveRole', async ({ page }) => {
  await page.setContent(`<div role="button">Button!</div>`);
  await expect(page.locator('div')).toHaveRole('button');
  await expect(page.locator('div')).not.toHaveRole('checkbox');
  try {
    // @ts-expect-error
    await expect(page.locator('div')).toHaveRole(/button|checkbox/);
    expect(1, 'Must throw when given a regular expression').toBe(2);
  } catch (error) {
    expect(error.message).toBe(`"role" argument in toHaveRole must be a string`);
  }
});
