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
    description: 'Wait for text to appear or disappear or a specified time to pass',
    inputSchema: z.object({
      time: z.number().optional().describe(`The time to wait in seconds, at most ${maxWaitSeconds}`),
      text: z.string().optional().describe('The text to wait for'),
      textGone: z.string().optional().describe('The text to wait for to disappear'),
    }),
    type: 'assertion',
  },

  handle: async (context, params, response) => {
    if (!params.text && !params.textGone && !params.time)
      throw new Error('Either time, text or textGone must be provided');

    const time = params.time ? Math.min(maxWaitSeconds, params.time) : undefined;
    if (time) {
      response.addCode(`await new Promise(f => setTimeout(f, ${time} * 1000));`);
      await new Promise(f => setTimeout(f, time * 1000));
    }

    const tab = context.currentTabOrDie();
    const locator = params.text ? tab.page.getByText(params.text).first() : undefined;
    const goneLocator = params.textGone ? tab.page.getByText(params.textGone).first() : undefined;

    if (goneLocator) {
      response.addCode(`await page.getByText(${JSON.stringify(params.textGone)}).first().waitFor({ state: 'hidden' });`);
      await goneLocator.waitFor({ state: 'hidden', ...tab.actionTimeoutOptions });
    }

    if (locator) {
      response.addCode(`await page.getByText(${JSON.stringify(params.text)}).first().waitFor({ state: 'visible' });`);
      await locator.waitFor({ state: 'visible', ...tab.actionTimeoutOptions });
    }

    if (params.text || params.textGone)
      response.addTextResult(`Waited for ${params.text || params.textGone}`);
    else if (time !== params.time)
      response.addTextResult(`Waited for ${time} seconds (requested ${params.time}, maximum is ${maxWaitSeconds})`);
    else
      response.addTextResult(`Waited for ${time} seconds`);
    response.setIncludeSnapshot();
  },
});

export default [
  wait,
];
