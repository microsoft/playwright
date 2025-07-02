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

import { z } from 'zod';

import { defineTool } from './tool';
import * as format from './format';
import { generateLocator } from './utils';

const snapshot = defineTool({
  schema: {
    name: 'browser_snapshot',
    description: 'Capture accessibility snapshot of the current page, this is better than screenshot',
    inputSchema: z.object({}),
  },

  handle: async () => {
    return {
      code: [],
      captureSnapshot: true,
      waitForNetwork: false,
    };
  },
});

export const elementSchema = z.object({
  element: z.string().describe('Human-readable element description used to obtain permission to interact with the element'),
  ref: z.string().describe('Exact target element reference from the page snapshot'),
});

const click = defineTool({
  schema: {
    name: 'browser_click',
    description: 'Perform click on a web page',
    inputSchema: elementSchema,
  },

  handle: async (context, params) => {
    const locator = context.refLocator(params);

    const code = [
      `await page.${await generateLocator(locator)}.click();`
    ];

    return {
      code,
      action: () => locator.click(),
      captureSnapshot: true,
      waitForNetwork: true,
    };
  },
});

const drag = defineTool({
  schema: {
    name: 'browser_drag',
    description: 'Perform drag and drop between two elements',
    inputSchema: z.object({
      startElement: z.string().describe('Human-readable source element description used to obtain the permission to interact with the element'),
      startRef: z.string().describe('Exact source element reference from the page snapshot'),
      endElement: z.string().describe('Human-readable target element description used to obtain the permission to interact with the element'),
      endRef: z.string().describe('Exact target element reference from the page snapshot'),
    }),
  },

  handle: async (context, params) => {
    const startLocator = context.refLocator({ ref: params.startRef, element: params.startElement });
    const endLocator = context.refLocator({ ref: params.endRef, element: params.endElement });

    const code = [
      `await page.${await generateLocator(startLocator)}.dragTo(page.${await generateLocator(endLocator)});`
    ];

    return {
      code,
      action: () => startLocator.dragTo(endLocator),
      captureSnapshot: true,
      waitForNetwork: true,
    };
  },
});

const hover = defineTool({
  schema: {
    name: 'browser_hover',
    description: 'Hover over element on page',
    inputSchema: elementSchema,
  },

  handle: async (context, params) => {
    const locator = context.refLocator(params);

    const code = [
      `await page.${await generateLocator(locator)}.hover();`
    ];

    return {
      code,
      action: () => locator.hover(),
      captureSnapshot: true,
      waitForNetwork: true,
    };
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
    description: 'Type text into editable element',
    inputSchema: typeSchema,
  },

  handle: async (context, params) => {
    const locator = context.refLocator(params);

    const code: string[] = [];
    const steps: (() => Promise<void>)[] = [];

    if (params.slowly) {
      code.push(`await page.${await generateLocator(locator)}.pressSequentially(${format.quote(params.text)});`);
      steps.push(() => locator.pressSequentially(params.text));
    } else {
      code.push(`await page.${await generateLocator(locator)}.fill(${format.quote(params.text)});`);
      steps.push(() => locator.fill(params.text));
    }

    if (params.submit) {
      code.push(`await page.${await generateLocator(locator)}.press('Enter');`);
      steps.push(() => locator.press('Enter'));
    }

    return {
      code,
      action: () => steps.reduce((acc, step) => acc.then(step), Promise.resolve()),
      captureSnapshot: true,
      waitForNetwork: true,
    };
  },
});

const selectOptionSchema = elementSchema.extend({
  values: z.array(z.string()).describe('Array of values to select in the dropdown. This can be a single value or multiple values.'),
});

const selectOption = defineTool({
  schema: {
    name: 'browser_select_option',
    description: 'Select an option in a dropdown',
    inputSchema: selectOptionSchema,
  },

  handle: async (context, params) => {
    const locator = context.refLocator(params);

    const code = [
      `await page.${await generateLocator(locator)}.selectOption(${format.formatObject(params.values)});`
    ];

    return {
      code,
      action: () => locator.selectOption(params.values).then(() => {}),
      captureSnapshot: true,
      waitForNetwork: true,
    };
  },
});

export default [
  snapshot,
  click,
  drag,
  hover,
  type,
  selectOption,
];
