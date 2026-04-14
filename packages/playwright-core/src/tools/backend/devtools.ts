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
import { elementSchema } from './snapshot';

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

const pickLocator = defineTabTool({
  capability: 'devtools',
  schema: {
    name: 'browser_pick_locator',
    title: 'Pick element locator',
    description: 'Wait for the user to pick an element in the browser and return its ref and locator.',
    inputSchema: z.object({}),
    type: 'readOnly',
  },

  handle: async (tab, params, response) => {
    const locator = await tab.page.pickLocator();
    // Regenerate aria refs so the picked element has an aria ref we can read below.
    await tab.page.ariaSnapshot({ mode: 'ai' });
    const ref = await locator.ariaRef();
    const resolved = await locator.normalize();
    response.addTextResult(`ref: ${ref ?? '(none)'}\nlocator: ${resolved.toString()}`);
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
    const { locator, resolved } = await tab.refLocator(params);
    await locator.highlight({ style: params.style });
    response.addTextResult(`Highlighted ${resolved}`);
  },
});

const hideHighlight = defineTabTool({
  capability: 'devtools',
  schema: {
    name: 'browser_hide_highlight',
    title: 'Hide element highlight',
    description: 'Remove a highlight overlay previously added for the element.',
    inputSchema: elementSchema,
    type: 'readOnly',
  },

  handle: async (tab, params, response) => {
    const { locator, resolved } = await tab.refLocator(params);
    await locator.hideHighlight();
    response.addTextResult(`Hid highlight for ${resolved}`);
  },
});

export default [resume, pickLocator, highlight, hideHighlight];
