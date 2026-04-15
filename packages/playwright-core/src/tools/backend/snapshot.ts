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

import * as z from 'zod';
import { formatObject, formatObjectOrVoid } from '@isomorphic/stringUtils';
import { defineTabTool } from './tool';

import type * as playwright from '../../..';

const elementTargetDescription = 'Exact target element reference from the page snapshot, or a unique element selector';

export const optionalElementSchema = z.object({
  element: z.string().optional().describe('Human-readable element description used to obtain permission to interact with the element'),
  target: z.string().optional().describe(elementTargetDescription),
});

export const elementSchema = z.object({
  element: z.string().optional().describe('Human-readable element description used to obtain permission to interact with the element'),
  target: z.string().describe(elementTargetDescription),
});

const snapshot = defineTabTool({
  capability: 'core',
  schema: {
    name: 'browser_snapshot',
    title: 'Page snapshot',
    description: 'Capture accessibility snapshot of the current page, this is better than screenshot',
    inputSchema: z.object({
      target: z.string().optional().describe(elementTargetDescription),
      filename: z.string().optional().describe('Save snapshot to markdown file instead of returning it in the response.'),
      depth: z.number().optional().describe('Limit the depth of the snapshot tree'),
    }),
    type: 'readOnly',
  },

  handle: async (tab, params, response) => {
    let resolved: { locator: playwright.Locator | undefined, resolved: string } = { locator: undefined, resolved: '' };
    if (params.target)
      resolved = await tab.targetLocator({ target: params.target });
    response.setIncludeFullSnapshot(params.filename, resolved.locator, params.depth);
  },
});

const clickSchema = elementSchema.extend({
  doubleClick: z.boolean().optional().describe('Whether to perform a double click instead of a single click'),
  button: z.enum(['left', 'right', 'middle']).optional().describe('Button to click, defaults to left'),
  modifiers: z.array(z.enum(['Alt', 'Control', 'ControlOrMeta', 'Meta', 'Shift'])).optional().describe('Modifier keys to press'),
});

const click = defineTabTool({
  capability: 'core',
  schema: {
    name: 'browser_click',
    title: 'Click',
    description: 'Perform click on a web page',
    inputSchema: clickSchema,
    type: 'input',
  },

  handle: async (tab, params, response) => {
    response.setIncludeSnapshot();

    const { locator, resolved } = await tab.targetLocator(params);
    const options = {
      button: params.button,
      modifiers: params.modifiers,
      ...tab.actionTimeoutOptions,
    };
    const optionsArg = formatObjectOrVoid(options);

    if (params.doubleClick)
      response.addCode(`await page.${resolved}.dblclick(${optionsArg});`);
    else
      response.addCode(`await page.${resolved}.click(${optionsArg});`);

    await tab.waitForCompletion(async () => {
      if (params.doubleClick)
        await locator.dblclick(options);
      else
        await locator.click(options);
    });
  },
});

const drag = defineTabTool({
  capability: 'core',
  schema: {
    name: 'browser_drag',
    title: 'Drag mouse',
    description: 'Perform drag and drop between two elements',
    inputSchema: z.object({
      startElement: z.string().optional().describe('Human-readable source element description used to obtain the permission to interact with the element'),
      startTarget: z.string().describe(elementTargetDescription),
      endElement: z.string().optional().describe('Human-readable target element description used to obtain the permission to interact with the element'),
      endTarget: z.string().describe(elementTargetDescription),
    }),
    type: 'input',
  },

  handle: async (tab, params, response) => {
    response.setIncludeSnapshot();

    const [start, end] = await tab.targetLocators([
      { target: params.startTarget, element: params.startElement },
      { target: params.endTarget, element: params.endElement },
    ]);

    await tab.waitForCompletion(async () => {
      await start.locator.dragTo(end.locator, tab.actionTimeoutOptions);
    });

    response.addCode(`await page.${start.resolved}.dragTo(page.${end.resolved});`);
  },
});

const hover = defineTabTool({
  capability: 'core',
  schema: {
    name: 'browser_hover',
    title: 'Hover mouse',
    description: 'Hover over element on page',
    inputSchema: elementSchema,
    type: 'input',
  },

  handle: async (tab, params, response) => {
    response.setIncludeSnapshot();

    const { locator, resolved } = await tab.targetLocator(params);
    response.addCode(`await page.${resolved}.hover();`);

    await locator.hover(tab.actionTimeoutOptions);
  },
});

const selectOptionSchema = elementSchema.extend({
  values: z.array(z.string()).describe('Array of values to select in the dropdown. This can be a single value or multiple values.'),
});

const selectOption = defineTabTool({
  capability: 'core',
  schema: {
    name: 'browser_select_option',
    title: 'Select option',
    description: 'Select an option in a dropdown',
    inputSchema: selectOptionSchema,
    type: 'input',
  },

  handle: async (tab, params, response) => {
    response.setIncludeSnapshot();

    const { locator, resolved } = await tab.targetLocator(params);
    response.addCode(`await page.${resolved}.selectOption(${formatObject(params.values)});`);

    await locator.selectOption(params.values, tab.actionTimeoutOptions);
  },
});

const generateLocator = defineTabTool({
  capability: 'testing',
  schema: {
    name: 'browser_generate_locator',
    title: 'Create locator for element',
    description: 'Generate locator for the given element to use in tests',
    inputSchema: elementSchema,
    type: 'readOnly',
  },

  handle: async (tab, params, response) => {
    const { resolved } = await tab.targetLocator(params);
    response.addTextResult(resolved);
  },
});

const check = defineTabTool({
  capability: 'core-input',
  skillOnly: true,

  schema: {
    name: 'browser_check',
    title: 'Check',
    description: 'Check a checkbox or radio button',
    inputSchema: elementSchema,
    type: 'input',
  },

  handle: async (tab, params, response) => {
    const { locator, resolved } = await tab.targetLocator(params);
    response.addCode(`await page.${resolved}.check();`);
    await locator.check(tab.actionTimeoutOptions);
  },
});

const uncheck = defineTabTool({
  capability: 'core-input',
  skillOnly: true,
  schema: {
    name: 'browser_uncheck',
    title: 'Uncheck',
    description: 'Uncheck a checkbox or radio button',
    inputSchema: elementSchema,
    type: 'input',
  },

  handle: async (tab, params, response) => {
    const { locator, resolved } = await tab.targetLocator(params);
    response.addCode(`await page.${resolved}.uncheck();`);
    await locator.uncheck(tab.actionTimeoutOptions);
  },
});

export default [
  snapshot,
  click,
  drag,
  hover,
  selectOption,
  generateLocator,
  check,
  uncheck,
];
