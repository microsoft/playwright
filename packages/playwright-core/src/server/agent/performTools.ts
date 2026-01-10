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
import { defineTool } from './tool';

import type * as actions from './actions';
import type { ToolDefinition } from './tool';

const snapshot = defineTool({
  schema: {
    name: 'browser_snapshot',
    title: 'Page snapshot',
    description: 'Capture accessibility snapshot of the current page, this is better than screenshot',
    inputSchema: z.object({}),
  },

  handle: async (progress, context, params) => {
    return await context.snapshotResult(progress);
  },
});

const elementSchema = z.object({
  element: z.string().describe('Human-readable element description used to obtain permission to interact with the element'),
  ref: z.string().describe('Exact target element reference from the page snapshot'),
});

const clickSchema = elementSchema.extend({
  doubleClick: z.boolean().optional().describe('Whether to perform a double click instead of a single click'),
  button: z.enum(['left', 'right', 'middle']).optional().describe('Button to click, defaults to left'),
  modifiers: z.array(z.enum(['Alt', 'Control', 'ControlOrMeta', 'Meta', 'Shift'])).optional().describe('Modifier keys to press'),
});

const click = defineTool({
  schema: {
    name: 'browser_click',
    title: 'Click',
    description: 'Perform click on a web page',
    inputSchema: clickSchema,
  },

  handle: async (progress, context, params) => {
    const [selector] = await context.refSelectors(progress, [params]);
    return await context.runActionAndWait(progress, {
      method: 'click',
      selector,
      options: {
        button: params.button,
        modifiers: params.modifiers,
        clickCount: params.doubleClick ? 2 : undefined,
      }
    });
  },
});

const drag = defineTool({
  schema: {
    name: 'browser_drag',
    title: 'Drag mouse',
    description: 'Perform drag and drop between two elements',
    inputSchema: z.object({
      startElement: z.string().describe('Human-readable source element description used to obtain the permission to interact with the element'),
      startRef: z.string().describe('Exact source element reference from the page snapshot'),
      endElement: z.string().describe('Human-readable target element description used to obtain the permission to interact with the element'),
      endRef: z.string().describe('Exact target element reference from the page snapshot'),
    }),
  },

  handle: async (progress, context, params) => {
    const [sourceSelector, targetSelector] = await context.refSelectors(progress, [
      { ref: params.startRef, element: params.startElement },
      { ref: params.endRef, element: params.endElement },
    ]);

    return await context.runActionAndWait(progress, {
      method: 'drag',
      sourceSelector,
      targetSelector
    });
  },
});

const hoverSchema = elementSchema.extend({
  modifiers: z.array(z.enum(['Alt', 'Control', 'ControlOrMeta', 'Meta', 'Shift'])).optional().describe('Modifier keys to press'),
});

const hover = defineTool({
  schema: {
    name: 'browser_hover',
    title: 'Hover mouse',
    description: 'Hover over element on page',
    inputSchema: hoverSchema,
  },

  handle: async (progress, context, params) => {
    const [selector] = await context.refSelectors(progress, [params]);
    return await context.runActionAndWait(progress, {
      method: 'hover',
      selector,
      options: {
        modifiers: params.modifiers,
      }
    });
  },
});

const selectOptionSchema = elementSchema.extend({
  values: z.array(z.string()).describe('Array of values to select in the dropdown. This can be a single value or multiple values.'),
});

const selectOption = defineTool({
  schema: {
    name: 'browser_select_option',
    title: 'Select option',
    description: 'Select an option in a dropdown',
    inputSchema: selectOptionSchema,
  },

  handle: async (progress, context, params) => {
    const [selector] = await context.refSelectors(progress, [params]);
    return await context.runActionAndWait(progress, {
      method: 'selectOption',
      selector,
      labels: params.values
    });
  },
});

const pressKey = defineTool({
  schema: {
    name: 'browser_press_key',
    title: 'Press a key',
    description: 'Press a key on the keyboard',
    inputSchema: z.object({
      key: z.string().describe('Name of the key to press or a character to generate, such as `ArrowLeft` or `a`'),
    }),
  },

  handle: async (progress, context, params) => {
    return await context.runActionAndWait(progress, {
      method: 'pressKey',
      key: params.key
    });
  },
});

const typeSchema = elementSchema.extend({
  text: z.string().describe('Text to type into the element'),
  submit: z.boolean().optional().describe('Whether to submit entered text (press Enter after)'),
  slowly: z.boolean().optional().describe('Whether to type one character at a time. Useful for triggering key handlers in the page. By default entire text is filled in at once.'),
});

const type = defineTool({
  schema: {
    name: 'browser_type',
    title: 'Type text',
    description: 'Type text into editable element',
    inputSchema: typeSchema,
  },

  handle: async (progress, context, params) => {
    const [selector] = await context.refSelectors(progress, [params]);
    if (params.slowly) {
      return await context.runActionAndWait(progress, {
        method: 'pressSequentially',
        selector,
        text: params.text,
        submit: params.submit,
      });
    } else {
      return await context.runActionAndWait(progress, {
        method: 'fill',
        selector,
        text: params.text,
        submit: params.submit,
      });
    }
  },
});

const fillForm = defineTool({
  schema: {
    name: 'browser_fill_form',
    title: 'Fill form',
    description: 'Fill multiple form fields. Always use this tool when you can fill more than one field at a time.',
    inputSchema: z.object({
      fields: z.array(z.object({
        name: z.string().describe('Human-readable field name'),
        type: z.enum(['textbox', 'checkbox', 'radio', 'combobox', 'slider']).describe('Type of the field'),
        ref: z.string().describe('Exact target field reference from the page snapshot'),
        value: z.string().describe('Value to fill in the field. If the field is a checkbox, the value should be `true` or `false`. If the field is a combobox, the value should be the text of the option.'),
      })).describe('Fields to fill in'),
    }),
  },

  handle: async (progress, context, params) => {
    const actions: actions.Action[] = [];
    for (const field of params.fields) {
      const [selector] = await context.refSelectors(progress, [{ ref: field.ref, element: field.name }]);
      if (field.type === 'textbox' || field.type === 'slider') {
        actions.push({
          method: 'fill',
          selector,
          text: field.value,
        });
      } else if (field.type === 'checkbox' || field.type === 'radio') {
        actions.push({
          method: 'setChecked',
          selector,
          checked: field.value === 'true',
        });
      } else if (field.type === 'combobox') {
        actions.push({
          method: 'selectOption',
          selector,
          labels: [field.value],
        });
      }
    }
    return await context.runActionsAndWait(progress, actions);
  },
});

export default [
  snapshot,
  click,
  drag,
  hover,
  selectOption,
  pressKey,
  type,
  fillForm,
] as ToolDefinition<any>[];
