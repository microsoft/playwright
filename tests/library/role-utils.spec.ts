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

import { contextTest as test, expect } from '../config/browserTest';
import type { Page } from 'playwright-core';
import fs from 'fs';

test.skip(({ mode }) => mode !== 'default');

async function getNameAndRole(page: Page, selector: string) {
  return await page.$eval(selector, e => {
    const name = (window as any).__injectedScript.getElementAccessibleName(e);
    const role = (window as any).__injectedScript.getAriaRole(e);
    return { name, role };
  });
}

const ranges = [
  'name_test_case_539-manual.html',
  'name_test_case_721-manual.html',
];

for (let range = 0; range <= ranges.length; range++) {
  test('wpt accname #' + range, async ({ page, asset, server, browserName }) => {
    const skipped = [
      // Spec clearly says to only use control's value when embedded in a label (step 2C).
      'name_heading-combobox-focusable-alternative-manual.html',
      // This test expects ::before + title + ::after, which is neither 2F nor 2I.
      'name_test_case_659-manual.html',
      // This test expects ::before + title + ::after, which is neither 2F nor 2I.
      'name_test_case_660-manual.html',
    ];
    if (browserName === 'firefox') {
      // This test contains the following style:
      //   [data-after]:after { content: attr(data-after); }
      // In firefox, content is returned as "attr(data-after)"
      // instead of being resolved to the actual value.
      skipped.push('name_test_case_553-manual.html');
    }

    await page.addInitScript(() => {
      const self = window as any;
      self.setup = () => {};
      self.ATTAcomm = class {
        constructor(data) {
          self.steps = [];
          for (const step of data.steps) {
            if (!step.test.ATK)
              continue;
            for (const atk of step.test.ATK) {
              if (atk[0] !== 'property' || atk[1] !== 'name' || atk[2] !== 'is' || typeof atk[3] !== 'string')
                continue;
              self.steps.push({ selector: '#' + step.element, name: atk[3] });
            }
          }
        }
      };
    });

    const testDir = asset('wpt/accname');
    const testFiles = fs.readdirSync(testDir, { withFileTypes: true }).filter(e => e.isFile() && e.name.endsWith('.html')).map(e => e.name);
    for (const testFile of testFiles) {
      if (skipped.includes(testFile))
        continue;
      const included = (range === 0 || testFile >= ranges[range - 1]) && (range === ranges.length || testFile < ranges[range]);
      if (!included)
        continue;
      await test.step(testFile, async () => {
        await page.goto(server.PREFIX + `/wpt/accname/` + testFile);
        // Use $eval to force injected script.
        const result = await page.$eval('body', () => {
          const result = [];
          for (const step of (window as any).steps) {
            const element = document.querySelector(step.selector);
            if (!element)
              throw new Error(`Unable to resolve "${step.selector}"`);
            const received = (window as any).__injectedScript.getElementAccessibleName(element);
            result.push({ selector: step.selector, expected: step.name, received });
          }
          return result;
        });
        for (const { selector, expected, received } of result)
          expect.soft(received, `checking "${selector}" in ${testFile}`).toBe(expected);
      });
    }
  });
}

test('axe-core implicit-role', async ({ page, asset, server }) => {
  await page.goto(server.EMPTY_PAGE);
  const testCases = require(asset('axe-core/implicit-role'));
  for (const testCase of testCases) {
    await test.step(`checking ${JSON.stringify(testCase)}`, async () => {
      await page.setContent(`
        <body>
          ${testCase.html}
        </body>
      `);
      // Use $eval to force injected script.
      const received = await page.$eval('body', (_, selector) => {
        const element = document.querySelector(selector);
        if (!element)
          throw new Error(`Unable to resolve "${selector}"`);
        return (window as any).__injectedScript.getAriaRole(element);
      }, testCase.target);
      expect.soft(received, `checking ${JSON.stringify(testCase)}`).toBe(testCase.role);
    });
  }
});

test('axe-core accessible-text', async ({ page, asset, server }) => {
  await page.goto(server.EMPTY_PAGE);
  const testCases = require(asset('axe-core/accessible-text'));
  for (const testCase of testCases) {
    await test.step(`checking ${JSON.stringify(testCase)}`, async () => {
      await page.setContent(`
        <body>
          ${testCase.html}
        </body>
        <script>
          for (const template of document.querySelectorAll("template[shadow]")) {
            const shadowRoot = template.parentElement.attachShadow({ mode: 'open' });
            shadowRoot.appendChild(template.content);
            template.remove();
          }
        </script>
      `);
      // Use $eval to force injected script.
      const targets = toArray(testCase.target);
      const expected = toArray(testCase.accessibleText);
      const received = await page.$eval('body', (_, selectors) => {
        return selectors.map(selector => {
          const injected = (window as any).__injectedScript;
          const element = injected.querySelector(injected.parseSelector('css=' + selector), document, false);
          if (!element)
            throw new Error(`Unable to resolve "${selector}"`);
          return injected.getElementAccessibleName(element);
        });
      }, targets);
      expect.soft(received, `checking ${JSON.stringify(testCase)}`).toEqual(expected);
    });
  }
});

test('accessible name with slots', async ({ page }) => {
  // Text "foo" is assigned to the slot, should not be used twice.
  await page.setContent(`
    <button><div>foo</div></button>
    <script>
      (() => {
        const container = document.querySelector('div');
        const shadow = container.attachShadow({ mode: 'open' });
        const slot = document.createElement('slot');
        shadow.appendChild(slot);
      })();
    </script>
  `);
  expect.soft(await getNameAndRole(page, 'button')).toEqual({ role: 'button', name: 'foo' });

  // Text "foo" is assigned to the slot, should be used instead of slot content.
  await page.setContent(`
    <div>foo</div>
    <script>
      (() => {
        const container = document.querySelector('div');
        const shadow = container.attachShadow({ mode: 'open' });
        const button = document.createElement('button');
        shadow.appendChild(button);
        const slot = document.createElement('slot');
        button.appendChild(slot);
        const span = document.createElement('span');
        span.textContent = 'pre';
        slot.appendChild(span);
      })();
    </script>
  `);
  expect.soft(await getNameAndRole(page, 'button')).toEqual({ role: 'button', name: 'foo' });

  // Nothing is assigned to the slot, should use slot content.
  await page.setContent(`
    <div></div>
    <script>
      (() => {
        const container = document.querySelector('div');
        const shadow = container.attachShadow({ mode: 'open' });
        const button = document.createElement('button');
        shadow.appendChild(button);
        const slot = document.createElement('slot');
        button.appendChild(slot);
        const span = document.createElement('span');
        span.textContent = 'pre';
        slot.appendChild(span);
      })();
    </script>
  `);
  expect.soft(await getNameAndRole(page, 'button')).toEqual({ role: 'button', name: 'pre' });
});

test('accessible name nested treeitem', async ({ page }) => {
  await page.setContent(`
    <div role=treeitem id=target>
      <span>Top-level</span>
      <div role=group>
        <div role=treeitem><span>Nested 1</span></div>
        <div role=treeitem><span>Nested 2</span></div>
      </div>
    </div>
  `);
  expect.soft(await getNameAndRole(page, '#target')).toEqual({ role: 'treeitem', name: 'Top-level' });
});

test('svg title', async ({ page }) => {
  await page.setContent(`
    <div>
      <svg width="162" height="30" viewBox="0 0 162 30" fill="none" xmlns="http://www.w3.org/2000/svg">
        <title>Submit</title>
        <g>
          <title>Hello</title>
        </g>
        <a href="example.com" xlink:title="a link"><circle cx="50" cy="40" r="35" /></a>
      </svg>
    </div>
  `);

  expect.soft(await getNameAndRole(page, 'svg')).toEqual({ role: 'img', name: 'Submit' });
  expect.soft(await getNameAndRole(page, 'g')).toEqual({ role: null, name: 'Hello' });
  expect.soft(await getNameAndRole(page, 'a')).toEqual({ role: 'link', name: 'a link' });
});

test('native controls', async ({ page }) => {
  await page.setContent(`
    <label for="text1">TEXT1</label><input id="text1" type=text>
    <input id="text2" type=text title="TEXT2">
    <input id="text3" type=text placeholder="TEXT3">

    <label for="image1">IMAGE1</label><input id="image1" type=image>
    <input id="image2" type=image alt="IMAGE2">
    <label for="image3">IMAGE3</label><input id="image3" type=image alt="MORE3">

    <label for="button1">BUTTON1</label><button id="button1" role="combobox">button</button>
    <button id="button2" role="combobox">BUTTON2</button>
    <button id="button3">BUTTON3</button>
    <button id="button4" title="BUTTON4"></button>
  `);

  expect.soft(await getNameAndRole(page, '#text1')).toEqual({ role: 'textbox', name: 'TEXT1' });
  expect.soft(await getNameAndRole(page, '#text2')).toEqual({ role: 'textbox', name: 'TEXT2' });
  expect.soft(await getNameAndRole(page, '#text3')).toEqual({ role: 'textbox', name: 'TEXT3' });
  expect.soft(await getNameAndRole(page, '#image1')).toEqual({ role: 'button', name: 'IMAGE1' });
  expect.soft(await getNameAndRole(page, '#image2')).toEqual({ role: 'button', name: 'IMAGE2' });
  expect.soft(await getNameAndRole(page, '#image3')).toEqual({ role: 'button', name: 'IMAGE3' });
  expect.soft(await getNameAndRole(page, '#button1')).toEqual({ role: 'combobox', name: 'BUTTON1' });
  expect.soft(await getNameAndRole(page, '#button2')).toEqual({ role: 'combobox', name: '' });
  expect.soft(await getNameAndRole(page, '#button3')).toEqual({ role: 'button', name: 'BUTTON3' });
  expect.soft(await getNameAndRole(page, '#button4')).toEqual({ role: 'button', name: 'BUTTON4' });
});

test('native controls labelled-by', async ({ page }) => {
  await page.setContent(`
    <label id="for-text1">TEXT1</label><input aria-labelledby="for-text1" id="text1" type=text>
    <label id="for-text2">TEXT2</label><input aria-labelledby="for-text2 text2" id="text2" type=text>
    <label id="for-text3" for="text3">TEXT3</label><input aria-labelledby="for-text3 text3" id="text3" type=text>

    <label id="for-submit1" for="submit1">SUBMIT1</label><input aria-labelledby="for-submit1 submit1" id="submit1" type=submit>
    <label id="for-image1" for="image1">IMAGE1</label><input aria-labelledby="for-image1 image1" id="image1" type=image alt="MORE1">
    <label id="for-image2" for="image2">IMAGE2</label><img aria-labelledby="for-image2 image2" id="image2" alt="MORE2" src="data:image/svg,<g></g>">

    <label id="for-button1">BUTTON1</label><button aria-labelledby="for-button1" id="button1">MORE1</button>
    <label id="for-button2">BUTTON2</label><button aria-labelledby="for-button2 button2" id="button2">MORE2</button>
    <label id="for-button3" for="button3">BUTTON3</label><button aria-labelledby="for-button3 button3" id="button3">MORE3</button>
    <label id="for-button4" for="button4">BUTTON4</label><button aria-labelledby="for-button4" id="button4">MORE4</button>

    <label id="for-textarea1" for="textarea1">TEXTAREA1</label><textarea aria-labelledby="for-textarea1 textarea1" id="textarea1" placeholder="MORE1">MORE2</textarea>
  `);

  expect.soft(await getNameAndRole(page, '#text1')).toEqual({ role: 'textbox', name: 'TEXT1' });
  expect.soft(await getNameAndRole(page, '#text2')).toEqual({ role: 'textbox', name: 'TEXT2' });
  expect.soft(await getNameAndRole(page, '#text3')).toEqual({ role: 'textbox', name: 'TEXT3' });
  expect.soft(await getNameAndRole(page, '#submit1')).toEqual({ role: 'button', name: 'SUBMIT1 Submit' });
  expect.soft(await getNameAndRole(page, '#image1')).toEqual({ role: 'button', name: 'IMAGE1 MORE1' });
  expect.soft(await getNameAndRole(page, '#image2')).toEqual({ role: 'img', name: 'IMAGE2 MORE2' });
  expect.soft(await getNameAndRole(page, '#button1')).toEqual({ role: 'button', name: 'BUTTON1' });
  expect.soft(await getNameAndRole(page, '#button2')).toEqual({ role: 'button', name: 'BUTTON2 MORE2' });
  expect.soft(await getNameAndRole(page, '#button3')).toEqual({ role: 'button', name: 'BUTTON3 MORE3' });
  expect.soft(await getNameAndRole(page, '#button4')).toEqual({ role: 'button', name: 'BUTTON4' });
  expect.soft(await getNameAndRole(page, '#textarea1')).toEqual({ role: 'textbox', name: 'TEXTAREA1 MORE2' });
});

function toArray(x: any): any[] {
  return Array.isArray(x) ? x : [x];
}
