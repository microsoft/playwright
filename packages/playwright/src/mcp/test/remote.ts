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

import * as mcp from '../sdk/bundle';
import { defineTool } from './tool';
import * as browserTools from '../browser/tools';

import type { CallToolResult } from '@modelcontextprotocol/sdk/types';

export const snapshot = defineRemoteTool(browserTools.snapshot.schema);
export const pickLocator = defineRemoteTool(browserTools.pickLocator.schema);
export const evaluate = defineRemoteTool(browserTools.evaluate.schema);

function defineRemoteTool(toolSchema: mcp.ToolSchema<any>) {
  return defineTool({
    schema: toolSchema,
    handle: async (context, params) => {
      if (!context.mcpUrl)
        throw new Error('You are not in the recovering mode');
      const transport = new mcp.StreamableHTTPClientTransport(new URL(context.mcpUrl));
      const client = new mcp.Client({ name: 'Internal', version: '0.0.0' });
      await client.connect(transport);
      try {
        return await client.callTool({ name: toolSchema.name, arguments: params }) as CallToolResult;
      } finally {
        await transport.terminateSession();
        await client.close();
      }
    }
  });
}
