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

import { waitForCompletion } from '../utils';

import type * as playwright from 'playwright';
import type { ImageContent, TextContent } from '@modelcontextprotocol/sdk/types';

export type ToolContext = {
  page: playwright.Page;
};

export type ToolSchema = {
  name: string;
  description: string;
  inputSchema: Record<string, any>;
};

export type ToolResult = {
  content: (ImageContent | TextContent)[];
  isError?: boolean;
};

export type Tool = {
  schema: ToolSchema;
  handle: (context: ToolContext, params?: Record<string, any>) => Promise<ToolResult>;
};

export const navigate: Tool = {
  schema: {
    name: 'navigate',
    description: 'Navigate to a URL',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'URL to navigate to',
        },
      },
    }
  },

  handle: async (context, params) => {
    await waitForCompletion(context.page, async () => {
      await context.page.goto(params!.url as string);
    });
    return {
      content: [{
        type: 'text',
        text: `Navigated to ${params!.url}`,
      }],
    };
  }
};

export const wait: Tool = {
  schema: {
    name: 'wait',
    description: `Wait for given amount of time to see if the page updates. Use it after action if you think page is not ready yet`,
    inputSchema: {
      type: 'object',
      properties: {
        time: {
          type: 'integer',
          description: 'Time to wait in seconds',
        },
      },
      required: ['time'],
    }
  },

  handle: async (context, params) => {
    await context.page.waitForTimeout(Math.min(10000, params!.time as number * 1000));
    return {
      content: [{
        type: 'text',
        text: `Waited for ${params!.time} seconds`,
      }],
    };
  }
};

export const pressKey: Tool = {
  schema: {
    name: 'press_key',
    description: 'Press a key',
    inputSchema: {
      type: 'object',
      properties: {
        key: {
          type: 'string',
          description: 'Name of the key to press or a character to generate, such as `ArrowLeft` or `a`',
        },
      },
      required: ['key'],
    }
  },

  handle: async (context, params) => {
    await waitForCompletion(context.page, async () => {
      await context.page.keyboard.press(params!.key as string);
    });
    return {
      content: [{
        type: 'text',
        text: `Pressed key ${params!.key}`,
      }],
    };
  }
};
