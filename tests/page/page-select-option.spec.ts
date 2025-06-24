/**
 * Copyright 2017 Google Inc. All rights reserved.
 * Modifications copyright (c) Microsoft Corporation.
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

import type { Page } from '@playwright/test';
import { test as it, expect, rafraf } from './pageTest';

const giveItAChanceToResolve = (page: Page) => rafraf(page, 5);

it('should select single option @smoke', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/input/select.html');
  await page.selectOption('select', 'blue');
  expect(await page.evaluate(() => window['result'].onInput)).toEqual(['blue']);
  expect(await page.evaluate(() => window['result'].onChange)).toEqual(['blue']);
});

it('should select single option by value', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/input/select.html');
  await page.selectOption('select', { value: 'blue' });
  expect(await page.evaluate(() => window['result'].onInput)).toEqual(['blue']);
  expect(await page.evaluate(() => window['result'].onChange)).toEqual(['blue']);
});

it('should fall back to selecting by label', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/input/select.html');
  await page.selectOption('select', 'Blue');
  expect(await page.evaluate(() => window['result'].onInput)).toEqual(['blue']);
  expect(await page.evaluate(() => window['result'].onChange)).toEqual(['blue']);
});

it('should select single option by label', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/input/select.html');
  await page.selectOption('select', { label: 'Indigo' });
  expect(await page.evaluate(() => window['result'].onInput)).toEqual(['indigo']);
  expect(await page.evaluate(() => window['result'].onChange)).toEqual(['indigo']);
});

it('should select single option by handle', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/input/select.html');
  await page.selectOption('select', await page.$('[id=whiteOption]'));
  expect(await page.evaluate(() => window['result'].onInput)).toEqual(['white']);
  expect(await page.evaluate(() => window['result'].onChange)).toEqual(['white']);
});

it('should select single option by index', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/input/select.html');
  await page.selectOption('select', { index: 2 });
  expect(await page.evaluate(() => window['result'].onInput)).toEqual(['brown']);
  expect(await page.evaluate(() => window['result'].onChange)).toEqual(['brown']);
});

it('should select single option by multiple attributes', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/input/select.html');
  await page.selectOption('select', { value: 'green', label: 'Green' });
  expect(await page.evaluate(() => window['result'].onInput)).toEqual(['green']);
  expect(await page.evaluate(() => window['result'].onChange)).toEqual(['green']);
});

it('should not select single option when some attributes do not match', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/input/select.html');
  await page.$eval('select', s => s.value = undefined);
  try {
    await page.selectOption('select', { value: 'green', label: 'Brown' }, { timeout: 1000 });
  } catch (e) {
    expect(e.message).toContain('Timeout');
  }
  expect(await page.evaluate(() => document.querySelector('select').value)).toEqual('');
});

it('should select only first option', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/input/select.html');
  await page.selectOption('select', ['blue', 'green', 'red']);
  expect(await page.evaluate(() => window['result'].onInput)).toEqual(['blue']);
  expect(await page.evaluate(() => window['result'].onChange)).toEqual(['blue']);
});

it('should not throw when select causes navigation', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/input/select.html');
  await page.$eval('select', select => select.addEventListener('input', () => window.location.href = '/empty.html'));
  await Promise.all([
    page.selectOption('select', 'blue'),
    page.waitForNavigation(),
  ]);
  expect(page.url()).toContain('empty.html');
});

it('should select multiple options', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/input/select.html');
  await page.evaluate(() => window['makeMultiple']());
  await page.selectOption('select', ['blue', 'green', 'red']);
  expect(await page.evaluate(() => window['result'].onInput)).toEqual(['blue', 'green', 'red']);
  expect(await page.evaluate(() => window['result'].onChange)).toEqual(['blue', 'green', 'red']);
});

it('should select multiple options with attributes', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/input/select.html');
  await page.evaluate(() => window['makeMultiple']());
  await page.selectOption('select', [{ value: 'blue' }, { label: 'Green' }, { index: 4 }]);
  expect(await page.evaluate(() => window['result'].onInput)).toEqual(['blue', 'gray', 'green']);
  expect(await page.evaluate(() => window['result'].onChange)).toEqual(['blue', 'gray', 'green']);
});

it('should respect event bubbling', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/input/select.html');
  await page.selectOption('select', 'blue');
  expect(await page.evaluate(() => window['result'].onBubblingInput)).toEqual(['blue']);
  expect(await page.evaluate(() => window['result'].onBubblingChange)).toEqual(['blue']);
});

it('should throw when element is not a <select>', async ({ page, server }) => {
  let error = null;
  await page.goto(server.PREFIX + '/input/select.html');
  await page.selectOption('body', '').catch(e => error = e);
  expect(error.message).toContain('Element is not a <select> element');
});

it('should return [] on no matched values', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/input/select.html');
  const result = await page.selectOption('select', []);
  expect(result).toEqual([]);
});

it('should return an array of matched values', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/input/select.html');
  await page.evaluate(() => window['makeMultiple']());
  const result = await page.selectOption('select', ['blue', 'black', 'magenta']);
  expect(result.reduce((accumulator, current) => ['blue', 'black', 'magenta'].includes(current) && accumulator, true)).toEqual(true);
});

it('should return an array of one element when multiple is not set', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/input/select.html');
  const result = await page.selectOption('select', ['42', 'blue', 'black', 'magenta']);
  expect(result.length).toEqual(1);
});

it('should return [] on no values', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/input/select.html');
  const result = await page.selectOption('select', []);
  expect(result).toEqual([]);
});

it('should not allow null items', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/input/select.html');
  await page.evaluate(() => window['makeMultiple']());
  let error = null;
  await page.selectOption('select', ['blue', null, 'black', 'magenta']).catch(e => error = e);
  expect(error.message).toContain('options[1]: expected object, got null');
});

it('should unselect with null', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/input/select.html');
  await page.evaluate(() => window['makeMultiple']());
  const result = await page.selectOption('select', ['blue', 'black', 'magenta']);
  expect(result.reduce((accumulator, current) => ['blue', 'black', 'magenta'].includes(current) && accumulator, true)).toEqual(true);
  await page.selectOption('select', null);
  expect(await page.$eval('select', select => Array.from(select.options).every(option => !option.selected))).toEqual(true);
});

it('should deselect all options when passed no values for a multiple select', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/input/select.html');
  await page.evaluate(() => window['makeMultiple']());
  await page.selectOption('select', ['blue', 'black', 'magenta']);
  await page.selectOption('select', []);
  expect(await page.$eval('select', select => Array.from(select.options).every(option => !option.selected))).toEqual(true);
});

it('should deselect all options when passed no values for a select without multiple', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/input/select.html');
  await page.selectOption('select', ['blue', 'black', 'magenta']);
  await page.selectOption('select', []);
  expect(await page.$eval('select', select => Array.from(select.options).every(option => !option.selected))).toEqual(true);
});

it('should throw if passed wrong types', async ({ page, server }) => {
  let error;
  await page.setContent('<select><option value="12"/></select>');

  error = null;
  try {
    // @ts-expect-error cannot select numbers
    await page.selectOption('select', 12);
  } catch (e) {
    error = e;
  }
  expect(error.message).toContain('options[0]: expected object, got number');

  error = null;
  try {
    // @ts-expect-error cannot select numbers
    await page.selectOption('select', { value: 12 });
  } catch (e) {
    error = e;
  }
  expect(error.message).toContain('options[0].value: expected string, got number');

  error = null;
  try {
    // @ts-expect-error cannot select numbers
    await page.selectOption('select', { label: 12 });
  } catch (e) {
    error = e;
  }
  expect(error.message).toContain('options[0].label: expected string, got number');

  error = null;
  try {
    // @ts-expect-error cannot select string indices
    await page.selectOption('select', { index: '12' });
  } catch (e) {
    error = e;
  }
  expect(error.message).toContain('options[0].index: expected number, got string');
});
// @see https://github.com/GoogleChrome/puppeteer/issues/3327
it('should work when re-defining top-level Event class', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/input/select.html');
  await page.evaluate(() => window.Event = null);
  await page.selectOption('select', 'blue');
  expect(await page.evaluate(() => window['result'].onInput)).toEqual(['blue']);
  expect(await page.evaluate(() => window['result'].onChange)).toEqual(['blue']);
});

it('should wait for option to be present', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/input/select.html');
  const selectPromise  = page.selectOption('select', 'scarlet');
  let didSelect = false;
  void selectPromise.then(() => didSelect = true);
  await giveItAChanceToResolve(page);
  expect(didSelect).toBe(false);
  await page.$eval('select', select => {
    const option = document.createElement('option');
    option.value = 'scarlet';
    option.textContent = 'Scarlet';
    select.appendChild(option);
  });
  const items = await selectPromise;
  expect(items).toStrictEqual(['scarlet']);
});

it('should wait for option index to be present', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/input/select.html');
  const len = await page.$eval('select', select => select.options.length);
  const selectPromise  = page.selectOption('select', { index: len });
  let didSelect = false;
  void selectPromise.then(() => didSelect = true);
  await giveItAChanceToResolve(page);
  expect(didSelect).toBe(false);
  await page.$eval('select', select => {
    const option = document.createElement('option');
    option.value = 'scarlet';
    option.textContent = 'Scarlet';
    select.appendChild(option);
  });
  const items = await selectPromise;
  expect(items).toStrictEqual(['scarlet']);
});

it('should wait for multiple options to be present', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/input/select.html');
  await page.evaluate(() => window['makeMultiple']());
  const selectPromise  = page.selectOption('select', ['green', 'scarlet']);
  let didSelect = false;
  void selectPromise.then(() => didSelect = true);
  await giveItAChanceToResolve(page);
  expect(didSelect).toBe(false);
  await page.$eval('select', select => {
    const option = document.createElement('option');
    option.value = 'scarlet';
    option.textContent = 'Scarlet';
    select.appendChild(option);
  });
  const items = await selectPromise;
  expect(items).toStrictEqual(['green', 'scarlet']);
});

it('input event.composed should be true and cross shadow dom boundary', async ({ page, server }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/28726' });
  await page.goto(server.EMPTY_PAGE);
  await page.setContent(`<body><script>
  const div = document.createElement('div');
  const shadowRoot = div.attachShadow({mode: 'open'});
  shadowRoot.innerHTML = \`<select>
    <option value="black">Black</option>
    <option value="blue">Blue</option>
  </select>\`;
  document.body.appendChild(div);
</script></body>`);
  await page.locator('body').evaluate(select => {
    (window as any).firedBodyEvents = [];
    for (const event of ['input', 'change']) {
      select.addEventListener(event, e => {
        (window as any).firedBodyEvents.push(e.type + ':' + e.composed);
      }, false);
    }
  });

  await page.locator('select').evaluate(select => {
    (window as any).firedEvents = [];
    for (const event of ['input', 'change']) {
      select.addEventListener(event, e => {
        (window as any).firedEvents.push(e.type + ':' + e.composed);
      }, false);
    }
  });
  await page.selectOption('select', 'blue');
  expect(await page.evaluate(() => window['firedEvents'])).toEqual(['input:true', 'change:false']);
  expect(await page.evaluate(() => window['firedBodyEvents'])).toEqual(['input:true']);
});

it('should wait for select to be enabled', async ({ page }) => {
  await page.setContent(`
    <select disabled>
      <option>one</option>
      <option>two</option>
    </select>

    <script>
    function hydrate() {
      const select = document.querySelector('select');
      select.removeAttribute('disabled');
      select.addEventListener('change', () => {
        window['result'] = select.value;
      });
    }
    </script>
  `);

  const selectPromise = page.locator('select').selectOption('two');
  await new Promise(f => setTimeout(f, 1000));
  await page.evaluate(() => (window as any).hydrate());
  await selectPromise;
  expect(await page.evaluate(() => window['result'])).toEqual('two');
  await expect(page.locator('select')).toHaveValue('two');
});

it('should wait for option to be enabled', async ({ page }) => {
  await page.setContent(`
    <select>
      <option>one</option>
      <option disabled id=myoption>two</option>
    </select>

    <script>
    function hydrate() {
      const option = document.querySelector('#myoption');
      option.removeAttribute('disabled');
      const select = document.querySelector('select');
      select.addEventListener('change', () => {
        window['result'] = select.value;
      });
    }
    </script>
  `);

  const error = await page.locator('select').selectOption('two', { timeout: 1000 }).catch(e => e);
  expect(error.message).toContain('option being selected is not enabled');

  const selectPromise = page.locator('select').selectOption('two');
  await new Promise(f => setTimeout(f, 1000));
  await page.evaluate(() => (window as any).hydrate());
  await selectPromise;
  expect(await page.evaluate(() => window['result'])).toEqual('two');
  await expect(page.locator('select')).toHaveValue('two');
});

it('should wait for optgroup to be enabled', async ({ page }) => {
  await page.setContent(`
    <select>
      <option>one</option>
      <optgroup label="Group" disabled id=mygroup>
        <option>two</option>
      </optgroup>
    </select>

    <script>
    function hydrate() {
      const group = document.querySelector('#mygroup');
      group.removeAttribute('disabled');
      const select = document.querySelector('select');
      select.addEventListener('change', () => {
        window['result'] = select.value;
      });
    }
    </script>
  `);

  const error = await page.locator('select').selectOption('two', { timeout: 1000 }).catch(e => e);
  expect(error.message).toContain('option being selected is not enabled');

  const selectPromise = page.locator('select').selectOption('two');
  await new Promise(f => setTimeout(f, 1000));
  await page.evaluate(() => (window as any).hydrate());
  await selectPromise;
  expect(await page.evaluate(() => window['result'])).toEqual('two');
  await expect(page.locator('select')).toHaveValue('two');
});

it('should wait for select to be swapped', async ({ page }) => {
  await page.setContent(`
    <select disabled>
      <option>one</option>
      <option>two</option>
    </select>

    <script>
    function hydrate() {
      const select = document.querySelector('select');
      select.remove();

      const newSelect = document.createElement('select');
      const option1 = document.createElement('option');
      option1.textContent = 'one';
      newSelect.appendChild(option1);
      const option2 = document.createElement('option');
      option2.textContent = 'two';
      newSelect.appendChild(option2);

      document.body.appendChild(newSelect);

      newSelect.addEventListener('change', () => {
        window['result'] = newSelect.value;
      });
    }
    </script>
  `);

  const selectPromise = page.locator('select').selectOption('two');
  await new Promise(f => setTimeout(f, 1000));
  await page.evaluate(() => (window as any).hydrate());
  await selectPromise;
  await expect(page.locator('select')).toHaveValue('two');
  expect(await page.evaluate(() => window['result'])).toEqual('two');
});
