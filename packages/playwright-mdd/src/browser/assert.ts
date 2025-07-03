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

import { z } from 'zod';

import { defineTool } from './tool';
import { generateLocator } from './utils';
import { elementSchema } from './snapshot';

const assertVisible = defineTool({
  schema: {
    name: 'browser_assert_visible',
    description: 'Assert that an element is visible on the page',
    inputSchema: elementSchema,
  },

  handle: async (context, params) => {
    const locator = context.refLocator(params);

    const code = [
      `await expect(page.${await generateLocator(locator)}).toBeVisible();`
    ];

    return {
      code,
      action: async () => {
        const isVisible = await locator.isVisible();
        if (!isVisible)
          throw new Error(`Expected ${params.element} to be visible, but it is hidden.`);
      },
      captureSnapshot: false,
      waitForNetwork: false,
    };
  },
});

const assertURL = defineTool({
  schema: {
    name: 'browser_assert_url',
    description: 'Assert that the current page URL matches the expected URL',
    inputSchema: z.object({
      url: z.string().describe('The expected URL regular expression, e.g. ".*example.com/path/.*"'),
      ignoreCase: z.boolean().optional().default(true).describe('Whether to ignore case when matching the URL'),
    }),
  },

  handle: async (context, params) => {
    const flags = params.ignoreCase ? 'i' : '';
    const code = [
      `await expect(page).toHaveURL(/${params.url}/${flags});`
    ];

    return {
      code,
      action: async () => {
        const re = new RegExp(params.url, flags);
        const url = context.page.url();
        if (!re.test(url))
          throw new Error(`Expected URL to match ${params.url}, but got ${url}.`);
      },
      captureSnapshot: false,
      waitForNetwork: false,
    };
  },
});

export default [
  assertVisible,
  assertURL,
];
