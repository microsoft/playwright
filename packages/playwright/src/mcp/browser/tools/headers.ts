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
import { defineTool } from './tool';

const setHeaders = defineTool({
  capability: 'headers',

  schema: {
    name: 'browser_set_headers',
    title: 'Set extra HTTP headers',
    description: 'Persistently set custom HTTP headers on the active browser context.',
    inputSchema: z.object({
      headers: z.record(z.string(), z.string()).describe('Header names mapped to the values that should be sent with every request.'),
    }),
    type: 'action',
  },

  handle: async (context, params, response) => {
    try {
      await context.setExtraHTTPHeaders(params.headers);
    } catch (error) {
      response.addError((error as Error).message);
      return;
    }

    const count = Object.keys(params.headers).length;
    response.addResult(`Configured ${count} ${count === 1 ? 'header' : 'headers'} for this session.`);
    response.addCode(`await context.setExtraHTTPHeaders(${JSON.stringify(params.headers, null, 2)});`);
  },
});

export default [
  setHeaders,
];
