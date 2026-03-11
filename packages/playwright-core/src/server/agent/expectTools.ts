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
      isNot: z.boolean().optional().describe('Expect the opposite'),
    }),
  },

  handle: async (progress, context, params) => {
    return await context.runActionAndWait(progress, {
      method: 'expectVisible',
      selector: getByRoleSelector(params.role, { name: params.accessibleName }),
      isNot: params.isNot,
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
      isNot: z.boolean().optional().describe('Expect the opposite'),
    }),
  },

  handle: async (progress, context, params) => {
    return await context.runActionAndWait(progress, {
      method: 'expectVisible',
      selector: getByTextSelector(params.text),
      isNot: params.isNot,
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
      isNot: z.boolean().optional().describe('Expect the opposite'),
    }),
  },

  handle: async (progress, context, params) => {
    const [selector] = await context.refSelectors(progress, [{ ref: params.ref, element: params.element }]);
    return await context.runActionAndWait(progress, {
      method: 'expectValue',
      selector,
      type: params.type,
      value: params.value,
      isNot: params.isNot,
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
      isNot: z.boolean().optional().describe('Expect the opposite'),
    }),
  },

  handle: async (progress, context, params) => {
    const template = `- ${params.listRole}:
${params.items.map(item => `  - ${params.itemRole}: ${yamlEscapeValueIfNeeded(item)}`).join('\n')}`;
    return await context.runActionAndWait(progress, {
      method: 'expectAria',
      template,
    });
  },
});

const expectURL = defineTool({
  schema: {
    name: 'browser_expect_url',
    title: 'Expect URL',
    description: 'Expect the page URL to match the expected value. Either provide a url string or a regex pattern.',
    inputSchema: z.object({
      url: z.string().optional().describe('Expected URL string. Relative URLs are resolved against the baseURL.'),
      regex: z.string().optional().describe('Regular expression pattern to match the URL against, e.g. /foo.*/i.'),
      isNot: z.boolean().optional().describe('Expect the opposite'),
    }),
  },

  handle: async (progress, context, params) => {
    return await context.runActionAndWait(progress, {
      method: 'expectURL',
      value: params.url,
      regex: params.regex,
      isNot: params.isNot,
    });
  },
});

const expectTitle = defineTool({
  schema: {
    name: 'browser_expect_title',
    title: 'Expect title',
    description: 'Expect the page title to match the expected value.',
    inputSchema: z.object({
      title: z.string().describe('Expected page title.'),
      isNot: z.boolean().optional().describe('Expect the opposite'),
    }),
  },

  handle: async (progress, context, params) => {
    return await context.runActionAndWait(progress, {
      method: 'expectTitle',
      value: params.title,
      isNot: params.isNot,
    });
  },
});

export default [
  expectVisible,
  expectVisibleText,
  expectValue,
  expectList,
  expectURL,
  expectTitle,
] as ToolDefinition<any>[];
