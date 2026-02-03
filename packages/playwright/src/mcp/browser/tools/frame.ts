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

import { z } from 'playwright-core/lib/mcpBundle';
import { defineTabTool } from './tool';
import { formatObject } from 'playwright-core/lib/utils';

const frameElementSchema = z.object({
  frameSelector: z.string().describe('CSS selector or attributes to locate the iframe element'),
  element: z.string().describe('Human-readable element description inside the iframe'),
  ref: z.string().describe('Exact target element reference from the page snapshot (inside the iframe)'),
});

const frameClick = defineTabTool({
  capability: 'core',
  schema: {
    name: 'browser_frame_click',
    title: 'Click element in iframe',
    description: 'Perform click on an element inside an iframe',
    inputSchema: frameElementSchema.extend({
      doubleClick: z.boolean().optional().describe('Whether to perform a double click instead of a single click'),
      button: z.enum(['left', 'right', 'middle']).optional().describe('Button to click, defaults to left'),
      modifiers: z.array(z.enum(['Alt', 'Control', 'ControlOrMeta', 'Meta', 'Shift'])).optional().describe('Modifier keys to press'),
    }),
    type: 'input',
  },

  handle: async (tab, params, response) => {
    response.setIncludeSnapshot();

    const frameLocator = tab.page.frameLocator(params.frameSelector);
    const locator = frameLocator.locator(`aria-ref=${params.ref}`).describe(params.element);
    
    const options = {
      button: params.button,
      modifiers: params.modifiers,
    };
    const formatted = formatObject(options, ' ', 'oneline');
    const optionsAttr = formatted !== '{}' ? formatted : '';

    if (params.doubleClick) {
      response.addCode(`await page.frameLocator('${params.frameSelector}').locator('aria-ref=${params.ref}').dblclick(${optionsAttr});`);
    } else {
      response.addCode(`await page.frameLocator('${params.frameSelector}').locator('aria-ref=${params.ref}').click(${optionsAttr});`);
    }

    await tab.waitForCompletion(async () => {
      if (params.doubleClick)
        await locator.dblclick(options);
      else
        await locator.click(options);
    });
  },
});

const frameType = defineTabTool({
  capability: 'core',
  schema: {
    name: 'browser_frame_type',
    title: 'Type text in iframe',
    description: 'Type text into an editable element inside an iframe',
    inputSchema: frameElementSchema.extend({
      text: z.string().describe('Text to type into the element'),
      submit: z.boolean().optional().describe('Whether to submit entered text (press Enter after)'),
      slowly: z.boolean().optional().describe('Whether to type one character at a time'),
    }),
    type: 'input',
  },

  handle: async (tab, params, response) => {
    const frameLocator = tab.page.frameLocator(params.frameSelector);
    const locator = frameLocator.locator(`aria-ref=${params.ref}`).describe(params.element);
    const secret = tab.context.lookupSecret(params.text);

    await tab.waitForCompletion(async () => {
      if (params.slowly) {
        response.setIncludeSnapshot();
        response.addCode(`await page.frameLocator('${params.frameSelector}').locator('aria-ref=${params.ref}').pressSequentially(${secret.code});`);
        await locator.pressSequentially(secret.value);
      } else {
        response.addCode(`await page.frameLocator('${params.frameSelector}').locator('aria-ref=${params.ref}').fill(${secret.code});`);
        await locator.fill(secret.value);
      }

      if (params.submit) {
        response.setIncludeSnapshot();
        response.addCode(`await page.frameLocator('${params.frameSelector}').locator('aria-ref=${params.ref}').press('Enter');`);
        await locator.press('Enter');
      }
    });
  },
});

const frameFill = defineTabTool({
  capability: 'core',
  schema: {
    name: 'browser_frame_fill',
    title: 'Fill input in iframe',
    description: 'Fill an input field inside an iframe',
    inputSchema: frameElementSchema.extend({
      text: z.string().describe('Text to fill into the input'),
    }),
    type: 'input',
  },

  handle: async (tab, params, response) => {
    const frameLocator = tab.page.frameLocator(params.frameSelector);
    const locator = frameLocator.locator(`aria-ref=${params.ref}`).describe(params.element);
    const secret = tab.context.lookupSecret(params.text);

    response.addCode(`await page.frameLocator('${params.frameSelector}').locator('aria-ref=${params.ref}').fill(${secret.code});`);

    await tab.waitForCompletion(async () => {
      await locator.fill(secret.value);
    });
  },
});

const frameHover = defineTabTool({
  capability: 'core',
  schema: {
    name: 'browser_frame_hover',
    title: 'Hover element in iframe',
    description: 'Hover over an element inside an iframe',
    inputSchema: frameElementSchema,
    type: 'input',
  },

  handle: async (tab, params, response) => {
    response.setIncludeSnapshot();

    const frameLocator = tab.page.frameLocator(params.frameSelector);
    const locator = frameLocator.locator(`aria-ref=${params.ref}`).describe(params.element);
    
    response.addCode(`await page.frameLocator('${params.frameSelector}').locator('aria-ref=${params.ref}').hover();`);

    await tab.waitForCompletion(async () => {
      await locator.hover();
    });
  },
});

const frameSelectOption = defineTabTool({
  capability: 'core',
  schema: {
    name: 'browser_frame_select_option',
    title: 'Select option in iframe',
    description: 'Select an option in a dropdown inside an iframe',
    inputSchema: frameElementSchema.extend({
      values: z.array(z.string()).describe('Array of values to select'),
    }),
    type: 'input',
  },

  handle: async (tab, params, response) => {
    response.setIncludeSnapshot();

    const frameLocator = tab.page.frameLocator(params.frameSelector);
    const locator = frameLocator.locator(`aria-ref=${params.ref}`).describe(params.element);
    
    response.addCode(`await page.frameLocator('${params.frameSelector}').locator('aria-ref=${params.ref}').selectOption(${formatObject(params.values)});`);

    await tab.waitForCompletion(async () => {
      await locator.selectOption(params.values);
    });
  },
});

const frameCheck = defineTabTool({
  capability: 'core',
  schema: {
    name: 'browser_frame_check',
    title: 'Check checkbox in iframe',
    description: 'Check a checkbox or radio button inside an iframe',
    inputSchema: frameElementSchema,
    type: 'input',
  },

  handle: async (tab, params, response) => {
    response.setIncludeSnapshot();

    const frameLocator = tab.page.frameLocator(params.frameSelector);
    const locator = frameLocator.locator(`aria-ref=${params.ref}`).describe(params.element);
    
    response.addCode(`await page.frameLocator('${params.frameSelector}').locator('aria-ref=${params.ref}').check();`);

    await tab.waitForCompletion(async () => {
      await locator.check();
    });
  },
});

const frameUncheck = defineTabTool({
  capability: 'core',
  schema: {
    name: 'browser_frame_uncheck',
    title: 'Uncheck checkbox in iframe',
    description: 'Uncheck a checkbox inside an iframe',
    inputSchema: frameElementSchema,
    type: 'input',
  },

  handle: async (tab, params, response) => {
    response.setIncludeSnapshot();

    const frameLocator = tab.page.frameLocator(params.frameSelector);
    const locator = frameLocator.locator(`aria-ref=${params.ref}`).describe(params.element);
    
    response.addCode(`await page.frameLocator('${params.frameSelector}').locator('aria-ref=${params.ref}').uncheck();`);

    await tab.waitForCompletion(async () => {
      await locator.uncheck();
    });
  },
});

export default [
  frameClick,
  frameType,
  frameFill,
  frameHover,
  frameSelectOption,
  frameCheck,
  frameUncheck,
];
