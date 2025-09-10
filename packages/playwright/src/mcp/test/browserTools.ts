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

import { defineBrowserTool } from './browserTool.js';
import * as mcpBundle from '../sdk/bundle';

import type * as playwright from '../../../index';
import type zod from 'zod';

const { z } = mcpBundle;

type PageEx = playwright.Page & {
  _snapshotForAI: () => Promise<string>;
};

export const snapshot = defineBrowserTool({
  schema: {
    name: 'playwright_test_browser_snapshot',
    title: 'Capture page snapshot',
    description: 'Capture page snapshot for debugging',
    inputSchema: z.object({}),
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

export const elementSchema = z.object({
  element: z.string().describe('Human-readable element description used to obtain permission to interact with the element'),
  ref: z.string().describe('Exact target element reference from the page snapshot'),
});

export const pickLocator = defineBrowserTool({
  schema: {
    name: 'playwright_test_generate_locator',
    title: 'Create locator for element',
    description: 'Generate locator for the given element to use in tests',
    inputSchema: elementSchema,
    type: 'readOnly',
  },

  handle: async (page, params) => {
    const locator = await refLocator(page, params);

    try {
      const { resolvedSelector } = await (locator as any)._resolveSelector();
      const locatorString = asLocator('javascript', resolvedSelector);
      return { content: [{ type: 'text', text: locatorString }] };
    } catch (e) {
      throw new Error(`Ref not found, likely because element was removed. Use ${snapshot.schema.name} to see what elements are currently on the page.`);
    }
  },
});

const evaluateSchema = z.object({
  function: z.string().describe('() => { /* code */ } or (element) => { /* code */ } when element is provided'),
  element: z.string().optional().describe('Human-readable element description used to obtain permission to interact with the element'),
  ref: z.string().optional().describe('Exact target element reference from the page snapshot'),
});

export const evaluate = defineBrowserTool({
  schema: {
    name: 'playwright_test_evaluate_on_pause',
    title: 'Evaluate in page',
    description: 'Evaluate JavaScript expression on page or element',
    inputSchema: evaluateSchema,
    type: 'destructive',
  },

  handle: async (page, params) => {
    let locator: playwright.Locator | undefined;
    if (params.ref && params.element)
      locator = await refLocator(page, { ref: params.ref, element: params.element });

    const receiver = locator ?? page as any;
    const result = await receiver._evaluateFunction(params.function);
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) || 'undefined' }],
    };
  },
});

async function refLocator(page: playwright.Page, elementRef: zod.output<typeof elementSchema>): Promise<playwright.Locator> {
  const snapshot = await (page as PageEx)._snapshotForAI();
  if (!snapshot.includes(`[ref=${elementRef.ref}]`))
    throw new Error(`Ref ${elementRef.ref} not found in the current page snapshot. Try capturing new snapshot.`);
  return page.locator(`aria-ref=${elementRef.ref}`).describe(elementRef.element);
}
