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

import * as mcpBundle from './bundle.js';

import type { CallToolRequest, CallToolResult } from '@modelcontextprotocol/sdk/types';

export async function callTool(mcpUrl: string, name: string, params: CallToolRequest['params']['arguments']): Promise<CallToolResult> {
  const transport = new mcpBundle.StreamableHTTPClientTransport(new URL(mcpUrl));
  const client = new mcpBundle.Client({ name: 'Internal', version: '0.0.0' });
  await client.connect(transport);
  try {
    return await client.callTool({ name, arguments: params }) as CallToolResult;
  } finally {
    await transport.terminateSession();
    await client.close();
  }
}
