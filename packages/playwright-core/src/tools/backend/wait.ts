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
import { defineTool } from './tool';

const maxWaitSeconds = 30;

const wait = defineTool({
  capability: 'core',

  schema: {
    name: 'browser_wait_for',
    title: 'Wait for',
    description: 'Wait for text to appear or disappear or a specified time to pass. When both text and textGone are provided, waits for the first one to happen',
    inputSchema: z.object({
      time: z.number().optional().describe(`The time to wait in seconds, at most ${maxWaitSeconds}. When combined with text or textGone, serves as a timeout for them instead of the default action timeout`),
      text: z.string().optional().describe('The text to wait for'),
      textGone: z.string().optional().describe('The text to wait for to disappear'),
    }),
    type: 'assertion',
  },

  handle: async (context, params, response) => {
    if (!params.text && !params.textGone && !params.time)
      throw new Error('Either time, text or textGone must be provided');

    const tab = context.currentTabOrDie();
    const time = params.time ? Math.min(maxWaitSeconds, params.time) : undefined;

    if (params.text || params.textGone) {
      const timeoutOptions = time ? { timeout: time * 1000 } : tab.actionTimeoutOptions;
      const waitForText = async (text: string, state: 'visible' | 'hidden') => {
        await tab.page.getByText(text).first().waitFor({ state, ...timeoutOptions });
        return {
          code: `await page.getByText(${JSON.stringify(text)}).first().waitFor({ state: '${state}' });`,
          result: `Waited for ${text}`,
        };
      };
      const waits = [
        params.text ? waitForText(params.text, 'visible') : undefined,
        params.textGone ? waitForText(params.textGone, 'hidden') : undefined,
      ].filter(wait => !!wait);
      // The wait that lost the race will eventually fail, do not report it.
      for (const wait of waits)
        wait.catch(() => {});
      const outcome = await Promise.race(waits);
      response.addCode(outcome.code);
      response.addTextResult(outcome.result);
    } else if (time) {
      response.addCode(`await new Promise(f => setTimeout(f, ${time} * 1000));`);
      await new Promise(f => setTimeout(f, time * 1000));
      if (time !== params.time)
        response.addTextResult(`Waited for ${time} seconds (requested ${params.time}, maximum is ${maxWaitSeconds})`);
      else
        response.addTextResult(`Waited for ${time} seconds`);
    }
    response.setIncludeSnapshot();
  },
});

export default [
  wait,
];
