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

test.describe('toHaveText with regex', () => {
  test('pass', async ({ page }) => {
    await page.setContent('<div id=node>Text   content</div>');
    const locator = page.locator('#node');
    await expect(locator).toHaveText(/Text/);

    // Should not normalize whitespace.
    await expect(locator).toHaveText(/Text   content/);
    // Should respect ignoreCase.
    await expect(locator).toHaveText(/text   content/, { ignoreCase: true });
    // Should override regex flag with ignoreCase.
    await expect(locator).not.toHaveText(/text   content/i, { ignoreCase: false });
  });

  test('fail', async ({ page }) => {
    await page.setContent('<div id=node>Text content</div>');
    const locator = page.locator('#node');
    const error = await expect(locator).toHaveText(/Text 2/, { timeout: 1000 }).catch(e => e);
    expect(stripAnsi(error.message)).toContain('Expected pattern: /Text 2/');
    expect(stripAnsi(error.message)).toContain('Received string:  "Text content"');
  });
});

test.describe('toContainText with regex', () => {
  test('pass', async ({ page }) => {
    await page.setContent('<div id=node>Text   content</div>');
    const locator = page.locator('#node');
    await expect(locator).toContainText(/ex/);

    // Should not normalize whitespace.
    await expect(locator).toContainText(/ext   cont/);
  });

  test('fail', async ({ page }) => {
    await page.setContent('<div id=node>Text content</div>');
    const locator = page.locator('#node');
    const error = await expect(locator).toContainText(/ex2/, { timeout: 1000 }).catch(e => e);
    expect(stripAnsi(error.message)).toContain('Expected pattern: /ex2/');
    expect(stripAnsi(error.message)).toContain('Received string:  "Text content"');
  });
});

test.describe('toHaveText with text', () => {
  test('pass', async ({ page }) => {
    await page.setContent('<div id=node><span></span>Text \ncontent&nbsp;    </div>');
    const locator = page.locator('#node');
    // Should normalize whitespace.
    await expect(locator).toHaveText('Text                        content');
    // Should normalize zero width whitespace.
    await expect(locator).toHaveText('T\u200be\u200bx\u200bt content');
    // Should support ignoreCase.
    await expect(locator).toHaveText('text CONTENT', { ignoreCase: true });
    // Should support falsy ignoreCase.
    await expect(locator).not.toHaveText('TEXT', { ignoreCase: false });
  });

  test('pass contain', async ({ page }) => {
    await page.setContent('<div id=node>Text content</div>');
    const locator = page.locator('#node');
    await expect(locator).toContainText('Text');
    // Should normalize whitespace.
    await expect(locator).toContainText('   ext        cont\n  ');
    // Should support ignoreCase.
    await expect(locator).toContainText('EXT', { ignoreCase: true });
    // Should support falsy ignoreCase.
    await expect(locator).not.toContainText('TEXT', { ignoreCase: false });
  });

  test('fail', async ({ page }) => {
    await page.setContent('<div id=node>Text content</div>');
    const locator = page.locator('#node');
    const error = await expect(locator).toHaveText('Text', { timeout: 1000 }).catch(e => e);
    expect(stripAnsi(error.message)).toContain('Expected string: "Text"');
    expect(stripAnsi(error.message)).toContain('Received string: "Text content"');
  });

  test('pass eventually', async ({ page }) => {
    await page.setContent('<div id=node>Text content</div>');
    const locator = page.locator('#node');
    await Promise.all([
      expect(locator).toHaveText(/Text 2/),
      page.waitForTimeout(1000).then(() => locator.evaluate(element => element.textContent = 'Text 2 content')),
    ]);
  });

  test('with userInnerText', async ({ page }) => {
    await page.setContent('<div id=node>Text <span hidden>garbage</span> content</div>');
    const locator = page.locator('#node');
    await expect(locator).toHaveText('Text content', { useInnerText: true });
  });

  test('in shadow dom', async ({ page }) => {
    await page.setContent(`
      <div></div>
      <script>
        const div = document.querySelector('div');
        const span = document.createElement('span');
        span.textContent = 'some text';
        div.attachShadow({ mode: 'open' }).appendChild(span);
      </script>
    `);
    await expect(page.locator('span')).toHaveText('some text');
    await expect(page.locator('span')).toContainText('text');
    await expect(page.locator('div')).toHaveText('some text');
    await expect(page.locator('div')).toContainText('text');
    await expect(page.locator('span')).toHaveText('some text', { useInnerText: true });
    await expect(page.locator('span')).toContainText('text', { useInnerText: true });
    // Playwright intentionally does not perform innerText piercing on shadow dom.
    await expect(page.locator('div')).not.toHaveText('some text', { useInnerText: true });
    await expect(page.locator('div')).not.toContainText('text', { useInnerText: true });
  });

  test('fail with impossible timeout', async ({ page }) => {
    await page.setContent('<div id=node>Text content</div>');
    const error = await expect(page.locator('#node')).toHaveText('Text', { timeout: 1 }).catch(e => e);
    expect(stripAnsi(error.message)).toContain('Expected string: "Text"');
    expect(stripAnsi(error.message)).toContain('Received string: "Text content"');
  });
});

test.describe('not.toHaveText', () => {
  test('pass', async ({ page }) => {
    await page.setContent('<div id=node>Text content</div>');
    const locator = page.locator('#node');
    await expect(locator).not.toHaveText('Text2');
    // Should be case-sensitive by default.
    await expect(locator).not.toHaveText('TEXT');
  });

  test('fail', async ({ page }) => {
    await page.setContent('<div id=node>Text content</div>');
    const locator = page.locator('#node');
    const error = await expect(locator).not.toHaveText('Text content', { timeout: 1000 }).catch(e => e);
    expect(stripAnsi(error.message)).toContain('Expected string: not "Text content"');
    expect(stripAnsi(error.message)).toContain('Received string: "Text content');
  });

  test('should work when selector does not match', async ({ page }) => {
    await page.setContent('<div>hello</div>');
    const error = await expect(page.locator('span')).not.toHaveText('hello', { timeout: 1000 }).catch(e => e);
    expect(stripAnsi(error.message)).toContain('Expected string: not "hello"');
    expect(stripAnsi(error.message)).toContain('Received: <element(s) not found>');
    expect(stripAnsi(error.message)).toContain('waiting for locator(\'span\')');
  });
});

test.describe('toHaveText with array', () => {
  test('pass', async ({ page }) => {
    await page.setContent('<div>Text    \n1</div><div>Text   2a</div>');
    const locator = page.locator('div');
    // Should only normalize whitespace in the first item.
    await expect(locator).toHaveText(['Text  1', /Text   \d+a/]);
    // Should support ignoreCase.
    await expect(locator).toHaveText(['tEXT 1', 'TExt 2A'], { ignoreCase: true });
  });

  test('pass lazy', async ({ page }) => {
    await page.setContent('<div id=div></div>');
    const locator = page.locator('p');
    setTimeout(() => {
      page.evaluate(() => {
        document.querySelector('div').innerHTML = '<p>Text 1</p><p>Text 2</p>';
      }).catch(() => {});
    }, 500);
    await expect(locator).toHaveText(['Text 1', 'Text 2']);
  });

  test('pass empty', async ({ page }) => {
    await page.setContent('<div></div>');
    const locator = page.locator('p');
    await expect(locator).toHaveText([]);
  });

  test('pass not empty', async ({ page }) => {
    await page.setContent('<div><p>Test</p></div>');
    const locator = page.locator('p');
    await expect(locator).not.toHaveText([]);
  });

  test('pass on empty', async ({ page }) => {
    await page.setContent('<div></div>');
    const locator = page.locator('p');
    await expect(locator).not.toHaveText(['Test']);
  });

  test('fail on not+empty', async ({ page }) => {
    await page.setContent('<div></div>');
    const locator = page.locator('p');
    const error = await expect(locator).not.toHaveText([], { timeout: 1000 }).catch(e => e);
    expect(error.message).toContain('expect.not.toHaveText with timeout 1000ms');
  });

  test('pass eventually empty', async ({ page }) => {
    await page.setContent('<div id=div><p>Text</p></div>');
    const locator = page.locator('p');
    setTimeout(() => {
      page.evaluate(() => document.querySelector('div').innerHTML = '').catch(() => {});
    }, 500);
    await expect(locator).not.toHaveText([]);
  });

  test('fail', async ({ page }) => {
    await page.setContent('<div>Text 1</div><div>Text 3</div>');
    const locator = page.locator('div');
    const error = await expect(locator).toHaveText(['Text 1', /Text \d/, 'Extra'], { timeout: 1000 }).catch(e => e);
    expect(stripAnsi(error.message)).toContain('-   "Extra"');
    expect(error.message).toContain('expect.toHaveText with timeout 1000ms');
    expect(error.message).toContain('waiting for locator(\'div\')');
    expect(error.message).toContain('locator resolved to 2 elements');
  });

  test('fail on repeating array matchers', async ({ page }) => {
    await page.setContent('<div>KekFoo</div>');
    const locator = page.locator('div');
    const error = await expect(locator).toContainText(['KekFoo', 'KekFoo', 'KekFoo'], { timeout: 1000 }).catch(e => e);
    expect(error.message).toContain('locator resolved to 1 element');
  });
});

test.describe('toContainText with array', () => {
  test('pass', async ({ page }) => {
    await page.setContent('<div>Text \n1</div><div>Text2</div><div>Text3</div>');
    const locator = page.locator('div');
    await expect(locator).toContainText(['ext     1', /ext3/]);
    // Should support ignoreCase.
    await expect(locator).toContainText(['EXT 1', 'eXt3'], { ignoreCase: true });
  });

  test('fail', async ({ page }) => {
    await page.setContent('<div>Text 1</div><div>Text 3</div>');
    const locator = page.locator('div');
    const error = await expect(locator).toContainText(['Text 2'], { timeout: 1000 }).catch(e => e);
    expect(stripAnsi(error.message)).toContain('-   "Text 2"');
  });
});
