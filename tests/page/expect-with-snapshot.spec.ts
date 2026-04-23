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

test.describe('containment matchers print full element subtree', () => {
  test('toHaveText failure includes full element subtree', async ({ page }) => {
    await page.setContent(`<section id=node><h1>Title</h1><p>Body</p></section>`);
    const error = await expect(page.locator('#node')).toHaveText('nope', { timeout: 1000 }).catch(e => e);
    const message = stripAnsi(error.message);
    expect(message).toContain('Aria snapshot:');
    expect(message).toContain('heading "Title"');
    expect(message).toContain('paragraph');
    expect(message).toContain('Body');
  });

  test('toContainText failure includes full element subtree', async ({ page }) => {
    await page.setContent(`<section id=node><h1>Title</h1><p>Body</p></section>`);
    const error = await expect(page.locator('#node')).toContainText('nope', { timeout: 1000 }).catch(e => e);
    const message = stripAnsi(error.message);
    expect(message).toContain('Aria snapshot:');
    expect(message).toContain('heading "Title"');
    expect(message).toContain('Body');
  });
});

test.describe('property matchers print only the element line', () => {
  test('toBeChecked failure prints just the input', async ({ page }) => {
    await page.setContent(`<label><input id=cb type=checkbox> a checkbox</label>`);
    const error = await expect(page.locator('#cb')).toBeChecked({ timeout: 1000 }).catch(e => e);
    const message = stripAnsi(error.message);
    expect(message).toContain('Aria snapshot:');
    expect(message).toContain('checkbox');
  });

  test('toHaveAttribute failure clips descendant subtree', async ({ page }) => {
    await page.setContent(`<ul id=lst><li><h2>HeadingMarker</h2><p>BodyMarker</p></li></ul>`);
    const error = await expect(page.locator('#lst')).toHaveAttribute('data-x', 'yes', { timeout: 1000 }).catch(e => e);
    const message = stripAnsi(error.message);
    expect(message).toContain('Aria snapshot:');
    expect(message).toContain('list');
    expect(message).toContain('listitem');
    // Property matcher caps depth at 1 — content inside the listitem (depth 2) must not appear.
    expect(message).not.toContain('HeadingMarker');
    expect(message).not.toContain('BodyMarker');
  });

  test('toHaveRole failure prints just the element line', async ({ page }) => {
    await page.setContent(`<button id=btn>Hi<span>nested</span></button>`);
    const error = await expect(page.locator('#btn')).toHaveRole('link', { timeout: 1000 }).catch(e => e);
    const message = stripAnsi(error.message);
    expect(message).toContain('Aria snapshot:');
    expect(message).toContain('button');
  });

  test('toHaveValue failure prints the input element', async ({ page }) => {
    await page.setContent(`<input id=inp value="actual">`);
    const error = await expect(page.locator('#inp')).toHaveValue('expected', { timeout: 1000 }).catch(e => e);
    const message = stripAnsi(error.message);
    expect(message).toContain('Aria snapshot:');
    expect(message).toContain('textbox');
  });

  test('toHaveCSS failure prints the element line', async ({ page }) => {
    await page.setContent(`<button id=btn style="color: red">Press</button>`);
    const error = await expect(page.locator('#btn')).toHaveCSS('color', 'rgb(0, 0, 0)', { timeout: 1000 }).catch(e => e);
    const message = stripAnsi(error.message);
    expect(message).toContain('Aria snapshot:');
    expect(message).toContain('button');
  });
});

test.describe('hidden or missing elements print full page snapshot', () => {
  test('toBeVisible on hidden element prints full page snapshot', async ({ page }) => {
    await page.setContent(`
      <div id=hidden style="display: none"><span>secret</span></div>
      <main><h1>Page Heading</h1></main>
    `);
    const error = await expect(page.locator('#hidden')).toBeVisible({ timeout: 1000 }).catch(e => e);
    const message = stripAnsi(error.message);
    expect(message).toContain('Aria snapshot:');
    // Page-wide context, not the empty hidden element snapshot.
    expect(message).toContain('heading "Page Heading"');
  });

  test('toBeVisible on missing element prints full page snapshot', async ({ page }) => {
    await page.setContent(`<header><h1>Hello</h1></header>`);
    const error = await expect(page.locator('#nope')).toBeVisible({ timeout: 1000 }).catch(e => e);
    const message = stripAnsi(error.message);
    expect(message).toContain('Aria snapshot:');
    expect(message).toContain('heading "Hello"');
  });

  test('toHaveText on missing element prints full page snapshot', async ({ page }) => {
    await page.setContent(`<main><h1>Hello</h1></main>`);
    const error = await expect(page.locator('#missing')).toHaveText('x', { timeout: 1000 }).catch(e => e);
    const message = stripAnsi(error.message);
    expect(message).toContain('Aria snapshot:');
    expect(message).toContain('heading "Hello"');
  });

  test('toHaveTitle failure prints full page snapshot', async ({ page }) => {
    await page.setContent(`<title>Right</title><main><h1>Body Heading</h1></main>`);
    const error = await expect(page).toHaveTitle('Wrong', { timeout: 1000 }).catch(e => e);
    const message = stripAnsi(error.message);
    expect(message).toContain('Aria snapshot:');
    expect(message).toContain('heading "Body Heading"');
  });
});

test.describe('matchers that should not include an aria snapshot', () => {
  test('toHaveCount failure has no aria snapshot', async ({ page }) => {
    await page.setContent(`<ul><li>a</li><li>b</li></ul>`);
    const error = await expect(page.locator('li')).toHaveCount(5, { timeout: 1000 }).catch(e => e);
    expect(stripAnsi(error.message)).not.toContain('Aria snapshot:');
  });

  test('toHaveText with array has no aria snapshot', async ({ page }) => {
    await page.setContent(`<ul><li>x</li><li>y</li></ul>`);
    const error = await expect(page.locator('li')).toHaveText(['a', 'b', 'c'], { timeout: 1000 }).catch(e => e);
    expect(stripAnsi(error.message)).not.toContain('Aria snapshot:');
  });

  test('toMatchAriaSnapshot failure has no extra aria snapshot section', async ({ page }) => {
    await page.setContent(`<button id=btn>Y</button>`);
    const error = await expect(page.locator('#btn')).toMatchAriaSnapshot(`- button "X"`, { timeout: 1000 }).catch(e => e);
    expect(stripAnsi(error.message)).not.toContain('Aria snapshot:');
  });
});
