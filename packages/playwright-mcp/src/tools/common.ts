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
import { zodToJsonSchema } from 'zod-to-json-schema';

import { runAndWait } from './utils';

import type { ToolFactory, Tool } from './tool';

const navigateSchema = z.object({
  url: z.string().describe('The URL to navigate to'),
});

export const navigate: ToolFactory = snapshot => ({
  schema: {
    name: 'navigate',
    description: 'Navigate to a URL',
    inputSchema: zodToJsonSchema(navigateSchema),
  },
  handle: async (context, params) => {
    const validatedParams = navigateSchema.parse(params);
    return await runAndWait(context, async () => {
      await context.page.goto(validatedParams.url);
      return {
        content: [{
          type: 'text',
          text: `Navigated to ${validatedParams.url}`,
        }],
      };
    }, snapshot);
  },
});

const goBackSchema = z.object({});

export const goBack: ToolFactory = snapshot => ({
  schema: {
    name: 'goBack',
    description: 'Go back to the previous page',
    inputSchema: zodToJsonSchema(goBackSchema),
  },
  handle: async context => {
    return await runAndWait(context, async () => {
      await context.page.goBack();
      return {
        content: [{
          type: 'text',
          text: `Navigated back`,
        }],
      };
    }, snapshot);
  },
});

const goForwardSchema = z.object({});

export const goForward: ToolFactory = snapshot => ({
  schema: {
    name: 'goForward',
    description: 'Go forward to the next page',
    inputSchema: zodToJsonSchema(goForwardSchema),
  },
  handle: async context => {
    return await runAndWait(context, async () => {
      await context.page.goForward();
      return {
        content: [{
          type: 'text',
          text: `Navigated forward`,
        }],
      };
    }, snapshot);
  },
});

const waitSchema = z.object({
  time: z.number().describe('The time to wait in seconds'),
});

export const wait: Tool = {
  schema: {
    name: 'wait',
    description: 'Wait for a specified time in seconds',
    inputSchema: zodToJsonSchema(waitSchema),
  },
  handle: async (context, params) => {
    const validatedParams = waitSchema.parse(params);
    await context.page.waitForTimeout(Math.min(10000, validatedParams.time * 1000));
    return {
      content: [{
        type: 'text',
        text: `Waited for ${validatedParams.time} seconds`,
      }],
    };
  },
};

const pressKeySchema = z.object({
  key: z.string().describe('Name of the key to press or a character to generate, such as `ArrowLeft` or `a`'),
});

export const pressKey: Tool = {
  schema: {
    name: 'press',
    description: 'Press a key on the keyboard',
    inputSchema: zodToJsonSchema(pressKeySchema),
  },
  handle: async (context, params) => {
    const validatedParams = pressKeySchema.parse(params);
    return await runAndWait(context, async () => {
      await context.page.keyboard.press(validatedParams.key);
      return {
        content: [{
          type: 'text',
          text: `Pressed key ${validatedParams.key}`,
        }],
      };
    });
  },
};
