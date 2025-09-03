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

import { z } from '../../sdk/bundle';
import { defineTabTool } from './tool';
import * as javascript from '../codegen';
import { generateLocator } from './utils';

const verifyElement = defineTabTool({
  capability: 'verify',
  schema: {
    name: 'browser_verify_element_visible',
    title: 'Verify element visible',
    description: 'Verify element is visible on the page',
    inputSchema: z.object({
      role: z.string().describe('ROLE of the element. Can be found in the snapshot like this: \`- {ROLE} "Accessible Name":\`'),
      accessibleName: z.string().describe('ACCESSIBLE_NAME of the element. Can be found in the snapshot like this: \`- role "{ACCESSIBLE_NAME}"\`'),
    }),
    type: 'readOnly',
  },

  handle: async (tab, params, response) => {
    const locator = tab.page.getByRole(params.role as any, { name: params.accessibleName });
    if (await locator.count() === 0) {
      response.addError(`Element with role "${params.role}" and accessible name "${params.accessibleName}" not found`);
      return;
    }

    response.addCode(`await expect(page.getByRole(${javascript.escapeWithQuotes(params.role)}, { name: ${javascript.escapeWithQuotes(params.accessibleName)} })).toBeVisible();`);
    response.addResult('Done');
  },
});

const verifyText = defineTabTool({
  capability: 'verify',
  schema: {
    name: 'browser_verify_text_visible',
    title: 'Verify text visible',
    description: `Verify text is visible on the page. Prefer ${verifyElement.schema.name} if possible.`,
    inputSchema: z.object({
      text: z.string().describe('TEXT to verify. Can be found in the snapshot like this: \`- role "Accessible Name": {TEXT}\` or like this: \`- text: {TEXT}\`'),
    }),
    type: 'readOnly',
  },

  handle: async (tab, params, response) => {
    const locator = tab.page.getByText(params.text).filter({ visible: true });
    if (await locator.count() === 0) {
      response.addError('Text not found');
      return;
    }

    response.addCode(`await expect(page.getByText(${javascript.escapeWithQuotes(params.text)})).toBeVisible();`);
    response.addResult('Done');
  },
});

const verifyList = defineTabTool({
  capability: 'verify',
  schema: {
    name: 'browser_verify_list_visible',
    title: 'Verify list visible',
    description: 'Verify list is visible on the page',
    inputSchema: z.object({
      element: z.string().describe('Human-readable list description'),
      ref: z.string().describe('Exact target element reference that points to the list'),
      items: z.array(z.string()).describe('Items to verify'),
    }),
    type: 'readOnly',
  },

  handle: async (tab, params, response) => {
    const locator = await tab.refLocator({ ref: params.ref, element: params.element });
    const itemTexts: string[] = [];
    for (const item of params.items) {
      const itemLocator = locator.getByText(item);
      if (await itemLocator.count() === 0) {
        response.addError(`Item "${item}" not found`);
        return;
      }
      itemTexts.push((await itemLocator.textContent())!);
    }
    const ariaSnapshot = `\`
- list:
${itemTexts.map(t => `  - listitem: ${javascript.escapeWithQuotes(t, '"')}`).join('\n')}
\``;
    response.addCode(`await expect(page.locator('body')).toMatchAriaSnapshot(${ariaSnapshot});`);
    response.addResult('Done');
  },
});

const verifyValue = defineTabTool({
  capability: 'verify',
  schema: {
    name: 'browser_verify_value',
    title: 'Verify value',
    description: 'Verify element value',
    inputSchema: z.object({
      type: z.enum(['textbox', 'checkbox', 'radio', 'combobox', 'slider']).describe('Type of the element'),
      element: z.string().describe('Human-readable element description'),
      ref: z.string().describe('Exact target element reference that points to the element'),
      value: z.string().describe('Value to verify. For checkbox, use "true" or "false".'),
    }),
    type: 'readOnly',
  },

  handle: async (tab, params, response) => {
    const locator = await tab.refLocator({ ref: params.ref, element: params.element });
    const locatorSource = `page.${await generateLocator(locator)}`;
    if (params.type === 'textbox' || params.type === 'slider' || params.type === 'combobox') {
      const value = await locator.inputValue();
      if (value !== params.value) {
        response.addError(`Expected value "${params.value}", but got "${value}"`);
        return;
      }
      response.addCode(`await expect(${locatorSource}).toHaveValue(${javascript.quote(params.value)});`);
    } else if (params.type === 'checkbox' || params.type === 'radio') {
      const value = await locator.isChecked();
      if (value !== (params.value === 'true')) {
        response.addError(`Expected value "${params.value}", but got "${value}"`);
        return;
      }
      const matcher = value ? 'toBeChecked' : 'not.toBeChecked';
      response.addCode(`await expect(${locatorSource}).${matcher}();`);
    }
    response.addResult('Done');
  },
});

export default [
  verifyElement,
  verifyText,
  verifyList,
  verifyValue,
];
