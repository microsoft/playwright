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

import { defineTool } from './tool.js';

const navigate = defineTool({
  schema: {
    name: 'browser_navigate',
    description: 'Navigate to a URL',
    inputSchema: z.object({
      url: z.string().describe('The URL to navigate to'),
    }),
  },

  handle: async (context, params) => {
    const code = [
      `await page.goto('${params.url}');`,
    ];
    await context.navigate(params.url);

    return {
      code,
      captureSnapshot: true,
      waitForNetwork: false,
    };
  },
});

const goBack = defineTool({
  schema: {
    name: 'browser_navigate_back',
    description: 'Go back to the previous page',
    inputSchema: z.object({}),
  },

  handle: async context => {
    await context.page.goBack();
    const code = [
      `await page.goBack();`,
    ];

    return {
      code,
      captureSnapshot: true,
      waitForNetwork: false,
    };
  },
});

const goForward = defineTool({
  schema: {
    name: 'browser_navigate_forward',
    description: 'Go forward to the next page',
    inputSchema: z.object({}),
  },
  handle: async context => {
    await context.page.goForward();
    const code = [
      `await page.goForward();`,
    ];
    return {
      code,
      captureSnapshot: true,
      waitForNetwork: false,
    };
  },
});

export default [
  navigate,
  goBack,
  goForward,
];
