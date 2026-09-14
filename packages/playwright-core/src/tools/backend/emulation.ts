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

import { defineTabTool } from './tool';

const emulateMedia = defineTabTool({
  capability: 'core',
  schema: {
    name: 'browser_emulate_media',
    title: 'Emulate media features',
    description: 'Emulate CSS media features for the page, for example switch between the light and dark color scheme. Omitted parameters are left unchanged; null clears an override.',
    inputSchema: z.object({
      colorScheme: z.enum(['light', 'dark']).nullable().optional().describe('Emulates the prefers-color-scheme media feature'),
      reducedMotion: z.enum(['reduce', 'no-preference']).nullable().optional().describe('Emulates the prefers-reduced-motion media feature'),
      forcedColors: z.enum(['active', 'none']).nullable().optional().describe('Emulates the forced-colors media feature'),
      contrast: z.enum(['more', 'no-preference']).nullable().optional().describe('Emulates the prefers-contrast media feature'),
      media: z.enum(['screen', 'print']).nullable().optional().describe('Changes the CSS media type of the page'),
    }),
    type: 'action',
  },

  handle: async (tab, params, response) => {
    if (Object.values(params).every(value => value === undefined)) {
      response.addError('Error: Specify at least one media feature to emulate.');
      return;
    }
    response.addCode(`await page.emulateMedia(${formatObject(params, '  ', 'oneline')});`);
    await tab.page.emulateMedia(params);
  },
});

export default [
  emulateMedia,
];
