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

import type { Tool } from './tool';

export const screenshot: Tool = {
  schema: {
    name: 'screenshot',
    description: 'Take a screenshot of the current page',
    inputSchema: zodToJsonSchema(z.object({})),
  },

  handle: async context => {
    const screenshot = await context.page.screenshot({ type: 'jpeg', quality: 50, scale: 'css' });
    return {
      content: [{ type: 'image', data: screenshot.toString('base64'), mimeType: 'image/jpeg' }],
    };
  },
};

const elementSchema = z.object({
  element: z.string().describe('Element label, description or any other text to describe the element'),
});

const moveMouseSchema = elementSchema.extend({
  x: z.number().describe('X coordinate'),
  y: z.number().describe('Y coordinate'),
});

export const moveMouse: Tool = {
  schema: {
    name: 'move_mouse',
    description: 'Move mouse to a given position',
    inputSchema: zodToJsonSchema(moveMouseSchema),
  },

  handle: async (context, params) => {
    const validatedParams = moveMouseSchema.parse(params);
    await context.page.mouse.move(validatedParams.x, validatedParams.y);
    return {
      content: [{ type: 'text', text: `Moved mouse to (${validatedParams.x}, ${validatedParams.y})` }],
    };
  },
};

export const click: Tool = {
  schema: {
    name: 'click',
    description: 'Click left mouse button',
    inputSchema: zodToJsonSchema(elementSchema),
  },

  handle: async context => {
    await runAndWait(context, async () => {
      await context.page.mouse.down();
      await context.page.mouse.up();
    });
    return {
      content: [{ type: 'text', text: 'Clicked mouse' }],
    };
  },
};

const dragSchema = elementSchema.extend({
  x: z.number().describe('X coordinate'),
  y: z.number().describe('Y coordinate'),
});

export const drag: Tool = {
  schema: {
    name: 'drag',
    description: 'Drag left mouse button',
    inputSchema: zodToJsonSchema(dragSchema),
  },

  handle: async (context, params) => {
    const validatedParams = dragSchema.parse(params);
    await runAndWait(context, async () => {
      await context.page.mouse.down();
      await context.page.mouse.move(validatedParams.x, validatedParams.y);
      await context.page.mouse.up();
    });
    return {
      content: [{ type: 'text', text: `Dragged mouse to (${validatedParams.x}, ${validatedParams.y})` }],
    };
  },
};

const typeSchema = z.object({
  text: z.string().describe('Text to type'),
});

export const type: Tool = {
  schema: {
    name: 'type',
    description: 'Type text',
    inputSchema: zodToJsonSchema(typeSchema),
  },

  handle: async (context, params) => {
    const validatedParams = typeSchema.parse(params);
    await runAndWait(context, async () => {
      await context.page.keyboard.type(validatedParams.text);
    });
    return {
      content: [{ type: 'text', text: `Typed text "${validatedParams.text}"` }],
    };
  },
};
