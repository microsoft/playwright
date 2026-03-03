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

import { z } from 'playwright-core/lib/mcpBundle';
import { defineTool } from './tool';

const initiateReplay = defineTool({
  capability: 'core-navigation',

  schema: {
    name: 'browser_initiate_replay',
    title: 'Initiate navigation replay recording',
    description: 'Navigate to the dashboard URL to begin recording navigation steps for recipe creation. This resets the browser to the post-login state and activates the recording system.',
    inputSchema: z.object({
      url: z.string().describe('The post-login dashboard URL to navigate to'),
    }),
    type: 'action',
  },

  handle: async (context, params, response) => {
    const tab = await context.ensureTab();
    await tab.navigate(params.url);
    response.setIncludeSnapshot();
    response.addCode(`await page.goto('${params.url}');`);
  },
});

export default [initiateReplay];
