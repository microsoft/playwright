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

test.describe('toHaveCount', () => {
  test('toHaveCount pass', async ({ page }) => {
    await page.setContent('<select><option>One</option></select>');
    const locator = page.locator('option');
    let done = false;
    const promise = expect(locator).toHaveCount(2).then(() => { done = true; });
    await page.waitForTimeout(1000);
    expect(done).toBe(false);
    await page.setContent('<select><option>One</option><option>Two</option></select>');
    await promise;
    expect(done).toBe(true);
  });

  test('pass zero', async ({ page }) => {
    await page.setContent('<div></div>');
    const locator = page.locator('span');
    await expect(locator).toHaveCount(0);
    await expect(locator).not.toHaveCount(1);
  });

  test('eventually pass zero', async ({ page }) => {
    await page.setContent('<div><span>hello</span></div>');
    const locator = page.locator('span');
    setTimeout(() => page.evaluate(() => document.querySelector('div').textContent = '').catch(() => {}), 200);
    await expect(locator).toHaveCount(0);
    await expect(locator).not.toHaveCount(1);
  });

  test('eventually pass non-zero', async ({ page }) => {
    await page.setContent('<ul></ul>');
    setTimeout(async () => {
      await page.setContent('<ul><li>one</li><li>two</li></ul>');
    }, 500);
    const locator = page.locator('li');
    await expect(locator).toHaveCount(2);
  });

  test('eventually pass not non-zero', async ({ page }) => {
    await page.setContent('<ul><li>one</li><li>two</li></ul>');
    setTimeout(async () => {
      await page.setContent('<ul></ul>');
    }, 500);
    const locator = page.locator('li');
    await expect(locator).not.toHaveCount(2);
  });

  test('fail zero', async ({ page }) => {
    await page.setContent('<div><span></span></div>');
    const locator = page.locator('span');
    const error = await expect(locator).toHaveCount(0, { timeout: 1000 }).catch(e => e);
    expect(error.message).toContain('expect.toHaveCount with timeout 1000ms');
  });

  test('fail zero 2', async ({ page }) => {
    await page.setContent('<div><span></span></div>');
    const locator = page.locator('span');
    const error = await expect(locator).not.toHaveCount(1, { timeout: 1000 }).catch(e => e);
    expect(error.message).toContain('expect.not.toHaveCount with timeout 1000ms');
  });
});

test.describe('toHaveJSProperty', () => {
  test('pass', async ({ page }) => {
    await page.setContent('<div></div>');
    await page.$eval('div', e => (e as any).foo = { a: 1, b: 'string', c: new Date(1627503992000) });
    const locator = page.locator('div');
    await expect(locator).toHaveJSProperty('foo', { a: 1, b: 'string', c: new Date(1627503992000) });
  });

  test('fail', async ({ page }) => {
    await page.setContent('<div></div>');
    await page.$eval('div', e => (e as any).foo = { a: 1, b: 'string', c: new Date(1627503992000) });
    const locator = page.locator('div');
    const error = await expect(locator).toHaveJSProperty('foo', { a: 1, b: 'string', c: new Date(1627503992001) }, { timeout: 1000 }).catch(e => e);
    expect(error.message).toContain(`-   "c"`);
  });

  test('pass string', async ({ page }) => {
    await page.setContent('<div></div>');
    await page.$eval('div', e => (e as any).foo = 'string');
    const locator = page.locator('div');
    await expect(locator).toHaveJSProperty('foo', 'string');
  });

  test('fail string', async ({ page }) => {
    await page.setContent('<div></div>');
    await page.$eval('div', e => (e as any).foo = 'string');
    const locator = page.locator('div');
    const error = await expect(locator).toHaveJSProperty('foo', 'error', { timeout: 200 }).catch(e => e);
    expect(error.message).toContain(`expect.toHaveJSProperty with timeout 200ms`);
  });

  test('pass number', async ({ page }) => {
    await page.setContent('<div></div>');
    await page.$eval('div', e => (e as any).foo = 2021);
    const locator = page.locator('div');
    await expect(locator).toHaveJSProperty('foo', 2021);
  });

  test('fail number', async ({ page }) => {
    await page.setContent('<div></div>');
    await page.$eval('div', e => (e as any).foo = 2021);
    const locator = page.locator('div');
    const error = await expect(locator).toHaveJSProperty('foo', 1, { timeout: 200 }).catch(e => e);
    expect(error.message).toContain(`expect.toHaveJSProperty with timeout 200ms`);
  });

  test('pass boolean', async ({ page }) => {
    await page.setContent('<div></div>');
    await page.$eval('div', e => (e as any).foo = true);
    const locator = page.locator('div');
    await expect(locator).toHaveJSProperty('foo', true);
  });

  test('fail boolean', async ({ page }) => {
    await page.setContent('<div></div>');
    await page.$eval('div', e => (e as any).foo = false);
    const locator = page.locator('div');
    const error = await expect(locator).toHaveJSProperty('foo', true, { timeout: 200 }).catch(e => e);
    expect(error.message).toContain(`expect.toHaveJSProperty with timeout 200ms`);
  });

  test('pass boolean 2', async ({ page }) => {
    await page.setContent('<div></div>');
    await page.$eval('div', e => (e as any).foo = false);
    const locator = page.locator('div');
    await expect(locator).toHaveJSProperty('foo', false);
  });

  test('fail boolean 2', async ({ page }) => {
    await page.setContent('<div></div>');
    await page.$eval('div', e => (e as any).foo = false);
    const locator = page.locator('div');
    const error = await expect(locator).toHaveJSProperty('foo', true, { timeout: 200 }).catch(e => e);
    expect(error.message).toContain(`expect.toHaveJSProperty with timeout 200ms`);
  });

  test('pass undefined', async ({ page }) => {
    await page.setContent('<div></div>');
    const locator = page.locator('div');
    await expect(locator).toHaveJSProperty('foo', undefined);
  });

  test('pass null', async ({ page }) => {
    await page.setContent('<div></div>');
    await page.$eval('div', e => (e as any).foo = null);
    const locator = page.locator('div');
    await expect(locator).toHaveJSProperty('foo', null);
  });
});

test.describe('toHaveClass', () => {
  test('pass', async ({ page }) => {
    await page.setContent('<div class="foo bar baz"></div>');
    const locator = page.locator('div');
    await expect(locator).toHaveClass('foo bar baz');
  });

  test('pass with SVGs', async ({ page }) => {
    await page.setContent(`<svg class="c1 c2" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"></svg>`);
    await expect(page.locator('svg')).toHaveClass(/c1/);
  });

  test('fail', async ({ page }) => {
    await page.setContent('<div class="bar baz"></div>');
    const locator = page.locator('div');
    const error = await expect(locator).toHaveClass('foo bar baz', { timeout: 1000 }).catch(e => e);
    expect(error.message).toContain('expect.toHaveClass with timeout 1000ms');
  });

  test('pass with array', async ({ page }) => {
    await page.setContent('<div class="foo"></div><div class="bar"></div><div class="baz"></div>');
    const locator = page.locator('div');
    await expect(locator).toHaveClass(['foo', 'bar', /[a-z]az/]);
  });

  test('fail with array', async ({ page }) => {
    await page.setContent('<div class="foo"></div><div class="bar"></div><div class="bar"></div>');
    const locator = page.locator('div');
    const error = await expect(locator).toHaveClass(['foo', 'bar', /[a-z]az/], { timeout: 1000 }).catch(e => e);
    expect(error.message).toContain('expect.toHaveClass with timeout 1000ms');
  });
});

test.describe('toHaveTitle', () => {
  test('pass', async ({ page }) => {
    await page.setContent('<title>  Hello     world</title>');
    await expect(page).toHaveTitle('Hello  world');
  });

  test('fail', async ({ page }) => {
    await page.setContent('<title>Bye</title>');
    const error = await expect(page).toHaveTitle('Hello', { timeout: 1000 }).catch(e => e);
    expect(error.message).toContain('expect.toHaveTitle with timeout 1000ms');
  });
});

test.describe('toHaveURL', () => {
  test('pass', async ({ page }) => {
    await page.goto('data:text/html,<div>A</div>');
    await expect(page).toHaveURL('data:text/html,<div>A</div>');
  });

  test('fail', async ({ page }) => {
    await page.goto('data:text/html,<div>B</div>');
    const error = await expect(page).toHaveURL('wrong', { timeout: 1000 }).catch(e => e);
    expect(error.message).toContain('expect.toHaveURL with timeout 1000ms');
  });
});

test.describe('toHaveAttribute', () => {
  test('pass', async ({ page }) => {
    await page.setContent('<div id=node>Text content</div>');
    const locator = page.locator('#node');
    await expect(locator).toHaveAttribute('id', 'node');
  });

  test('should not match missing attribute', async ({ page }) => {
    await page.setContent('<div checked id=node>Text content</div>');
    const locator = page.locator('#node');
    {
      const error = await expect(locator).toHaveAttribute('disabled', '', { timeout: 1000 }).catch(e => e);
      expect(error.message).toContain('expect.toHaveAttribute with timeout 1000ms');
    }
    {
      const error = await expect(locator).toHaveAttribute('disabled', /.*/, { timeout: 1000 }).catch(e => e);
      expect(error.message).toContain('expect.toHaveAttribute with timeout 1000ms');
    }
    await expect(locator).not.toHaveAttribute('disabled', '');
    await expect(locator).not.toHaveAttribute('disabled', /.*/);
  });

  test('should match boolean attribute', async ({ page }) => {
    await page.setContent('<div checked id=node>Text content</div>');
    const locator = page.locator('#node');
    await expect(locator).toHaveAttribute('checked', '');
    await expect(locator).toHaveAttribute('checked', /.*/);
    {
      const error = await expect(locator).not.toHaveAttribute('checked', '', { timeout: 1000 }).catch(e => e);
      expect(error.message).toContain('expect.not.toHaveAttribute with timeout 1000ms');
    }
    {
      const error = await expect(locator).not.toHaveAttribute('checked', /.*/, { timeout: 1000 }).catch(e => e);
      expect(error.message).toContain('expect.not.toHaveAttribute with timeout 1000ms');
    }
  });
});

test.describe('toHaveCSS', () => {
  test('pass', async ({ page }) => {
    await page.setContent('<div id=node style="color: rgb(255, 0, 0)">Text content</div>');
    const locator = page.locator('#node');
    await expect(locator).toHaveCSS('color', 'rgb(255, 0, 0)');
  });

  test('custom css properties', async ({ page }) => {
    await page.setContent('<div id=node style="--custom-color-property:#FF00FF;">Text content</div>');
    const locator = page.locator('#node');
    await expect(locator).toHaveCSS('--custom-color-property', '#FF00FF');
  });
});

test.describe('toHaveId', () => {
  test('pass', async ({ page }) => {
    await page.setContent('<div id=node>Text content</div>');
    const locator = page.locator('#node');
    await expect(locator).toHaveId('node');
  });
});

test.describe('toBeInViewport', () => {
  test('should work', async ({ page }) => {
    await page.setContent(`
      <div id=big style="height: 10000px;"></div>
      <div id=small>foo</div>
    `);
    await expect(page.locator('#big')).toBeInViewport();
    await expect(page.locator('#small')).not.toBeInViewport();
    await page.locator('#small').scrollIntoViewIfNeeded();
    await expect(page.locator('#small')).toBeInViewport();
    await expect(page.locator('#small')).toBeInViewport({ ratio: 1 });
  });

  test('should respect ratio option', async ({ page }) => {
    await page.setContent(`
      <style>body, div, html { padding: 0; margin: 0; }</style>
      <div id=big style="height: 400vh;"></div>
    `);
    await expect(page.locator('div')).toBeInViewport();
    await expect(page.locator('div')).toBeInViewport({ ratio: 0.1 });
    await expect(page.locator('div')).toBeInViewport({ ratio: 0.2 });

    await expect(page.locator('div')).toBeInViewport({ ratio: 0.24 });
    // In this test, element's ratio is 0.25.
    await expect(page.locator('div')).toBeInViewport({ ratio: 0.25 });
    await expect(page.locator('div')).not.toBeInViewport({ ratio: 0.26 });

    await expect(page.locator('div')).not.toBeInViewport({ ratio: 0.3 });
    await expect(page.locator('div')).not.toBeInViewport({ ratio: 0.7 });
    await expect(page.locator('div')).not.toBeInViewport({ ratio: 0.8 });
  });

  test('should have good stack', async ({ page }) => {
    let error;
    try {
      await expect(page.locator('body')).not.toBeInViewport({ timeout: 100 });
    } catch (e) {
      error = e;
    }
    expect(error).toBeTruthy();
    expect(/unexpected value "viewport ratio \d+/.test(error.stack)).toBe(true);
    const stackFrames = error.stack.split('\n').filter(line => line.trim().startsWith('at '));
    expect(stackFrames.length).toBe(1);
    expect(stackFrames[0]).toContain(__filename);
  });

  test('should report intersection even if fully covered by other element', async ({ page }) => {
    await page.setContent(`
      <h1>hello</h1>
      <div style="position: relative; height: 10000px; top: -5000px;></div>
    `);
    await expect(page.locator('h1')).toBeInViewport();
  });
});
