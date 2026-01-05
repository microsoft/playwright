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

import { z } from '../../mcpBundle';
import { getByRoleSelector, getByTextSelector } from '../../utils/isomorphic/locatorUtils';
import { yamlEscapeValueIfNeeded } from '../../utils/isomorphic/yaml';
import { defineTool } from './tool';

import type { ToolDefinition } from './tool';

const expectVisible = defineTool({
  schema: {
    name: 'browser_expect_visible',
    title: 'Expect element visible',
    description: 'Expect element is visible on the page',
    inputSchema: z.object({
      role: z.string().describe('ROLE of the element. Can be found in the snapshot like this: \`- {ROLE} "Accessible Name":\`'),
      accessibleName: z.string().describe('ACCESSIBLE_NAME of the element. Can be found in the snapshot like this: \`- role "{ACCESSIBLE_NAME}"\`'),
    }),
  },

  handle: async (context, params) => {
    return await context.runActionAndWait({
      method: 'expectVisible',
      selector: getByRoleSelector(params.role, { name: params.accessibleName }),
    });
  },
});

const expectVisibleText = defineTool({
  schema: {
    name: 'browser_expect_visible_text',
    title: 'Expect text visible',
    description: `Expect text is visible on the page. Prefer ${expectVisible.schema.name} if possible.`,
    inputSchema: z.object({
      text: z.string().describe('TEXT to expect. Can be found in the snapshot like this: \`- role "Accessible Name": {TEXT}\` or like this: \`- text: {TEXT}\`'),
    }),
  },

  handle: async (context, params) => {
    return await context.runActionAndWait({
      method: 'expectVisible',
      selector: getByTextSelector(params.text),
    });
  },
});

const expectValue = defineTool({
  schema: {
    name: 'browser_expect_value',
    title: 'Expect value',
    description: 'Expect element value',
    inputSchema: z.object({
      type: z.enum(['textbox', 'checkbox', 'radio', 'combobox', 'slider']).describe('Type of the element'),
      element: z.string().describe('Human-readable element description'),
      ref: z.string().describe('Exact target element reference from the page snapshot'),
      value: z.string().describe('Value to expect. For checkbox, use "true" or "false".'),
    }),
  },

  handle: async (context, params) => {
    const [selector] = await context.refSelectors([{ ref: params.ref, element: params.element }]);
    return await context.runActionAndWait({
      method: 'expectValue',
      selector,
      type: params.type,
      value: params.value,
    });
  },
});

const expectList = defineTool({
  schema: {
    name: 'browser_expect_list_visible',
    title: 'Expect list visible',
    description: 'Expect list is visible on the page, ensures items are present in the element in the exact order',
    inputSchema: z.object({
      listRole: z.string().describe('Aria role of the list element as in the snapshot'),
      listAccessibleName: z.string().optional().describe('Accessible name of the list element as in the snapshot'),
      itemRole: z.string().describe('Aria role of the list items as in the snapshot, should all be the same'),
      items: z.array(z.string().describe('Text to look for in the list item, can be either from accessible name of self / nested text content')),
    }),
  },

  handle: async (context, params) => {
    const template = `- ${params.listRole}:
${params.items.map(item => `  - ${params.itemRole}: ${yamlEscapeValueIfNeeded(item)}`).join('\n')}`;
    return await context.runActionAndWait({
      method: 'expectAria',
      template,
    });
  },
});

export default [
  expectVisible,
  expectVisibleText,
  expectValue,
  expectList,
] as ToolDefinition<any>[];
