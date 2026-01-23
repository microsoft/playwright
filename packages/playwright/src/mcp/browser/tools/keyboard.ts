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
import { elementSchema } from './snapshot';

const press = defineTabTool({
  capability: 'core-input',

  schema: {
    name: 'browser_press_key',
    title: 'Press a key',
    description: 'Press a key on the keyboard',
    inputSchema: z.object({
      key: z.string().describe('Name of the key to press or a character to generate, such as `ArrowLeft` or `a`'),
    }),
    type: 'input',
  },

  handle: async (tab, params, response) => {
    response.addCode(`// Press ${params.key}`);
    response.addCode(`await page.keyboard.press('${params.key}');`);
    if (params.key === 'Enter') {
      response.setIncludeSnapshot();
      await tab.waitForCompletion(async () => {
        await tab.page.keyboard.press('Enter');
      });
    } else {
      await tab.page.keyboard.press(params.key);
    }
  },
});

const pressSequentially = defineTabTool({
  capability: 'core-input',
  skillOnly: true,

  schema: {
    name: 'browser_press_sequentially',
    title: 'Type text key by key',
    description: 'Type text key by key on the keyboard',
    inputSchema: z.object({
      text: z.string().describe('Text to type'),
      submit: z.boolean().optional().describe('Whether to submit entered text (press Enter after)'),
    }),
    type: 'input',
  },

  handle: async (tab, params, response) => {
    response.addCode(`// Press ${params.text}`);
    response.addCode(`await page.keyboard.type('${params.text}');`);
    await tab.page.keyboard.type(params.text);
    if (params.submit) {
      response.addCode(`await page.keyboard.press('Enter');`);
      response.setIncludeSnapshot();
      await tab.waitForCompletion(async () => {
        await tab.page.keyboard.press('Enter');
      });
    }
  },
});

const typeSchema = elementSchema.extend({
  text: z.string().describe('Text to type into the element'),
  submit: z.boolean().optional().describe('Whether to submit entered text (press Enter after)'),
  slowly: z.boolean().optional().describe('Whether to type one character at a time. Useful for triggering key handlers in the page. By default entire text is filled in at once.'),
});

const type = defineTabTool({
  capability: 'core-input',
  schema: {
    name: 'browser_type',
    title: 'Type text',
    description: 'Type text into editable element',
    inputSchema: typeSchema,
    type: 'input',
  },

  handle: async (tab, params, response) => {
    const { locator, resolved } = await tab.refLocator(params);
    const secret = tab.context.lookupSecret(params.text);

    await tab.waitForCompletion(async () => {
      if (params.slowly) {
        response.setIncludeSnapshot();
        response.addCode(`await page.${resolved}.pressSequentially(${secret.code});`);
        await locator.pressSequentially(secret.value);
      } else {
        response.addCode(`await page.${resolved}.fill(${secret.code});`);
        await locator.fill(secret.value);
      }

      if (params.submit) {
        response.setIncludeSnapshot();
        response.addCode(`await page.${resolved}.press('Enter');`);
        await locator.press('Enter');
      }
    });
  },
});

const keydown = defineTabTool({
  capability: 'core-input',
  skillOnly: true,

  schema: {
    name: 'browser_keydown',
    title: 'Press a key down',
    description: 'Press a key down on the keyboard',
    inputSchema: z.object({
      key: z.string().describe('Name of the key to press or a character to generate, such as `ArrowLeft` or `a`'),
    }),
    type: 'input',
  },

  handle: async (tab, params, response) => {
    response.addCode(`await page.keyboard.down('${params.key}');`);
    await tab.page.keyboard.down(params.key);
  },
});

const keyup = defineTabTool({
  capability: 'core-input',
  skillOnly: true,

  schema: {
    name: 'browser_keyup',
    title: 'Press a key up',
    description: 'Press a key up on the keyboard',
    inputSchema: z.object({
      key: z.string().describe('Name of the key to press or a character to generate, such as `ArrowLeft` or `a`'),
    }),
    type: 'input',
  },

  handle: async (tab, params, response) => {
    response.addCode(`await page.keyboard.up('${params.key}');`);
    await tab.page.keyboard.up(params.key);
  },
});

export default [
  press,
  type,
  pressSequentially,
  keydown,
  keyup,
];
