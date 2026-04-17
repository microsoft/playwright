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
import { escapeWithQuotes } from '@isomorphic/stringUtils';

import { defineTabTool } from './tool';
import { optionalElementSchema } from './snapshot';

import type { Tab } from './tab';

const evaluateSchema = optionalElementSchema.extend({
  function: z.string().describe('() => { /* code */ } or (element) => { /* code */ } when element is provided'),
  filename: z.string().optional().describe('Filename to save the result to. If not provided, result is returned as text.'),
});

const evaluate = defineTabTool({
  capability: 'core',
  schema: {
    name: 'browser_evaluate',
    title: 'Evaluate JavaScript',
    description: 'Evaluate JavaScript expression on page or element',
    inputSchema: evaluateSchema,
    type: 'action',
  },

  handle: async (tab, params, response) => {
    let locator: Awaited<ReturnType<Tab['targetLocator']>> | undefined;
    const expression = params.function;
    if (params.target)
      locator = await tab.targetLocator({ target: params.target, element: params.element || 'element' });

    await tab.waitForCompletion(async () => {
      let evalResult: { result: unknown, isFunction: boolean };
      if (locator?.locator) {
        evalResult = await locator.locator.evaluate(async (element, expr) => {
          const value = eval(`(${expr})`);
          const isFunction = typeof value === 'function';
          const result = await (isFunction ? value(element) : value);
          return { result, isFunction };
        }, expression);
      } else {
        evalResult = await tab.page.evaluate(async expr => {
          const value = eval(`(${expr})`);
          const isFunction = typeof value === 'function';
          const result = await (isFunction ? value() : value);
          return { result, isFunction };
        }, expression);
      }

      const codeExpression = evalResult.isFunction ? expression : `() => (${expression})`;
      if (locator)
        response.addCode(`await page.${locator.resolved}.evaluate(${escapeWithQuotes(codeExpression)});`);
      else
        response.addCode(`await page.evaluate(${escapeWithQuotes(codeExpression)});`);

      const text = JSON.stringify(evalResult.result, null, 2) ?? 'undefined';
      await response.addResult('Evaluation result', text, { prefix: 'result', ext: 'json', suggestedFilename: params.filename });
    }).catch(e => {
      response.addError(e instanceof Error ? e.message : String(e));
    });
  },
});

export default [
  evaluate,
];
