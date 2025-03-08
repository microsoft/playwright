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

import { Tool } from './common';
import { waitForCompletion } from '../utils';

export const screenshot: Tool = {
  schema: {
    name: 'screenshot',
    description: 'Take a screenshot of the current page',
    inputSchema: {
      type: 'object',
      properties: {},
    }
  },

  handle: async context => {
    const screenshot = await context.page.screenshot({ type: 'jpeg', quality: 50, scale: 'css' });
    return {
      content: [{ type: 'image', data: screenshot.toString('base64'), mimeType: 'image/jpeg' }],
    };
  }
};

export const moveMouse: Tool = {
  schema: {
    name: 'move_mouse',
    description: 'Move mouse to a given position',
    inputSchema: {
      type: 'object',
      properties: {
        x: {
          type: 'number',
          description: 'X coordinate',
        },
        y: {
          type: 'number',
          description: 'Y coordinate',
        },
      },
      required: ['x', 'y'],
    }
  },

  handle: async (context, params) => {
    await context.page.mouse.move(params!.x as number, params!.y as number);
    return {
      content: [{ type: 'text', text: `Moved mouse to (${params!.x}, ${params!.y})` }],
    };
  }
};

export const click: Tool = {
  schema: {
    name: 'click',
    description: 'Click left mouse button',
    inputSchema: {
      type: 'object',
      properties: {},
    }
  },

  handle: async context => {
    await waitForCompletion(context.page, async () => {
      await context.page.mouse.down();
      await context.page.mouse.up();
    });
    return {
      content: [{ type: 'text', text: 'Clicked mouse' }],
    };
  }
};

export const drag: Tool = {
  schema: {
    name: 'drag',
    description: 'Drag left mouse button',
    inputSchema: {
      type: 'object',
      properties: {
        x: {
          type: 'number',
          description: 'X coordinate',
        },
        y: {
          type: 'number',
          description: 'Y coordinate',
        },
      },
      required: ['x', 'y'],
    }
  },

  handle: async (context, params) => {
    await waitForCompletion(context.page, async () => {
      await context.page.mouse.down();
      await context.page.mouse.move(params!.x as number, params!.y as number);
      await context.page.mouse.up();
    });
    return {
      content: [{ type: 'text', text: `Dragged mouse to (${params!.x}, ${params!.y})` }],
    };
  }
};

export const type: Tool = {
  schema: {
    name: 'type',
    description: 'Type text',
    inputSchema: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'Text to type',
        },
      },
      required: ['text'],
    }
  },

  handle: async (context, params) => {
    await waitForCompletion(context.page, async () => {
      await context.page.keyboard.type(params!.text as string);
    });
    return {
      content: [{ type: 'text', text: `Typed text "${params!.text}"` }],
    };
  }
};
