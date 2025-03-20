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

import { stripVTControlCharacters } from 'node:util';
import { stripAnsi } from '../config/utils';
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

  test('pass nested', async ({ page }) => {
    await page.setContent('<div></div>');
    await page.$eval('div', e => (e as any).foo = { nested: { a: 1, b: 'string', c: new Date(1627503992000) } });
    const locator = page.locator('div');
    await expect(locator).toHaveJSProperty('foo.nested', { a: 1, b: 'string', c: new Date(1627503992000) });
    await expect(locator).toHaveJSProperty('foo.nested.a', 1);
    await expect(locator).toHaveJSProperty('foo.nested.b', 'string');
    await expect(locator).toHaveJSProperty('foo.nested.c', new Date(1627503992000));
  });

  test('fail nested', async ({ page }) => {
    await page.setContent('<div></div>');
    await page.$eval('div', e => (e as any).foo = { nested: { a: 1, b: 'string', c: new Date(1627503992000) } });
    const locator = page.locator('div');
    const error1 = await expect(locator).toHaveJSProperty('foo.bar', { a: 1, b: 'string', c: new Date(1627503992001) }, { timeout: 1000 }).catch(e => e);
    expect.soft(stripAnsi(error1.message)).toContain(`Received: undefined`);
    const error2 = await expect(locator).toHaveJSProperty('foo.nested.a', 2, { timeout: 1000 }).catch(e => e);
    expect.soft(stripAnsi(error2.message)).toContain(`Received: 1`);
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

  test('allow matching partial class names', async ({ page }) => {
    await page.setContent('<div class="foo bar"></div>');
    const locator = page.locator('div');
    await expect(locator).toHaveClass('foo', { partial: true });
    await expect(locator).toHaveClass('bar', { partial: true });
    await expect(
        expect(locator).toHaveClass(/f.o/, { partial: true })
    ).rejects.toThrow('Partial matching does not support regular expressions. Please provide a string value.');
    await expect(locator).not.toHaveClass('foo');
    await expect(locator).not.toHaveClass('foo', { partial: false });
    await expect(locator).toHaveClass('  bar   foo ', { partial: true });
    await expect(locator).not.toHaveClass('does-not-exist', { partial: true });
    await expect(locator).not.toHaveClass('  baz   foo ', { partial: true }); // Strip whitespace and match individual classes

    await page.setContent('<div class="foo bar baz"></div>');
    await expect(locator).toHaveClass('foo bar', { partial: true });
    await expect(locator).toHaveClass('', { partial: true });
  });

  test('allow matching partial class names with array', async ({ page }) => {
    await page.setContent('<div class="aaa"></div><div class="bbb b2b"></div><div class="ccc"></div>');
    const locator = page.locator('div');
    await expect(locator).toHaveClass(['aaa', 'b2b', 'ccc'], { partial: true });
    await expect(locator).not.toHaveClass(['aaa', 'b2b', 'ccc']);
    await expect(
        expect(locator).toHaveClass([/b2?ar/, /b2?ar/, /b2?ar/], { partial: true })
    ).rejects.toThrow('Partial matching does not support regular expressions. Please provide a string value.');
    await expect(locator).not.toHaveClass(['aaa', 'b2b', 'ccc'], { partial: false });
    await expect(locator).not.toHaveClass(['not-there', 'b2b', 'ccc'], { partial: true }); // Class not there
    await expect(locator).not.toHaveClass(['aaa', 'b2b'], { partial: false }); // Length mismatch
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

  test('fail string', async ({ page }) => {
    await page.goto('data:text/html,<div>A</div>');
    const error = await expect(page).toHaveURL('wrong', { timeout: 1000 }).catch(e => e);
    expect(stripVTControlCharacters(error.message)).toContain('Timed out 1000ms waiting for expect(locator).toHaveURL(expected)');
    expect(stripVTControlCharacters(error.message)).toContain('Expected string: "wrong"\nReceived string: "data:text/html,<div>A</div>"');
  });

  test('fail with invalid argument', async ({ page }) => {
    await page.goto('data:text/html,<div>A</div>');
    // @ts-expect-error
    const error = await expect(page).toHaveURL({}).catch(e => e);
    expect(stripVTControlCharacters(error.message)).toContain(`expect(locator(':root')).toHaveURL([object Object])`);
    expect(stripVTControlCharacters(error.message)).toContain('Expected has type:  object\nExpected has value: {}');
  });

  test('fail with positive predicate', async ({ page }) => {
    await page.goto('data:text/html,<div>A</div>');
    const error = await expect(page).toHaveURL(_url => false).catch(e => e);
    expect(stripVTControlCharacters(error.message)).toContain('expect(page).toHaveURL(expected)');
    expect(stripVTControlCharacters(error.message)).toContain('Expected predicate to succeed\nReceived string: "data:text/html,<div>A</div>"');
  });

  test('fail with negative predicate', async ({ page }) => {
    await page.goto('data:text/html,<div>A</div>');
    const error = await expect(page).not.toHaveURL(_url => true).catch(e => e);
    expect(stripVTControlCharacters(error.message)).toContain('expect(page).not.toHaveURL(expected)');
    expect(stripVTControlCharacters(error.message)).toContain('Expected predicate to fail\nReceived string: "data:text/html,<div>A</div>"');
  });

  test('resolve predicate on initial call', async ({ page }) => {
    await page.goto('data:text/html,<div>A</div>');
    await expect(page).toHaveURL(url => url.href === 'data:text/html,<div>A</div>', { timeout: 1000 });
  });

  test('resolve predicate after retries', async ({ page }) => {
    await page.goto('data:text/html,<div>A</div>');
    const expectPromise = expect(page).toHaveURL(url => url.href === 'data:text/html,<div>B</div>', { timeout: 1000 });
    setTimeout(() => page.goto('data:text/html,<div>B</div>'), 500);
    await expectPromise;
  });

  test('support ignoreCase', async ({ page }) => {
    await page.goto('data:text/html,<div>A</div>');
    await expect(page).toHaveURL('DATA:teXT/HTml,<div>a</div>', { ignoreCase: true });
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

  test('should match attribute without value', async ({ page }) => {
    await page.setContent('<div checked id=node>Text content</div>');
    const locator = page.locator('#node');
    await expect(locator).toHaveAttribute('id');
    await expect(locator).toHaveAttribute('checked');
    await expect(locator).not.toHaveAttribute('open');
  });

  test('should support boolean attribute with options', async ({ page }) => {
    await page.setContent('<div checked id=node>Text content</div>');
    const locator = page.locator('#node');
    await expect(locator).toHaveAttribute('id', { timeout: 5000 });
    await expect(locator).toHaveAttribute('checked', { timeout: 5000 });
    await expect(locator).not.toHaveAttribute('open', { timeout: 5000 });
  });

  test('support ignoreCase', async ({ page }) => {
    await page.setContent('<div id=NoDe>Text content</div>');
    const locator = page.locator('#NoDe');
    await expect(locator).toHaveAttribute('id', 'node', { ignoreCase: true });
    await expect(locator).not.toHaveAttribute('id', 'node');
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

  test('should respect ratio option', async ({ page, isAndroid }) => {
    test.fixme(isAndroid, 'ratio 0.24 is not in viewport for unknown reason');

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

test('toHaveCount should not produce logs twice', async ({ page }) => {
  await page.setContent('<select><option>One</option></select>');
  const error = await expect(page.locator('option')).toHaveCount(2, { timeout: 2000 }).catch(e => e);
  const waitingForMessage = `waiting for locator('option')`;
  expect(error.message).toContain(waitingForMessage);
  expect(error.message).toContain(`locator resolved to 1 element`);
  expect(error.message).toContain(`unexpected value "1"`);
  expect(error.message.replace(waitingForMessage, '<redacted>')).not.toContain(waitingForMessage);
});

test('toHaveText should not produce logs twice', async ({ page }) => {
  await page.setContent('<div>hello</div>');
  const error = await expect(page.locator('div')).toHaveText('world', { timeout: 2000 }).catch(e => e);
  const waitingForMessage = `waiting for locator('div')`;
  expect(error.message).toContain(waitingForMessage);
  expect(error.message).toContain(`locator resolved to <div>hello</div>`);
  expect(error.message).toContain(`unexpected value "hello"`);
  expect(error.message.replace(waitingForMessage, '<redacted>')).not.toContain(waitingForMessage);
});

test('toHaveText that does not match should not produce logs twice', async ({ page }) => {
  await page.setContent('<div>hello</div>');
  const error = await expect(page.locator('span')).toHaveText('world', { timeout: 2000 }).catch(e => e);
  const waitingForMessage = `waiting for locator('span')`;
  expect(error.message).toContain(waitingForMessage);
  expect(error.message).not.toContain('locator resolved to');
  expect(error.message.replace(waitingForMessage, '<redacted>')).not.toContain(waitingForMessage);
});

test('toHaveAccessibleName', async ({ page }) => {
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
});

test('toHaveAccessibleDescription', async ({ page }) => {
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

test('toHaveAccessibleErrorMessage', async ({ page }) => {
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

test('toHaveAccessibleErrorMessage should handle multiple aria-errormessage references', async ({ page }) => {
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
    test('no aria-invalid attribute', async ({ page }) => {
      const locator = await setupPage(page, null);
      await expect(locator).not.toHaveAccessibleErrorMessage(errorMessageText);
    });
    test('aria-invalid="false"', async ({ page }) => {
      const locator = await setupPage(page, 'false');
      await expect(locator).not.toHaveAccessibleErrorMessage(errorMessageText);
    });
    test('aria-invalid="" (empty string)', async ({ page }) => {
      const locator = await setupPage(page, '');
      await expect(locator).not.toHaveAccessibleErrorMessage(errorMessageText);
    });
  });
  test.describe('evaluated in true', () => {
    test('aria-invalid="true"', async ({ page }) => {
      const locator = await setupPage(page, 'true');
      await expect(locator).toHaveAccessibleErrorMessage(errorMessageText);
    });
    test('aria-invalid="foo" (unrecognized value)', async ({ page }) => {
      const locator = await setupPage(page, 'foo');
      await expect(locator).toHaveAccessibleErrorMessage(errorMessageText);
    });
  });
});

test.describe('toHaveAccessibleErrorMessage should handle validity state with aria-invalid', () => {
  const errorMessageText = 'Error message';

  test('should show error message when validity is false and aria-invalid is true', async ({ page }) => {
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

  test('should show error message when validity is true and aria-invalid is true', async ({ page }) => {
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

  test('should show error message when validity is false and aria-invalid is false', async ({ page }) => {
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

  test('should not show error message when validity is true and aria-invalid is false', async ({ page }) => {
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
});


test('toHaveRole', async ({ page }) => {
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
