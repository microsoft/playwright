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

const show = defineTool({
  capability: 'devtools',

  schema: {
    name: 'browser_show',
    title: 'Show browser DevTools',
    description: 'Show browser DevTools',
    inputSchema: z.object({
      host: z.string().optional().describe('Host to use'),
      port: z.number().optional().describe('Port to use'),
      guid: z.string().optional().describe('Endpoint guid to expose'),
    }),
    type: 'action',
  },

  handle: async (context, params, response) => {
    const browserContext = await context.ensureBrowserContext();
    const { url } = await (browserContext as any)._devtoolsStart(params);
    response.addTextResult('Show server is listening on: ' + url);
  },
});

export default [show];
