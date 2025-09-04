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

import { z } from '../../sdk/bundle';
import { defineTabTool } from './tool';
import * as javascript from '../codegen';
import { generateLocator } from './utils';

import type * as playwright from 'playwright-core';

const evaluateSchema = z.object({
  function: z.string().describe('() => { /* code */ } or (element) => { /* code */ } when element is provided'),
  element: z.string().optional().describe('Human-readable element description used to obtain permission to interact with the element'),
  ref: z.string().optional().describe('Exact target element reference from the page snapshot'),
});

const evaluate = defineTabTool({
  capability: 'core',
  schema: {
    name: 'browser_evaluate',
    title: 'Evaluate JavaScript',
    description: 'Evaluate JavaScript expression on page or element',
    inputSchema: evaluateSchema,
    type: 'destructive',
  },

  handle: async (tab, params, response) => {
    response.setIncludeSnapshot();

    let locator: playwright.Locator | undefined;
    if (params.ref && params.element) {
      locator = await tab.refLocator({ ref: params.ref, element: params.element });
      response.addCode(`await page.${await generateLocator(locator)}.evaluate(${javascript.quote(params.function)});`);
    } else {
      response.addCode(`await page.evaluate(${javascript.quote(params.function)});`);
    }

    await tab.waitForCompletion(async () => {
      const receiver = locator ?? tab.page as any;
      const result = await receiver._evaluateFunction(params.function);
      response.addResult(JSON.stringify(result, null, 2) || 'undefined');
    });
  },
});

export default [
  evaluate,
];
