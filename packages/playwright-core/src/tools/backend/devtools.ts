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
import { defineTabTool, defineTool } from './tool';
import { elementSchema, optionalElementSchema } from './snapshot';

const resume = defineTool({
  capability: 'devtools',

  schema: {
    name: 'browser_resume',
    title: 'Resume paused script execution',
    description: 'Resume script execution after it was paused. When called with step set to true, execution will pause again before the next action.',
    inputSchema: z.object({
      step: z.boolean().optional().describe('When true, execution will pause again before the next action, allowing step-by-step debugging.'),
      location: z.string().optional().describe('Pause execution at a specific <file>:<line>, e.g. "example.spec.ts:42".'),
    }),
    type: 'action',
  },

  handle: async (context, params, response) => {
    const browserContext = await context.ensureBrowserContext();
    const pausedPromise = new Promise<void>(resolve => {
      const listener = () => {
        if (browserContext.debugger.pausedDetails()) {
          browserContext.debugger.off('pausedstatechanged', listener);
          resolve();
        }
      };
      browserContext.debugger.on('pausedstatechanged', listener);
    });

    if (params.location) {
      const [file, lineStr] = params.location.split(':');
      let location;
      if (lineStr) {
        const line = Number(lineStr);
        if (isNaN(line))
          throw new Error(`Invalid location "${params.location}", expected format is <file>:<line>, e.g. "example.spec.ts:42"`);
        location = { file, line };
      } else {
        location = { file: params.location };
      }
      await browserContext.debugger.runTo(location);
    } else if (params.step) {
      await browserContext.debugger.next();
    } else {
      await browserContext.debugger.resume();
    }
    await pausedPromise;
  },
});

const highlight = defineTabTool({
  capability: 'devtools',
  schema: {
    name: 'browser_highlight',
    title: 'Highlight element',
    description: 'Show a persistent highlight overlay around the element on the page.',
    inputSchema: elementSchema.extend({
      style: z.string().optional().describe('Additional inline CSS applied to the highlight overlay, e.g. "outline: 2px dashed red".'),
    }),
    type: 'readOnly',
  },

  handle: async (tab, params, response) => {
    const { locator } = await tab.targetLocator(params);
    await locator.highlight({ style: params.style });
    response.addTextResult(`Highlighted ${locator}`);
  },
});

const hideHighlight = defineTabTool({
  capability: 'devtools',
  schema: {
    name: 'browser_hide_highlight',
    title: 'Hide element highlight',
    description: 'Remove a highlight overlay previously added for the element.',
    inputSchema: optionalElementSchema.extend({
      element: z.string().optional().describe('Human-readable element description used when adding the highlight; must match the value passed to browser_highlight.'),
    }),
    type: 'readOnly',
  },

  handle: async (tab, params, response) => {
    if (params.target) {
      const { locator } = await tab.targetLocator({ target: params.target, element: params.element });
      await locator.hideHighlight();
      response.addTextResult(`Hid highlight for ${locator}`);
    } else {
      await tab.page.hideHighlight();
      response.addTextResult(`Hid page highlight`);
    }
  },
});

export default [resume, highlight, hideHighlight];
