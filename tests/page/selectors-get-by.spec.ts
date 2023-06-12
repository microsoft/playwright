/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
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

import { test as it, expect } from './pageTest';

it('getByTestId should work', async ({ page }) => {
  await page.setContent('<div><div data-testid="Hello">Hello world</div></div>');
  await expect(page.getByTestId('Hello')).toHaveText('Hello world');
  await expect(page.mainFrame().getByTestId('Hello')).toHaveText('Hello world');
  await expect(page.locator('div').getByTestId('Hello')).toHaveText('Hello world');
});

it('getByTestId with custom testId should work', async ({ page, playwright }) => {
  await page.setContent('<div><div data-my-custom-testid="Hello">Hello world</div></div>');
  playwright.selectors.setTestIdAttribute('data-my-custom-testid');
  await expect(page.getByTestId('Hello')).toHaveText('Hello world');
  await expect(page.mainFrame().getByTestId('Hello')).toHaveText('Hello world');
  await expect(page.locator('div').getByTestId('Hello')).toHaveText('Hello world');
});

it('getByTestId should escape id', async ({ page }) => {
  await page.setContent(`<div><div data-testid='He"llo'>Hello world</div></div>`);
  await expect(page.getByTestId('He"llo')).toHaveText('Hello world');
});

it('getByTestId should work for regex', async ({ page }) => {
  await page.setContent('<div><div data-testid="Hello">Hello world</div></div>');
  await expect(page.getByTestId(/He[l]*o/)).toHaveText('Hello world');
  await expect(page.mainFrame().getByTestId('Hello')).toHaveText('Hello world');
  await expect(page.locator('div').getByTestId('Hello')).toHaveText('Hello world');
});

it('getByText should work', async ({ page }) => {
  await page.setContent(`<div>yo</div><div>ya</div><div>\nye  </div>`);
  expect(await page.getByText('ye').evaluate(e => e.outerHTML)).toContain('>\nye  </div>');
  expect(await page.getByText(/ye/).evaluate(e => e.outerHTML)).toContain('>\nye  </div>');
  expect(await page.getByText(/e/).evaluate(e => e.outerHTML)).toContain('>\nye  </div>');

  await page.setContent(`<div> ye </div><div>ye</div>`);
  expect(await page.getByText('ye', { exact: true }).first().evaluate(e => e.outerHTML)).toContain('> ye </div>');

  await page.setContent(`<div>Hello world</div><div>Hello</div>`);
  expect(await page.getByText('Hello', { exact: true }).evaluate(e => e.outerHTML)).toContain('>Hello</div>');
});

it('getByLabel should work', async ({ page }) => {
  await page.setContent(`<div><label for=target>Name</label><input id=target type=text></div>`);
  expect(await page.getByText('Name').evaluate(e => e.nodeName)).toBe('LABEL');
  expect(await page.getByLabel('Name').evaluate(e => e.nodeName)).toBe('INPUT');
  expect(await page.mainFrame().getByLabel('Name').evaluate(e => e.nodeName)).toBe('INPUT');
  expect(await page.locator('div').getByLabel('Name').evaluate(e => e.nodeName)).toBe('INPUT');
});

it('getByLabel should work with nested elements', async ({ page }) => {
  await page.setContent(`<label for=target>Last <span>Name</span></label><input id=target type=text>`);

  await expect(page.getByLabel('last name')).toHaveAttribute('id', 'target');
  await expect(page.getByLabel('st na')).toHaveAttribute('id', 'target');
  await expect(page.getByLabel('Name')).toHaveAttribute('id', 'target');
  await expect(page.getByLabel('Last Name', { exact: true })).toHaveAttribute('id', 'target');
  await expect(page.getByLabel(/Last\s+name/i)).toHaveAttribute('id', 'target');

  expect(await page.getByLabel('Last', { exact: true }).elementHandles()).toEqual([]);
  expect(await page.getByLabel('last name', { exact: true }).elementHandles()).toEqual([]);
  expect(await page.getByLabel('Name', { exact: true }).elementHandles()).toEqual([]);
  expect(await page.getByLabel('what?').elementHandles()).toEqual([]);
  expect(await page.getByLabel(/last name/).elementHandles()).toEqual([]);
});

it('getByLabel should work with multiply-labelled input', async ({ page }) => {
  await page.setContent(`<label for=target>Name</label><input id=target type=text><label for=target>First or Last</label>`);
  expect(await page.getByLabel('Name').evaluate(e => e.id)).toBe('target');
  expect(await page.getByLabel('First or Last').evaluate(e => e.id)).toBe('target');
});

it('getByLabel should work with ancestor label and multiple controls', async ({ page }) => {
  await page.setContent(`<label>Name<button id=target>Click me</button><input type=text></label>`);
  expect(await page.getByLabel('Name').evaluate(e => e.id)).toBe('target');
});

it('getByLabel should work with ancestor label and for', async ({ page }) => {
  await page.setContent(`
    <label for=target>Name<input type=text id=nontarget></label>
    <input type=text id=target>
  `);
  expect(await page.getByLabel('Name').evaluate(e => e.id)).toBe('target');
});

it('getByLabel should work with aria-labelledby', async ({ page }) => {
  await page.setContent(`<label id=name-label>Name</label><button aria-labelledby=name-label>Click me</button>`);
  expect(await page.getByLabel('Name').evaluate(e => e.textContent)).toBe('Click me');
});

it('getByLabel should prioritize aria-labelledby over native label', async ({ page }) => {
  await page.setContent(`
    <label id=name-label>Name</label>
    <label>Wrong<button aria-labelledby=name-label>Click me</button></label>
  `);
  expect(await page.getByLabel('Name').evaluate(e => e.textContent)).toBe('Click me');
});

it('getByLabel should work with aria-label', async ({ page }) => {
  await page.setContent(`<input id=target aria-label="Name">`);
  expect(await page.getByLabel('Name').evaluate(e => e.id)).toBe('target');
});

it('getByLabel should ignore empty aria-label', async ({ page }) => {
  await page.setContent(`<label for=target>Last Name</label><input id=target type=text aria-label>`);
  expect(await page.getByLabel('Last Name').evaluate(e => e.id)).toBe('target');
});

it('getByLabel should prioritize aria-labelledby over aria-label', async ({ page }) => {
  await page.setContent(`<label id=other-label>Other</label><input id=target aria-label="Name" aria-labelledby=other-label>`);
  expect(await page.getByLabel('Other').evaluate(e => e.id)).toBe('target');
});

it('getByPlaceholder should work', async ({ page }) => {
  await page.setContent(`<div>
    <input placeholder='Hello'>
    <input placeholder='Hello World'>
  </div>`);
  await expect(page.getByPlaceholder('hello')).toHaveCount(2);
  await expect(page.getByPlaceholder('Hello', { exact: true })).toHaveCount(1);
  await expect(page.getByPlaceholder(/wor/i)).toHaveCount(1);

  // Coverage
  await expect(page.mainFrame().getByPlaceholder('hello')).toHaveCount(2);
  await expect(page.locator('div').getByPlaceholder('hello')).toHaveCount(2);
});

it('getByAltText should work', async ({ page }) => {
  await page.setContent(`<div>
    <input alt='Hello'>
    <input alt='Hello World'>
  </div>`);
  await expect(page.getByAltText('hello')).toHaveCount(2);
  await expect(page.getByAltText('Hello', { exact: true })).toHaveCount(1);
  await expect(page.getByAltText(/wor/i)).toHaveCount(1);

  // Coverage
  await expect(page.mainFrame().getByAltText('hello')).toHaveCount(2);
  await expect(page.locator('div').getByAltText('hello')).toHaveCount(2);
});

it('getByTitle should work', async ({ page }) => {
  await page.setContent(`<div>
    <input title='Hello'>
    <input title='Hello World'>
  </div>`);
  await expect(page.getByTitle('hello')).toHaveCount(2);
  await expect(page.getByTitle('Hello', { exact: true })).toHaveCount(1);
  await expect(page.getByTitle(/wor/i)).toHaveCount(1);

  // Coverage
  await expect(page.mainFrame().getByTitle('hello')).toHaveCount(2);
  await expect(page.locator('div').getByTitle('hello')).toHaveCount(2);
});

it('getBy escaping', async ({ page }) => {
  await page.setContent(`<label id=label for=control>Hello my
wo"rld</label><input id=control />`);
  await page.$eval('input', input => {
    input.setAttribute('placeholder', 'hello my\nwo"rld');
    input.setAttribute('title', 'hello my\nwo"rld');
    input.setAttribute('alt', 'hello my\nwo"rld');
  });
  await expect.soft(page.getByText('hello my\nwo"rld')).toHaveAttribute('id', 'label');
  await expect.soft(page.getByText('hello       my     wo"rld')).toHaveAttribute('id', 'label');
  await expect.soft(page.getByLabel('hello my\nwo"rld')).toHaveAttribute('id', 'control');
  await expect.soft(page.getByPlaceholder('hello my\nwo"rld')).toHaveAttribute('id', 'control');
  await expect.soft(page.getByAltText('hello my\nwo"rld')).toHaveAttribute('id', 'control');
  await expect.soft(page.getByTitle('hello my\nwo"rld')).toHaveAttribute('id', 'control');

  await page.setContent(`<label id=label for=control>Hello my
world</label><input id=control />`);
  await page.$eval('input', input => {
    input.setAttribute('placeholder', 'hello my\nworld');
    input.setAttribute('title', 'hello my\nworld');
    input.setAttribute('alt', 'hello my\nworld');
  });
  await expect.soft(page.getByText('hello my\nworld')).toHaveAttribute('id', 'label');
  await expect.soft(page.getByText('hello        my    world')).toHaveAttribute('id', 'label');
  await expect.soft(page.getByLabel('hello my\nworld')).toHaveAttribute('id', 'control');
  await expect.soft(page.getByPlaceholder('hello my\nworld')).toHaveAttribute('id', 'control');
  await expect.soft(page.getByAltText('hello my\nworld')).toHaveAttribute('id', 'control');
  await expect.soft(page.getByTitle('hello my\nworld')).toHaveAttribute('id', 'control');

  await page.setContent(`<div id=target title="my title">Text here</div>`);
  await expect.soft(page.getByTitle('my title', { exact: true })).toHaveCount(1, { timeout: 500 });
  await expect.soft(page.getByTitle('my t\itle', { exact: true })).toHaveCount(1, { timeout: 500 });
  await expect.soft(page.getByTitle('my t\\itle', { exact: true })).toHaveCount(0, { timeout: 500 });
  await expect.soft(page.getByTitle('my t\\\itle', { exact: true })).toHaveCount(0, { timeout: 500 });
  await expect.soft(page.getByTitle('my t\\\\itle', { exact: true })).toHaveCount(0, { timeout: 500 });

  await page.setContent(`<label for=target>foo &gt;&gt; bar</label><input id=target>`);
  await page.$eval('input', input => {
    input.setAttribute('placeholder', 'foo >> bar');
    input.setAttribute('title', 'foo >> bar');
    input.setAttribute('alt', 'foo >> bar');
  });
  expect.soft(await page.getByText('foo >> bar').textContent()).toBe('foo >> bar');
  await expect.soft(page.locator('label')).toHaveText('foo >> bar');
  await expect.soft(page.getByText('foo >> bar')).toHaveText('foo >> bar');
  expect.soft(await page.getByText(/foo >> bar/).textContent()).toBe('foo >> bar');
  await expect.soft(page.getByLabel('foo >> bar')).toHaveAttribute('id', 'target');
  await expect.soft(page.getByLabel(/foo >> bar/)).toHaveAttribute('id', 'target');
  await expect.soft(page.getByPlaceholder('foo >> bar')).toHaveAttribute('id', 'target');
  await expect.soft(page.getByAltText('foo >> bar')).toHaveAttribute('id', 'target');
  await expect.soft(page.getByTitle('foo >> bar')).toHaveAttribute('id', 'target');
  await expect.soft(page.getByPlaceholder(/foo >> bar/)).toHaveAttribute('id', 'target');
  await expect.soft(page.getByAltText(/foo >> bar/)).toHaveAttribute('id', 'target');
  await expect.soft(page.getByTitle(/foo >> bar/)).toHaveAttribute('id', 'target');
});

it('getByRole escaping', async ({ page }) => {
  await page.setContent(`
    <a href="https://playwright.dev">issues 123</a>
    <a href="https://playwright.dev">he llo 56</a>
    <button>Click me</button>
  `);
  expect.soft(await page.getByRole('button').evaluateAll(els => els.map(e => e.outerHTML))).toEqual([
    `<button>Click me</button>`,
  ]);
  expect.soft(await page.getByRole('link').evaluateAll(els => els.map(e => e.outerHTML))).toEqual([
    `<a href="https://playwright.dev">issues 123</a>`,
    `<a href="https://playwright.dev">he llo 56</a>`,
  ]);

  expect.soft(await page.getByRole('link', { name: 'issues 123' }).evaluateAll(els => els.map(e => e.outerHTML))).toEqual([
    `<a href="https://playwright.dev">issues 123</a>`,
  ]);
  expect.soft(await page.getByRole('link', { name: 'sues' }).evaluateAll(els => els.map(e => e.outerHTML))).toEqual([
    `<a href="https://playwright.dev">issues 123</a>`,
  ]);
  expect.soft(await page.getByRole('link', { name: '  he    \n  llo ' }).evaluateAll(els => els.map(e => e.outerHTML))).toEqual([
    `<a href="https://playwright.dev">he llo 56</a>`,
  ]);
  expect.soft(await page.getByRole('button', { name: 'issues' }).evaluateAll(els => els.map(e => e.outerHTML))).toEqual([
  ]);

  expect.soft(await page.getByRole('link', { name: 'sues', exact: true }).evaluateAll(els => els.map(e => e.outerHTML))).toEqual([
  ]);
  expect.soft(await page.getByRole('link', { name: '   he \n llo 56 ', exact: true }).evaluateAll(els => els.map(e => e.outerHTML))).toEqual([
    `<a href="https://playwright.dev">he llo 56</a>`,
  ]);

  expect.soft(await page.getByRole('button', { name: 'Click me', exact: true }).evaluateAll(els => els.map(e => e.outerHTML))).toEqual([
    `<button>Click me</button>`,
  ]);
  expect.soft(await page.getByRole('button', { name: 'Click \me', exact: true }).evaluateAll(els => els.map(e => e.outerHTML))).toEqual([
    `<button>Click me</button>`,
  ]);
  expect.soft(await page.getByRole('button', { name: 'Click \\me', exact: true }).evaluateAll(els => els.map(e => e.outerHTML))).toEqual([
  ]);
  expect.soft(await page.getByRole('button', { name: 'Click \\\me', exact: true }).evaluateAll(els => els.map(e => e.outerHTML))).toEqual([
  ]);
  expect.soft(await page.getByRole('button', { name: 'Click \\\\me', exact: true }).evaluateAll(els => els.map(e => e.outerHTML))).toEqual([
  ]);
});
