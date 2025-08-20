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

import { asLocator } from 'playwright-core/lib/utils';

import { defineTool } from './tool.js';
import * as mcp from '../sdk/bundle';

import type * as playwright from '../../../index';
import type z from 'zod';

type PageEx = playwright.Page & {
  _snapshotForAI: () => Promise<string>;
};

export const snapshot = defineTool({
  schema: {
    name: 'browser_snapshot',
    title: 'Page snapshot',
    description: 'Capture accessibility snapshot of the current page, this is better than screenshot',
    inputSchema: mcp.z.object({}),
    type: 'readOnly',
  },

  handle: async (page, params) => {
    const snapshot = await (page as PageEx)._snapshotForAI();
    return {
      content: [
        {
          type: 'text',
          text: snapshot,
        },
      ],
    };
  },
});

export const elementSchema = mcp.z.object({
  element: mcp.z.string().describe('Human-readable element description used to obtain permission to interact with the element'),
  ref: mcp.z.string().describe('Exact target element reference from the page snapshot'),
});

export const pickLocator = defineTool({
  schema: {
    name: 'browser_pick_locator',
    title: 'Pick locator',
    description: 'Pick a locator for the given element',
    inputSchema: elementSchema,
    type: 'readOnly',
  },

  handle: async (page, params) => {
    const locator = await refLocator(page, params);
    const locatorString = await generateLocator(locator);
    return {
      content: [
        {
          type: 'text',
          text: locatorString,
        },
      ],
    };
  },
});


const evaluateSchema = mcp.z.object({
  function: mcp.z.string().describe('() => { /* code */ } or (element) => { /* code */ } when element is provided'),
  element: mcp.z.string().optional().describe('Human-readable element description used to obtain permission to interact with the element'),
  ref: mcp.z.string().optional().describe('Exact target element reference from the page snapshot'),
});

export const evaluate = defineTool({
  schema: {
    name: 'browser_evaluate',
    title: 'Evaluate JavaScript',
    description: 'Evaluate JavaScript expression on page or element',
    inputSchema: evaluateSchema,
    type: 'destructive',
  },

  handle: async (page, params) => {
    if (params.ref && params.element) {
      const locator = await refLocator(page, { ref: params.ref, element: params.element });
      const result = await locator.evaluate(params.function);
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) || 'undefined' }],
      };
    }

    const result = await page.evaluate(params.function);
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) || 'undefined' }],
    };
  },
});

async function refLocator(page: playwright.Page, elementRef: z.output<typeof elementSchema>): Promise<playwright.Locator> {
  const snapshot = await (page as PageEx)._snapshotForAI();
  if (!snapshot.includes(`[ref=${elementRef.ref}]`))
    throw new Error(`Ref ${elementRef.ref} not found in the current page snapshot. Try capturing new snapshot.`);
  return page.locator(`aria-ref=${elementRef.ref}`).describe(elementRef.element);
}

async function generateLocator(locator: playwright.Locator): Promise<string> {
  try {
    const { resolvedSelector } = await (locator as any)._resolveSelector();
    return asLocator('javascript', resolvedSelector);
  } catch (e) {
    throw new Error('Ref not found, likely because element was removed. Use browser_snapshot to see what elements are currently on the page.');
  }
}
