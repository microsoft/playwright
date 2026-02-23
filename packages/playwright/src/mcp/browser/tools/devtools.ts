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

const devtoolsConnect = defineTool({
  capability: 'devtools',
  skillOnly: true,

  schema: {
    name: 'browser_devtools_start',
    title: 'Start browser DevTools',
    description: 'Start browser DevTools',
    inputSchema: z.object({}),
    type: 'action',
  },

  handle: async (context, params, response) => {
    const browserContext = await context.ensureBrowserContext();
    const { url } = await (browserContext as any)._devtoolsStart();
    response.addTextResult('Server is listening on: ' + url);
  },
});

export default [devtoolsConnect];
