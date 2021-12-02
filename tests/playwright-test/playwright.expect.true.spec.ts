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

import { test, expect, stripAscii } from './playwright-test-fixtures';

test('should support toBeChecked', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      const { test } = pwt;

      test('pass', async ({ page }) => {
        await page.setContent('<input type=checkbox checked></input>');
        const locator = page.locator('input');
        await expect(locator).toBeChecked();
      });

      test('pass 2', async ({ page }) => {
        await page.setContent('<input type=checkbox checked></input>');
        const locator = page.locator('input');
        await expect(locator).toBeChecked({ checked: true });
      });

      test('pass 3', async ({ page }) => {
        await page.setContent('<input type=checkbox checked></input>');
        const locator = page.locator('input');
        await expect(locator).not.toBeChecked({ checked: false });
      });

      test('fail', async ({ page }) => {
        await page.setContent('<input type=checkbox></input>');
        const locator = page.locator('input');
        await expect(locator).toBeChecked({ timeout: 1000 });
      });
      `,
  }, { workers: 1 });
  const output = stripAscii(result.output);
  expect(output).toContain('Error: expect(received).toBeChecked()');
  expect(output).toContain('expect(locator).toBeChecked');
  expect(result.passed).toBe(3);
  expect(result.failed).toBe(1);
  expect(result.exitCode).toBe(1);
});

test('should support toBeChecked w/ not', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      const { test } = pwt;

      test('pass not', async ({ page }) => {
        await page.setContent('<input type=checkbox></input>');
        const locator = page.locator('input');
        await expect(locator).not.toBeChecked();
      });

      test('pass 2', async ({ page }) => {
        await page.setContent('<input type=checkbox></input>');
        const locator = page.locator('input');
        await expect(locator).toBeChecked({ checked: false });
      });

      test('fail not', async ({ page }) => {
        await page.setContent('<input type=checkbox checked></input>');
        const locator = page.locator('input');
        await expect(locator).not.toBeChecked({ timeout: 500 });
      });

      test('fail 2', async ({ page }) => {
        await page.setContent('<input type=checkbox checked></input>');
        const locator = page.locator('input');
        await expect(locator).toBeChecked({ checked: false, timeout: 500 });
      });

      test('fail missing', async ({ page }) => {
        await page.setContent('<div>no inputs here</div>');
        const locator2 = page.locator('input2');
        await expect(locator2).not.toBeChecked({ timeout: 500 });
      });
      `,
  }, { workers: 1 });
  const output = stripAscii(result.output);
  expect(result.passed).toBe(2);
  expect(result.failed).toBe(3);
  expect(result.exitCode).toBe(1);
  // fail not
  expect(output).toContain('Error: expect(received).not.toBeChecked()');
  expect(output).toContain('expect(locator).not.toBeChecked');
  expect(output).toContain('selector resolved to <input checked type="checkbox"/>');
  // fail missing
  expect(output).toContain('expect(locator2).not.toBeChecked');
  expect(output).toContain('waiting for selector "input2"');
});

test('should support toBeEditable, toBeEnabled, toBeDisabled, toBeEmpty', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      const { test } = pwt;

      test('editable', async ({ page }) => {
        await page.setContent('<input></input>');
        const locator = page.locator('input');
        await expect(locator).toBeEditable();
      });

      test('enabled', async ({ page }) => {
        await page.setContent('<button>Text</button>');
        const locator = page.locator('button');
        await expect(locator).toBeEnabled();
      });

      test('failed', async ({ page }) => {
        await page.setContent('<button disabled>Text</button>');
        const locator = page.locator('button');
        await expect(locator).toBeEnabled({ timeout: 500 });
      });

      test('eventually enabled', async ({ page }) => {
        await page.setContent('<button disabled>Text</button>');
        const locator = page.locator('button');
        setTimeout(() => {
          locator.evaluate(e => e.removeAttribute('disabled')).catch(() => {});
        }, 500);
        await expect(locator).toBeEnabled();
      });

      test('eventually disabled', async ({ page }) => {
        await page.setContent('<button>Text</button>');
        const locator = page.locator('button');
        setTimeout(() => {
          locator.evaluate(e => e.setAttribute('disabled', '')).catch(() => {});
        }, 500);
        await expect(locator).not.toBeEnabled();
      });

      test('disabled', async ({ page }) => {
        await page.setContent('<button disabled>Text</button>');
        const locator = page.locator('button');
        await expect(locator).toBeDisabled();
      });

      test('empty input', async ({ page }) => {
        await page.setContent('<input></input>');
        const locator = page.locator('input');
        await expect(locator).toBeEmpty();
      });

      test('non-empty input', async ({ page }) => {
        await page.setContent('<input value=text></input>');
        const locator = page.locator('input');
        await expect(locator).not.toBeEmpty();
      });

      test('empty DOM', async ({ page }) => {
        await page.setContent('<div style="width: 50; height: 50px"></div>');
        const locator = page.locator('div');
        await expect(locator).toBeEmpty();
      });
      `,
  }, { workers: 1 });
  expect(result.passed).toBe(8);
  expect(result.failed).toBe(1);
  expect(result.exitCode).toBe(1);
  const output = stripAscii(result.output);
  expect(output).toContain('expect(locator).toBeEnabled({ timeout: 500 }');
});

test('should support toBeVisible, toBeHidden', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      const { test } = pwt;

      test('visible', async ({ page }) => {
        await page.setContent('<input></input>');
        const locator = page.locator('input');
        await expect(locator).toBeVisible();
      });

      test('not visible', async ({ page }) => {
        await page.setContent('<button style="display: none"></button>');
        const locator = page.locator('button');
        await expect(locator).not.toBeVisible();
      });

      test('hidden', async ({ page }) => {
        await page.setContent('<button style="display: none"></button>');
        const locator = page.locator('button');
        await expect(locator).toBeHidden();
      });

      test('was hidden', async ({ page }) => {
        await page.setContent('<div</div>');
        const locator = page.locator('button');
        await expect(locator).toBeHidden();
      });

      test('not hidden', async ({ page }) => {
        await page.setContent('<input></input>');
        const locator = page.locator('input');
        await expect(locator).not.toBeHidden();
      });
      `,
  }, { workers: 1 });
  expect(result.passed).toBe(5);
  expect(result.exitCode).toBe(0);
});

test('should support toBeVisible, toBeHidden wait', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      const { test } = pwt;

      test('visible', async ({ page }) => {
        await page.setContent('<div></div>');
        const locator = page.locator('span');
        setTimeout(() => {
          page.$eval('div', div => div.innerHTML = '<span>Hello</span>').catch(() => {});
        }, 0);
        await expect(locator).toBeVisible();
      });

      test('not hidden', async ({ page }) => {
        await page.setContent('<div></div>');
        const locator = page.locator('span');
        setTimeout(() => {
          page.$eval('div', div => div.innerHTML = '<span>Hello</span>').catch(() => {});
        }, 0);
        await expect(locator).not.toBeHidden();
      });

      test('not visible', async ({ page }) => {
        await page.setContent('<div><span>Hello</span></div>');
        const locator = page.locator('span');
        setTimeout(() => {
          page.$eval('span', span => span.textContent = '').catch(() => {});
        }, 0);
        await expect(locator).not.toBeVisible();
      });

      test('hidden', async ({ page }) => {
        await page.setContent('<div><span>Hello</span></div>');
        const locator = page.locator('span');
        setTimeout(() => {
          page.$eval('span', span => span.textContent = '').catch(() => {});
        }, 0);
        await expect(locator).toBeHidden();
      });
      `,
  }, { workers: 1 });
  expect(result.passed).toBe(4);
  expect(result.exitCode).toBe(0);
});

test('should support toBeVisible, toBeHidden fail', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      const { test } = pwt;

      test('visible', async ({ page }) => {
        await page.setContent('<button style="display: none"></button>');
        const locator = page.locator('button');
        await expect(locator).toBeVisible({ timeout: 500 });
      });

      test('not visible', async ({ page }) => {
        await page.setContent('<input></input>');
        const locator = page.locator('input');
        await expect(locator).not.toBeVisible({ timeout: 500 });
      });

      test('hidden', async ({ page }) => {
        await page.setContent('<input></input>');
        const locator = page.locator('input');
        await expect(locator).toBeHidden({ timeout: 500 });
      });

      test('not hidden', async ({ page }) => {
        await page.setContent('<button style="display: none"></button>');
        const locator = page.locator('button');
        await expect(locator).not.toBeHidden({ timeout: 500 });
      });

      test('not hidden 2', async ({ page }) => {
        await page.setContent('<div></div>');
        const locator = page.locator('button');
        await expect(locator).not.toBeHidden({ timeout: 500 });
      });
      `,
  }, { workers: 1 });
  expect(result.failed).toBe(5);
  expect(result.exitCode).toBe(1);
});

test('should support toBeFocused', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      const { test } = pwt;

      test('focused', async ({ page }) => {
        await page.setContent('<input></input>');
        const locator = page.locator('input');
        await locator.focus();
        await expect(locator).toBeFocused({ timeout: 1000 });
      });
      `,
  }, { workers: 1 });
  expect(result.passed).toBe(1);
  expect(result.exitCode).toBe(0);
});

test('should print unknown engine error', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      const { test } = pwt;
      test('focused', async ({ page }) => {
        await expect(page.locator('row="row"]')).toBeVisible();
      });
      `,
  }, { workers: 1 });
  expect(result.passed).toBe(0);
  expect(result.exitCode).toBe(1);
  expect(result.output).toContain(`Unknown engine "row" while parsing selector row="row"]`);
});

test('should print syntax error', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      const { test } = pwt;
      test('focused', async ({ page }) => {
        await expect(page.locator('row]')).toBeVisible();
      });
      `,
  }, { workers: 1 });
  expect(result.passed).toBe(0);
  expect(result.exitCode).toBe(1);
  expect(result.output).toContain(`Unexpected token "]" while parsing selector "row]"`);
});

test('should support toBeOK', async ({ runInlineTest, server }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      const { test } = pwt;

      test('pass with response', async ({ page }) => {
        const res = await page.request.get('${server.EMPTY_PAGE}');
        await expect(res).toBeOK();
      });

      test('pass with not', async ({ page }) => {
        const res = await page.request.get('${server.PREFIX}/unknown');
        await expect(res).not.toBeOK();
      });

      test('fail with invalid argument', async ({ page }) => {
        await expect(page).toBeOK();
      });

      test('fail with promise', async ({ page }) => {
        const res = page.request.get('${server.EMPTY_PAGE}').catch(e => {});
        await expect(res).toBeOK();
      });

      test('fail', async ({ page }) => {
        const res = await page.request.get('${server.PREFIX}/unknown');
        await expect(res).toBeOK();
      });
      `,
  }, { workers: 1 });
  expect(result.passed).toBe(2);
  expect(result.failed).toBe(3);
  expect(result.exitCode).toBe(1);
  expect(result.output).toContain(`→ GET ${server.PREFIX}/unknown`);
  expect(result.output).toContain(`← 404 Not Found`);
  expect(result.output).toContain(`Error: toBeOK can be only used with APIResponse object`);
});
