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
    const name = (window as any).__injectedScript.utils.getElementAccessibleName(e);
    const role = (window as any).__injectedScript.utils.getAriaRole(e);
    return { name, role };
  });
}

const ranges = [
  'name_1.0_combobox-focusable-alternative-manual.html',
  'name_test_case_539-manual.html',
  'name_test_case_721-manual.html',
];

for (let range = 0; range <= ranges.length; range++) {
  test('wpt accname #' + range, async ({ page, asset, server, browserName }) => {
    const skipped = [
      // This test expects ::before + title + ::after, which is neither 2F nor 2I.
      'name_test_case_659-manual.html',
      // This test expects ::before + title + ::after, which is neither 2F nor 2I.
      'name_test_case_660-manual.html',
      // These two tests expect <input type=file title=...> to respect the title, but browsers do not.
      'name_test_case_751-manual.html',
      'name_file-title-manual.html',
      // Spec says role=combobox should use selected options, not a title attribute.
      'description_1.0_combobox-focusable-manual.html',
    ];

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
              if (atk[0] !== 'property' || (atk[1] !== 'name' && atk[1] !== 'description') || atk[2] !== 'is' || typeof atk[3] !== 'string')
                continue;
              self.steps.push({ selector: '#' + step.element, property: atk[1], value: atk[3] });
            }
          }
        }
      };
    });

    const testDir = asset('wpt/accname/manual');
    const testFiles = fs.readdirSync(testDir, { withFileTypes: true }).filter(e => e.isFile() && e.name.endsWith('.html')).map(e => e.name);
    for (const testFile of testFiles) {
      if (skipped.includes(testFile))
        continue;
      const included = (range === 0 || testFile >= ranges[range - 1]) && (range === ranges.length || testFile < ranges[range]);
      if (!included)
        continue;
      await test.step(testFile, async () => {
        await page.goto(server.PREFIX + `/wpt/accname/manual/` + testFile);
        // Use $eval to force injected script.
        const result = await page.$eval('body', () => {
          const result = [];
          for (const step of (window as any).steps) {
            const element = document.querySelector(step.selector);
            if (!element)
              throw new Error(`Unable to resolve "${step.selector}"`);
            const injected = (window as any).__injectedScript;
            const received = step.property === 'name' ? injected.utils.getElementAccessibleName(element) : injected.utils.getElementAccessibleDescription(element);
            result.push({ selector: step.selector, expected: step.value, received });
          }
          return result;
        });
        for (const { selector, expected, received } of result)
          expect.soft(received, `checking "${selector}" in ${testFile}`).toBe(expected);
      });
    }
  });
}

test('wpt accname non-manual', async ({ page, asset, server, browserName }) => {
  await page.addInitScript(() => {
    const self = window as any;
    self.AriaUtils = {};
    self.AriaUtils.verifyLabelsBySelector = selector => self.__selector = selector;
  });

  const failing = [
    // Chromium thinks it should use "3" from the span, but Safari does not. Spec is unclear.
    'checkbox label with embedded combobox (span)',
    'checkbox label with embedded combobox (div)',

    // We do not allow nested visible elements inside parent invisible. Chromium does, but Safari does not. Spec is unclear.
    'heading with name from content, containing element that is visibility:hidden with nested content that is visibility:visible',

    // TODO: dd/dt elements have roles that prohibit naming. However, both Chromium and Safari still support naming.
    'label valid on dd element',
    'label valid on dt element',

    // TODO: recursive bugs
    'heading with link referencing image using aria-labelledby, that in turn references text element via aria-labelledby',
    'heading with link referencing image using aria-labelledby, that in turn references itself and another element via aria-labelledby',
    'button\'s hidden referenced name (visibility:hidden) with hidden aria-labelledby traversal falls back to aria-label',

    // TODO: preserve "tab" character and non-breaking-spaces from "aria-label" attribute
    'link with text node, with tab char',
    'nav with trailing nbsp char aria-label is valid (nbsp is preserved in name)',
    'button with leading nbsp char in aria-label is valid (and uses aria-label)',
  ];

  const testDir = asset('wpt/accname/name');
  const testFiles = fs.readdirSync(testDir, { withFileTypes: true }).filter(e => e.isFile() && e.name.endsWith('.html')).map(e => `/wpt/accname/name/` + e.name);
  testFiles.push(...fs.readdirSync(testDir + '/shadowdom', { withFileTypes: true }).filter(e => e.isFile() && e.name.endsWith('.html')).map(e => `/wpt/accname/name/shadowdom` + e.name));
  for (const testFile of testFiles) {
    await test.step(testFile, async () => {
      await page.goto(server.PREFIX + testFile);
      // Use $eval to force injected script.
      const result = await page.$eval('body', () => {
        const result = [];
        for (const element of document.querySelectorAll((window as any).__selector)) {
          const injected = (window as any).__injectedScript;
          const title = element.getAttribute('data-testname');
          const expected = element.getAttribute('data-expectedlabel');
          const received = injected.utils.getElementAccessibleName(element);
          result.push({ title, expected, received });
        }
        return result;
      });
      for (const { title, expected, received } of result) {
        if (!failing.includes(title))
          expect.soft(received, `${testFile}: ${title}`).toBe(expected);
      }
    });
  }
});

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
        return (window as any).__injectedScript.utils.getAriaRole(element);
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
          return injected.utils.getElementAccessibleName(element);
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

    <input id="file1" type=file>
    <label for="file2">FILE2</label><input id="file2" type=file>
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
  expect.soft(await getNameAndRole(page, '#file1')).toEqual({ role: 'button', name: 'Choose File' });
  expect.soft(await getNameAndRole(page, '#file2')).toEqual({ role: 'button', name: 'FILE2' });
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

test('display:contents should be visible when contents are visible', async ({ page }) => {
  await page.setContent(`
    <button style='display: contents;'>yo</button>
  `);
  await expect(page.getByRole('button')).toHaveCount(1);
});

test('should remove soft hyphens and zero-width spaces', async ({ page }) => {
  await page.setContent(`
    <button>1\u00ad2\u200b3</button>
  `);
  expect.soft(await getNameAndRole(page, 'button')).toEqual({ role: 'button', name: '123' });
});

test('label/labelled-by aria-hidden with descendants', async ({ page }) => {
  test.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/29796' });

  await page.setContent(`
    <body>
      <div id="case1">
        <button aria-labelledby="label1" type="button"></button>
        <tool-tip id="label1" for="button-preview" popover="manual" aria-hidden="true" role="tooltip">Label1</tool-tip>
      </div>
      <div id="case2">
        <label for="button2" aria-hidden="true"><div id="label2">Label2</div></label>
        <button id="button2" type="button"></button>
      </div>
    </body>
  `);
  await page.$$eval('#label1, #label2', els => {
    els.forEach(el => el.attachShadow({ mode: 'open' }).appendChild(document.createElement('slot')));
  });
  expect.soft(await getNameAndRole(page, '#case1 button')).toEqual({ role: 'button', name: 'Label1' });
  expect.soft(await getNameAndRole(page, '#case2 button')).toEqual({ role: 'button', name: 'Label2' });
});

test('own aria-label concatenated with aria-labelledby', async ({ page }) => {
  // This is taken from https://w3c.github.io/accname/#example-5-0

  await page.setContent(`
    <h1>Files</h1>
    <ul>
      <li>
        <a id="file_row1" href="./files/Documentation.pdf">Documentation.pdf</a>
        <span role="button" tabindex="0" id="del_row1" aria-label="Delete" aria-labelledby="del_row1 file_row1"></span>
      </li>
      <li>
        <a id="file_row2" href="./files/HolidayLetter.pdf">HolidayLetter.pdf</a>
        <span role="button" tabindex="0" id="del_row2" aria-label="Delete" aria-labelledby="del_row2 file_row2"></span>
      </li>
    </ul>
  `);
  expect.soft(await getNameAndRole(page, '#del_row1')).toEqual({ role: 'button', name: 'Delete Documentation.pdf' });
  expect.soft(await getNameAndRole(page, '#del_row2')).toEqual({ role: 'button', name: 'Delete HolidayLetter.pdf' });
});

test('control embedded in a label', async ({ page }) => {
  test.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/28848' });

  await page.setContent(`
    <label for="flash">
      <input type="checkbox" id="flash">
      Flash the screen <span tabindex="0" role="textbox" aria-label="number of times" contenteditable>5</span> times.
    </label>
  `);
  expect.soft(await getNameAndRole(page, 'input')).toEqual({ role: 'checkbox', name: 'Flash the screen 5 times.' });
  expect.soft(await getNameAndRole(page, 'span')).toEqual({ role: 'textbox', name: 'number of times' });
  expect.soft(await getNameAndRole(page, 'label')).toEqual({ role: null, name: '' });
});

test('control embedded in a target element', async ({ page }) => {
  test.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/28848' });

  await page.setContent(`
    <h1>
      <input type="text" value="Foo bar">
    </h1>
  `);
  expect.soft(await getNameAndRole(page, 'h1')).toEqual({ role: 'heading', name: 'Foo bar' });
});

test('svg role=presentation', async ({ page, server }) => {
  test.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/26809' });

  await page.goto(server.EMPTY_PAGE);
  await page.setContent(`
		<img src="pptr.png" alt="Code is Poetry." />
		<svg viewBox="0 0 100 100" width="16" height="16" xmlns="http://www.w3.org/2000/svg" role="presentation" focusable="false"><circle cx="50" cy="50" r="50"></circle></svg>
  `);
  expect.soft(await getNameAndRole(page, 'img')).toEqual({ role: 'img', name: 'Code is Poetry.' });
  expect.soft(await getNameAndRole(page, 'svg')).toEqual({ role: 'presentation', name: '' });
});

test('should work with form and tricky input names', async ({ page }) => {
  test.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/30616' });

  await page.setContent(`
		<form aria-label="my form">
      <input name="tagName" value="hello" title="tagName input">
      <input name="localName" value="hello" title="localName input">
    </form>
  `);
  expect.soft(await getNameAndRole(page, 'form')).toEqual({ role: 'form', name: 'my form' });
});

test('should ignore stylesheet from hidden aria-labelledby subtree', async ({ page }) => {
  await page.setContent(`
    <div id=mylabel style="display:none">
      <template shadowrootmode=open>
        <style>span { color: red; }</style>
        <span>hello</span>
      </template>
    </div>
    <input aria-labelledby=mylabel type=text>
  `);
  expect.soft(await getNameAndRole(page, 'input')).toEqual({ role: 'textbox', name: 'hello' });
});

test('should not include hidden pseudo into accessible name', async ({ page }) => {
  await page.setContent(`
    <style>
      span:before {
        content: 'world';
        display: none;
      }
      div:after {
        content: 'bye';
        visibility: hidden;
      }
    </style>
    <a href="http://example.com">
      <span>hello</span>
      <div>hello</div>
    </a>
  `);
  expect.soft(await getNameAndRole(page, 'a')).toEqual({ role: 'link', name: 'hello hello' });
});

test('should resolve pseudo content from attr', async ({ page }) => {
  await page.setContent(`
    <style>
    .stars:before {
      display: block;
      content: attr(data-hello);
    }
    </style>
    <a href="http://example.com">
      <div class="stars" data-hello="hello">world</div>
    </a>
  `);
  expect(await getNameAndRole(page, 'a')).toEqual({ role: 'link', name: 'hello world' });
});

test('should resolve pseudo content alternative text', async ({ page }) => {
  await page.setContent(`
    <style>
      .with-content:before {
        content: url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg'></svg>") / "alternative text";
      }
    </style>
    <div role="button" class="with-content"> inner text</div>
  `);
  expect(await getNameAndRole(page, 'div')).toEqual({ role: 'button', name: 'alternative text inner text' });
});

test('should resolve css content property for an element', async ({ page }) => {
  await page.setContent(`
    <style>
      .with-content-1 {
        content: url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg'></svg>") / "alternative text";
      }
      .with-content-2 {
        content: url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg'></svg>");
      }
    </style>
    <div id="button1" role="button" class="with-content-1">inner text</div>
    <div id="button2" role="button" class="with-content-2">inner text</div>
  `);
  expect(await getNameAndRole(page, '#button1')).toEqual({ role: 'button', name: 'alternative text' });
  expect(await getNameAndRole(page, '#button2')).toEqual({ role: 'button', name: 'inner text' });
});

test('should ignore invalid aria-labelledby', async ({ page }) => {
  await page.setContent(`
    <label>
      <span>Text here</span>
      <input type=text aria-labelledby="does-not-exist">
    </label>
  `);
  expect.soft(await getNameAndRole(page, 'input')).toEqual({ role: 'textbox', name: 'Text here' });
});

test('should support search element', async ({ page }) => {
  await page.setContent(`
    <search id=search1 aria-label="example">
      Hello
    </search>
    <search id=search2>
      World
    </search>
  `);
  expect.soft(await getNameAndRole(page, '#search1')).toEqual({ role: 'search', name: 'example' });
  expect.soft(await getNameAndRole(page, '#search2')).toEqual({ role: 'search', name: '' });
  await expect.soft(page.getByRole('search', { name: 'example' })).toBeVisible();
});

function toArray(x: any): any[] {
  return Array.isArray(x) ? x : [x];
}
