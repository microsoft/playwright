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

it('element state checks should work as expected for label with zero-sized input', async ({ page, server }) => {
  await page.setContent(`
    <label>
      Click me
      <input disabled style="width:0;height:0;padding:0;margin:0;border:0;">
    </label>
  `);
  // Visible checks the label.
  expect(await page.isVisible('text=Click me')).toBe(true);
  expect(await page.isHidden('text=Click me')).toBe(false);

  // Enabled checks the input.
  expect(await page.isEnabled('text=Click me')).toBe(false);
  expect(await page.isDisabled('text=Click me')).toBe(true);
});

it('should wait for enclosing disabled button', async ({ page }) => {
  await page.setContent('<button><span>Target</span></button>');
  const span = (await page.$('text=Target'))!;
  let done = false;
  const promise = span.waitForElementState('disabled').then(() => done = true);
  await giveItAChanceToResolve(page);
  expect(done).toBe(false);
  await span.evaluate(span => (span.parentElement as HTMLButtonElement).disabled = true);
  await promise;
});

it('should wait for enclosing button with a disabled fieldset', async ({ page }) => {
  await page.setContent('<fieldset disabled=true><button><span>Target</span></button></div>');
  const span = (await page.$('text=Target'))!;
  let done = false;
  const promise = span.waitForElementState('enabled').then(() => done = true);
  await giveItAChanceToResolve(page);
  expect(done).toBe(false);
  await span.evaluate((span: HTMLElement) => (span.parentElement!.parentElement as HTMLFieldSetElement).disabled = false);
  await promise;
});

it('should wait for enclosing enabled button', async ({ page, server }) => {
  await page.setContent('<button disabled><span>Target</span></button>');
  const span = (await page.$('text=Target'))!;
  let done = false;
  const promise = span.waitForElementState('enabled').then(() => done = true);
  await giveItAChanceToResolve(page);
  expect(done).toBe(false);
  await span.evaluate(span => (span.parentElement as HTMLButtonElement).disabled = false);
  await promise;
});

it('should check the box outside shadow dom label', async ({ page }) => {
  await page.setContent('<div></div>');
  await page.$eval('div', div => {
    const root = div.attachShadow({ mode: 'open' });
    const label = document.createElement('label');
    label.setAttribute('for', 'target');
    label.textContent = 'Click me';
    root.appendChild(label);
    const input = document.createElement('input');
    input.setAttribute('type', 'checkbox');
    input.setAttribute('id', 'target');
    root.appendChild(input);
  });
  await page.check('label');
  expect(await page.$eval('input', input => input.checked)).toBe(true);
});

it('setInputFiles should work with label', async ({ page, asset }) => {
  await page.setContent(`<label for=target>Choose a file</label><input id=target type=file>`);
  await page.setInputFiles('text=Choose a file', asset('file-to-upload.txt'));
  expect(await page.$eval('input', (input: HTMLInputElement) => input.files!.length)).toBe(1);
  expect(await page.$eval('input', (input: HTMLInputElement) => input.files?.[0].name)).toBe('file-to-upload.txt');
});

type Options = { disabled?: boolean, hidden?: boolean, readonly?: boolean };
const optionsToAttributes = (options: Options | undefined) => ` ${options?.disabled ? 'disabled' : ''} ${options?.hidden ? 'hidden' : ''} ${options?.readonly ? 'readonly' : ''} `;
const domInLabel = (dom: string, options?: Options) => `<label ${optionsToAttributes(options)}>Text ${dom}</label>`;
const domLabelFor = (dom: string, options?: Options) => `<label ${optionsToAttributes(options)} for="target"><h1>Text</h1></label>${dom}`;
const domStandalone = (dom: string) => dom;
const domInButton = (dom: string, options?: Options) => `<button ${optionsToAttributes(options)}>Button ${dom}</button>`;
const domInLink = (dom: string, options?: Options) => `<button ${optionsToAttributes(options)}>Button ${dom}</button>`;

it('enabled/disabled retargeting', async ({ page, asset }) => {
  const cases = [
    { dom: domInLabel(`<input id=target>`), enabled: true, locator: 'label' },
    { dom: domLabelFor(`<input id=target>`), enabled: true, locator: 'label' },
    { dom: domStandalone(`<input id=target>`), enabled: true, locator: 'input' },
    { dom: domInButton(`<input id=target>`), enabled: true, locator: 'input' },
    { dom: domInLink(`<input id=target>`), enabled: true, locator: 'input' },
    { dom: domInButton(`<input id=target>`, { disabled: true }), enabled: true, locator: 'input' },

    { dom: domInLabel(`<input id=target disabled>`), enabled: false, locator: 'label' },
    { dom: domLabelFor(`<input id=target disabled>`), enabled: false, locator: 'label' },
    { dom: domStandalone(`<input id=target disabled>`), enabled: false, locator: 'input' },
    { dom: domInButton(`<input id=target disabled>`), enabled: false, locator: 'input' },
    { dom: domInLink(`<input id=target disabled>`), enabled: false, locator: 'input' },
    { dom: domInButton(`<input id=target disabled>`, { disabled: true }), enabled: false, locator: 'input' },
  ];
  for (const { dom, enabled, locator } of cases) {
    await it.step(`"${locator}" in "${dom}" should be enabled=${enabled}`, async () => {
      await page.setContent(dom);
      const target = page.locator(locator);
      const handle = (await page.$(locator))!;
      expect(await target.isEnabled()).toBe(enabled);
      expect(await target.isDisabled()).toBe(!enabled);
      if (enabled) {
        await expect(target).toBeEnabled();
        await expect(target).not.toBeDisabled();
        await handle.waitForElementState('enabled');
      } else {
        await expect(target).not.toBeEnabled();
        await expect(target).toBeDisabled();
        await handle.waitForElementState('disabled');
      }
    });
  }
});

it('visible/hidden retargeting', async ({ page, asset }) => {
  const cases = [
    { dom: domInLabel(`<span id=target>content</span>`), visible: true, locator: 'label' },
    { dom: domInLabel(`<span id=target hidden>content</span>`), visible: true, locator: 'label' },
    { dom: domLabelFor(`<span id=target>content</span>`), visible: true, locator: 'label' },
    { dom: domLabelFor(`<span id=target hidden>content</span>`), visible: true, locator: 'label' },
    { dom: domStandalone(`<span id=target>content</span>`), visible: true, locator: 'span' },
    { dom: domInButton(`<span id=target>content</span>`), visible: true, locator: 'span' },
    { dom: domInLink(`<span id=target>content</span>`), visible: true, locator: 'span' },

    { dom: domInLabel(`<span id=target>content</span>`, { hidden: true }), visible: false, locator: 'label' },
    { dom: domLabelFor(`<span id=target>content</span>`, { hidden: true }), visible: false, locator: 'label' },
    { dom: domStandalone(`<span id=target hidden>content</span>`), visible: false, locator: 'span' },
    { dom: domInButton(`<span id=target hidden>content</span>`), visible: false, locator: 'span' },
    { dom: domInButton(`<span id=target>content</span>`, { hidden: true }), visible: false, locator: 'span' },
    { dom: domInLink(`<span id=target hidden>content</span>`), visible: false, locator: 'span' },
    { dom: domInLink(`<span id=target>content</span>`, { hidden: true }), visible: false, locator: 'span' },
  ];
  for (const { dom, visible, locator } of cases) {
    await it.step(`"${locator}" in "${dom}" should be visible=${visible}`, async () => {
      await page.setContent(dom);
      const target = page.locator(locator);
      const handle = (await page.$(locator))!;
      expect(await target.isVisible()).toBe(visible);
      expect(await target.isHidden()).toBe(!visible);
      if (visible) {
        await expect(target).toBeVisible();
        await expect(target).not.toBeHidden();
        await handle.waitForElementState('visible');
      } else {
        await expect(target).not.toBeVisible();
        await expect(target).toBeHidden();
        await handle.waitForElementState('hidden');
      }
    });
  }
});

it('editable retargeting', async ({ page, asset }) => {
  const cases = [
    { dom: domInLabel(`<input id=target>`), editable: true, locator: 'label' },
    { dom: domLabelFor(`<input id=target>`), editable: true, locator: 'label' },
    { dom: domStandalone(`<input id=target>`), editable: true, locator: 'input' },
    { dom: domInButton(`<input id=target>`), editable: true, locator: 'input' },
    { dom: domInLink(`<input id=target>`), editable: true, locator: 'input' },
    { dom: domInButton(`<input id=target>`, { readonly: true }), editable: true, locator: 'input' },

    { dom: domInLabel(`<input id=target readonly>`), editable: false, locator: 'label' },
    { dom: domLabelFor(`<input id=target readonly>`), editable: false, locator: 'label' },
    { dom: domStandalone(`<input id=target readonly>`), editable: false, locator: 'input' },
    { dom: domInButton(`<input id=target readonly>`), editable: false, locator: 'input' },
    { dom: domInLink(`<input id=target readonly>`), editable: false, locator: 'input' },
    { dom: domInButton(`<input id=target readonly>`, { readonly: true }), editable: false, locator: 'input' },
  ];
  for (const { dom, editable, locator } of cases) {
    await it.step(`"${locator}" in "${dom}" should be editable=${editable}`, async () => {
      await page.setContent(dom);
      const target = page.locator(locator);
      const handle = (await page.$(locator))!;
      expect(await target.isEditable()).toBe(editable);
      if (editable) {
        await expect(target).toBeEditable();
        await handle.waitForElementState('editable');
      } else {
        await expect(target).not.toBeEditable();
      }
    });
  }
});

it('input value retargeting', async ({ page, browserName }) => {
  const cases = [
    { dom: domInLabel(`<input id=target>`), locator: 'label' },
    { dom: domLabelFor(`<input id=target>`), locator: 'label' },
    { dom: domStandalone(`<input id=target>`), locator: 'input' },
    { dom: domInButton(`<input id=target>`), locator: 'input' },
    { dom: domInLink(`<input id=target>`), locator: 'input' },
    { dom: domInButton(`<input id=target>`), locator: 'input' },
  ];
  for (const { dom, locator } of cases) {
    await it.step(`"${locator}" in "${dom}" input value`, async () => {
      await page.setContent(dom);
      const target = page.locator(locator);
      const handle = (await page.$(locator))!;

      expect(await target.inputValue()).toBe('');
      expect(await handle.inputValue()).toBe('');
      await expect(target).toHaveValue('');

      await target.fill('foo');
      expect(await target.inputValue()).toBe('foo');
      expect(await handle.inputValue()).toBe('foo');
      await expect(target).toHaveValue('foo');

      await page.$eval('#target', (input: HTMLInputElement) => input.value = 'bar');
      expect(await target.inputValue()).toBe('bar');
      expect(await handle.inputValue()).toBe('bar');
      await expect(target).toHaveValue('bar');

      await target.selectText();
      if (browserName === 'firefox' || browserName === 'webkit') {
        expect(await page.locator('#target').evaluate((el: HTMLInputElement) => el.selectionStart)).toBe(0);
        expect(await page.locator('#target').evaluate((el: HTMLInputElement) => el.selectionEnd)).toBe(3);
      } else {
        expect(await page.evaluate(() => window.getSelection()!.toString())).toBe('bar');
      }
    });
  }
});

it('selection retargeting', async ({ page, browserName }) => {
  const cases = [
    { dom: domStandalone(`<div contenteditable id=target>content</div>`), locator: 'div' },
    { dom: domInButton(`<div contenteditable id=target>content</div>`), locator: 'div' },
    { dom: domInLink(`<div contenteditable id=target>content</div>`), locator: 'div' },
    { dom: domInButton(`<div contenteditable id=target>content</div>`), locator: 'div' },
  ];
  for (const { dom, locator } of cases) {
    await it.step(`"${locator}" in "${dom}" text selection`, async () => {
      await page.setContent(dom);
      const target = page.locator(locator);
      const handle = (await page.$(locator))!;

      expect(await target.isEditable()).toBe(true);
      expect(await handle.isEditable()).toBe(true);
      await expect(page.locator('#target')).toHaveText('content');

      await target.fill('foo');
      await expect(page.locator('#target')).toHaveText('foo');

      await target.selectText();
      if (browserName === 'firefox') {
        expect(await page.$eval('#target', target => {
          const selection = window.getSelection()!;
          return selection.anchorNode === target && selection.focusNode === target;
        })).toBe(true);
      } else {
        expect(await page.evaluate(() => window.getSelection()!.toString())).toBe('foo');
      }
    });
  }
});

it('select options retargeting', async ({ page }) => {
  const cases = [
    { dom: domInLabel(`<select id=target multiple><option value=dog selected>Dog</option><option value=cat>Cat</option></select>`), locator: 'label' },
    { dom: domLabelFor(`<select id=target multiple><option value=dog selected>Dog</option><option value=cat>Cat</option></select>`), locator: 'label' },
    { dom: domStandalone(`<select id=target multiple><option value=dog selected>Dog</option><option value=cat>Cat</option></select>`), locator: 'select' },
    { dom: domInButton(`<select id=target multiple><option value=dog selected>Dog</option><option value=cat>Cat</option></select>`), locator: 'select' },
    { dom: domInLink(`<select id=target multiple><option value=dog selected>Dog</option><option value=cat>Cat</option></select>`), locator: 'select' },
    { dom: domInButton(`<select id=target multiple><option value=dog selected>Dog</option><option value=cat>Cat</option></select>`), locator: 'select' },
  ];
  for (const { dom, locator } of cases) {
    await it.step(`"${locator}" in "${dom}" select option`, async () => {
      await page.setContent(dom);
      const target = page.locator(locator);
      const handle = (await page.$(locator))!;

      expect(await target.inputValue()).toBe('dog');
      expect(await handle.inputValue()).toBe('dog');
      await expect(target).toHaveValue('dog');
      await expect(target).toHaveValues(['dog']);

      await target.selectOption('cat');
      expect(await target.inputValue()).toBe('cat');
      expect(await handle.inputValue()).toBe('cat');
      await expect(target).toHaveValue('cat');
      await expect(target).toHaveValues(['cat']);
    });
  }
});

it('direct actions retargeting', async ({ page }) => {
  const cases = [
    { dom: domInLabel(`<div>content</div><input id=target value=oh>`), locator: 'div' },
    { dom: domLabelFor(`<div>content</div><input id=target value=oh>`), locator: 'div' },
    { dom: domStandalone(`<div>content</div>`), locator: 'div' },
    { dom: domInButton(`<div>content</div>`), locator: 'div' },
    { dom: domInLink(`<div>content</div>`), locator: 'div' },
    { dom: domInButton(`<div>content</div>`), locator: 'div' },
  ];
  for (const { dom, locator } of cases) {
    await it.step(`"${locator}" in "${dom}" direct actions`, async () => {
      await page.setContent(dom);
      const target = page.locator(locator);

      expect(await target.innerText()).toBe('content');
      expect(await target.textContent()).toBe('content');
      await expect(target).toHaveText('content');
      await expect(target).toContainText('content');
      await expect(target).not.toBeFocused();
      await expect(target).toHaveCount(1);

      await page.$eval('div', div => (div as any).foo = 'bar');
      await expect(target).toHaveJSProperty('foo', 'bar');

      await page.$eval('div', div => div.classList.add('cls'));
      await expect(target).toHaveClass('cls');

      await page.$eval('div', div => div.id = 'myid');
      await expect(target).toHaveId('myid');
      await expect(target).toHaveAttribute('id', 'myid');
      expect(await target.getAttribute('id')).toBe('myid');
    });
  }
});

it('check retargeting', async ({ page, asset }) => {
  const cases = [
    { dom: domInLabel(`<input type=checkbox id=target>`), locator: 'label' },
    { dom: domLabelFor(`<input type=checkbox id=target>`), locator: 'label' },
    { dom: domStandalone(`<input type=checkbox id=target>`), locator: 'input' },
    { dom: domInButton(`<input type=checkbox id=target>`), locator: 'input' },
    { dom: domInLink(`<input type=checkbox id=target>`), locator: 'input' },
    { dom: domInButton(`<input type=checkbox id=target>`), locator: 'input' },
  ];
  for (const { dom, locator } of cases) {
    await it.step(`"${locator}" in "${dom}" check`, async () => {
      await page.setContent(dom);
      const target = page.locator(locator);
      expect(await target.isChecked()).toBe(false);
      await expect(target).not.toBeChecked();
      await expect(target).toBeChecked({ checked: false });

      await page.$eval('input', (input: HTMLInputElement) => input.checked = true);
      expect(await target.isChecked()).toBe(true);
      await expect(target).toBeChecked();
      await expect(target).toBeChecked({ checked: true });

      await target.uncheck();
      expect(await page.$eval('input', (input: HTMLInputElement) => input.checked)).toBe(false);

      await target.check();
      expect(await page.$eval('input', (input: HTMLInputElement) => input.checked)).toBe(true);

      await target.setChecked(false);
      expect(await page.$eval('input', (input: HTMLInputElement) => input.checked)).toBe(false);
    });
  }
});

it('should not retarget anchor into parent label', async ({ page }) => {
  await page.setContent(`
    <label disabled>Text<a href='#' onclick='window.__clicked=1'>Target</a></label>
  `);
  await page.locator('a').click();
  expect(await page.evaluate('window.__clicked')).toBe(1);

  await page.setContent(`
    <input type="radio" id="input-id" checked disabled />
    <label for="input-id">Text<a href='#' onclick='window.__clicked=2'>Target</a></label>
  `);
  await page.locator('a').click();
  expect(await page.evaluate('window.__clicked')).toBe(2);
});
