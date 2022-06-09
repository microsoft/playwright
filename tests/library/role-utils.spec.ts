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
import fs from 'fs';

test.skip(({ mode }) => mode !== 'default');

test('wpt accname', async ({ page, asset, server, browserName }) => {
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
        expect(received, `checking "${selector}"`).toBe(expected);
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
        return (window as any).__injectedScript.getAriaRole(element);
      }, testCase.target);
      expect(received, `checking ${JSON.stringify(testCase)}`).toBe(testCase.role);
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
      expect(received, `checking ${JSON.stringify(testCase)}`).toEqual(expected);
    });
  }
});

function toArray(x: any): any[] {
  return Array.isArray(x) ? x : [x];
}
