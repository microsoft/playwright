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
import { formatObject } from '@isomorphic/stringUtils';

import { defineTabTool, defineTool } from './tool';
import { renderTabsMarkdown } from './response';

const close = defineTool({
  capability: 'core',

  schema: {
    name: 'browser_close',
    title: 'Close browser',
    description: 'Close the page',
    inputSchema: z.object({}),
    type: 'action',
  },

  handle: async (context, params, response) => {
    const result = renderTabsMarkdown([]);
    response.addTextResult(result.join('\n'));
    response.addCode(`await page.close()`);
    response.setClose();
  },
});

const resize = defineTabTool({
  capability: 'core',
  schema: {
    name: 'browser_resize',
    title: 'Resize browser window',
    description: 'Resize the browser window',
    inputSchema: z.object({
      width: z.number().describe('Width of the browser window'),
      height: z.number().describe('Height of the browser window'),
    }),
    type: 'action',
  },

  handle: async (tab, params, response) => {
    response.addCode(`await page.setViewportSize({ width: ${params.width}, height: ${params.height} });`);
    await tab.page.setViewportSize({ width: params.width, height: params.height });
  },
});

const emulateMedia = defineTabTool({
  capability: 'core',
  schema: {
    name: 'browser_emulate_media',
    title: 'Emulate media features',
    description: 'Emulate CSS media features for the page, for example switch between the light and dark color scheme. Omitted parameters are left unchanged.',
    inputSchema: z.object({
      colorScheme: z.enum(['light', 'dark']).optional().describe('Emulates the prefers-color-scheme media feature'),
      reducedMotion: z.enum(['reduce', 'no-preference']).optional().describe('Emulates the prefers-reduced-motion media feature'),
      forcedColors: z.enum(['active', 'none']).optional().describe('Emulates the forced-colors media feature'),
      contrast: z.enum(['more', 'no-preference']).optional().describe('Emulates the prefers-contrast media feature'),
      media: z.enum(['screen', 'print']).optional().describe('Changes the CSS media type of the page'),
    }),
    type: 'action',
  },

  handle: async (tab, params, response) => {
    const requested = {
      colorScheme: params.colorScheme,
      contrast: params.contrast,
      forcedColors: params.forcedColors,
      media: params.media,
      reducedMotion: params.reducedMotion,
    };
    // Only pass through the features that were specified, so that the omitted
    // ones keep their current emulation state.
    const options = Object.fromEntries(
        Object.entries(requested).filter(([, value]) => value !== undefined)
    ) as typeof requested;

    if (!Object.keys(options).length) {
      response.addError('Error: Specify at least one media feature to emulate.');
      return;
    }

    response.addCode(`await page.emulateMedia(${formatObject(options, '  ', 'oneline')});`);
    await tab.page.emulateMedia(options);
  },
});

export default [
  close,
  resize,
  emulateMedia
];
