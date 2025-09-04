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
import { generateLocator } from './utils';
import * as codegen from '../codegen';

const fillForm = defineTabTool({
  capability: 'core',

  schema: {
    name: 'browser_fill_form',
    title: 'Fill form',
    description: 'Fill multiple form fields',
    inputSchema: z.object({
      fields: z.array(z.object({
        name: z.string().describe('Human-readable field name'),
        type: z.enum(['textbox', 'checkbox', 'radio', 'combobox', 'slider']).describe('Type of the field'),
        ref: z.string().describe('Exact target field reference from the page snapshot'),
        value: z.string().describe('Value to fill in the field. If the field is a checkbox, the value should be `true` or `false`. If the field is a combobox, the value should be the text of the option.'),
      })).describe('Fields to fill in'),
    }),
    type: 'destructive',
  },

  handle: async (tab, params, response) => {
    for (const field of params.fields) {
      const locator = await tab.refLocator({ element: field.name, ref: field.ref });
      const locatorSource = `await page.${await generateLocator(locator)}`;
      if (field.type === 'textbox' || field.type === 'slider') {
        const secret = tab.context.lookupSecret(field.value);
        await locator.fill(secret.value);
        response.addCode(`${locatorSource}.fill(${secret.code});`);
      } else if (field.type === 'checkbox' || field.type === 'radio') {
        await locator.setChecked(field.value === 'true');
        response.addCode(`${locatorSource}.setChecked(${field.value});`);
      } else if (field.type === 'combobox') {
        await locator.selectOption({ label: field.value });
        response.addCode(`${locatorSource}.selectOption(${codegen.quote(field.value)});`);
      }
    }
  },
});

export default [
  fillForm,
];
