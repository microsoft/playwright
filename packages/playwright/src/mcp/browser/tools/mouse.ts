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

const mouseMove = defineTabTool({
  capability: 'vision',
  schema: {
    name: 'browser_mouse_move_xy',
    title: 'Move mouse',
    description: 'Move mouse to a given position',
    inputSchema: z.object({
      x: z.number().describe('X coordinate'),
      y: z.number().describe('Y coordinate'),
    }),
    type: 'input',
  },

  handle: async (tab, params, response) => {
    response.addCode(`// Move mouse to (${params.x}, ${params.y})`);
    response.addCode(`await page.mouse.move(${params.x}, ${params.y});`);

    await tab.waitForCompletion(async () => {
      await tab.page.mouse.move(params.x, params.y);
    });
  },
});

const mouseDown = defineTabTool({
  capability: 'vision',

  schema: {
    name: 'browser_mouse_down',
    title: 'Press mouse down',
    description: 'Press mouse down',
    inputSchema: z.object({
      button: z.enum(['left', 'right', 'middle']).optional().describe('Button to press, defaults to left'),
    }),
    type: 'input',
  },

  handle: async (tab, params, response) => {
    response.addCode(`// Press mouse down`);
    if (params.button !== undefined)
      response.addCode(`await page.mouse.down({ button: '${params.button}' });`);
    else
      response.addCode(`await page.mouse.down();`);

    // Avoid passing { button: undefined } - it creates invalid code and is unnecessary.
    if (params.button !== undefined)
      await tab.page.mouse.down({ button: params.button });
    else
      await tab.page.mouse.down();
  },
});

const mouseUp = defineTabTool({
  capability: 'vision',

  schema: {
    name: 'browser_mouse_up',
    title: 'Press mouse up',
    description: 'Press mouse up',
    inputSchema: z.object({
      button: z.enum(['left', 'right', 'middle']).optional().describe('Button to press, defaults to left'),
    }),
    type: 'input',
  },

  handle: async (tab, params, response) => {
    response.addCode(`// Press mouse up`);
    if (params.button !== undefined)
      response.addCode(`await page.mouse.up({ button: '${params.button}' });`);
    else
      response.addCode(`await page.mouse.up();`);

    if (params.button !== undefined)
      await tab.page.mouse.up({ button: params.button });
    else
      await tab.page.mouse.up();
  },
});

const mouseWheel = defineTabTool({
  capability: 'vision',
  schema: {
    name: 'browser_mouse_wheel',
    title: 'Scroll mouse wheel',
    description: 'Scroll mouse wheel',
    inputSchema: z.object({
      deltaX: z.number().default(0).describe('X delta'),
      deltaY: z.number().default(0).describe('Y delta'),
    }),
    type: 'input',
  },

  handle: async (tab, params, response) => {
    response.addCode(`// Scroll mouse wheel`);
    response.addCode(`await page.mouse.wheel(${params.deltaX}, ${params.deltaY});`);
    await tab.page.mouse.wheel(params.deltaX, params.deltaY);
  },
});

const mouseClick = defineTabTool({
  capability: 'vision',
  schema: {
    name: 'browser_mouse_click_xy',
    title: 'Click',
    description: 'Click mouse button at a given position',
    inputSchema: z.object({
      x: z.number().describe('X coordinate'),
      y: z.number().describe('Y coordinate'),
      button: z.enum(['left', 'right', 'middle']).optional().describe('Button to click, defaults to left'),
      clickCount: z.number().int().optional().describe('Number of clicks'),
      delay: z.number().optional().describe('Delay between down and up in milliseconds'),
    }),
    type: 'input',
  },

  handle: async (tab, params, response) => {
    response.setIncludeSnapshot();

    response.addCode(`// Click mouse at coordinates (${params.x}, ${params.y})`);
    if (params.button !== undefined || params.clickCount !== undefined || params.delay !== undefined) {
      const parts: string[] = [];
      if (params.button !== undefined)
        parts.push(`button: '${params.button}'`);
      if (params.clickCount !== undefined)
        parts.push(`clickCount: ${params.clickCount}`);
      if (params.delay !== undefined)
        parts.push(`delay: ${params.delay}`);
      response.addCode(`await page.mouse.click(${params.x}, ${params.y}, { ${parts.join(', ')} });`);
    } else {
      response.addCode(`await page.mouse.click(${params.x}, ${params.y});`);
    }

    await tab.waitForCompletion(async () => {
      await tab.page.mouse.click(params.x, params.y, {
        ...(params.button !== undefined ? { button: params.button } : {}),
        ...(params.clickCount !== undefined ? { clickCount: params.clickCount } : {}),
        ...(params.delay !== undefined ? { delay: params.delay } : {}),
      });
    });
  },
});

const mouseDrag = defineTabTool({
  capability: 'vision',
  schema: {
    name: 'browser_mouse_drag_xy',
    title: 'Drag mouse',
    description: 'Drag left mouse button to a given position',
    inputSchema: z.object({
      startX: z.number().describe('Start X coordinate'),
      startY: z.number().describe('Start Y coordinate'),
      endX: z.number().describe('End X coordinate'),
      endY: z.number().describe('End Y coordinate'),
    }),
    type: 'input',
  },

  handle: async (tab, params, response) => {
    response.setIncludeSnapshot();

    response.addCode(`// Drag mouse from (${params.startX}, ${params.startY}) to (${params.endX}, ${params.endY})`);
    response.addCode(`await page.mouse.move(${params.startX}, ${params.startY});`);
    response.addCode(`await page.mouse.down();`);
    response.addCode(`await page.mouse.move(${params.endX}, ${params.endY});`);
    response.addCode(`await page.mouse.up();`);

    await tab.waitForCompletion(async () => {
      await tab.page.mouse.move(params.startX, params.startY);
      await tab.page.mouse.down();
      await tab.page.mouse.move(params.endX, params.endY);
      await tab.page.mouse.up();
    });
  },
});

export default [
  mouseMove,
  mouseClick,
  mouseDrag,
  mouseDown,
  mouseUp,
  mouseWheel,
];
