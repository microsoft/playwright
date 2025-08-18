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

const bundle = require('./mcpBundleImpl');
const zodToJsonSchema: typeof import('zod-to-json-schema').zodToJsonSchema = require('./mcpBundleImpl').zodToJsonSchema;
const Client: typeof import('@modelcontextprotocol/sdk/client/index.js').Client = bundle.Client;
const Server: typeof import('@modelcontextprotocol/sdk/server/index.js').Server = bundle.Server;
const SSEServerTransport: typeof import('@modelcontextprotocol/sdk/server/sse.js').SSEServerTransport = bundle.SSEServerTransport;
const StdioServerTransport: typeof import('@modelcontextprotocol/sdk/server/stdio.js').StdioServerTransport = bundle.StdioServerTransport;
const StreamableHTTPServerTransport: typeof import('@modelcontextprotocol/sdk/server/streamableHttp.js').StreamableHTTPServerTransport = bundle.StreamableHTTPServerTransport;
const CallToolRequestSchema: typeof import('@modelcontextprotocol/sdk/types.js').CallToolRequestSchema = bundle.CallToolRequestSchema;
const ListRootsRequestSchema: typeof import('@modelcontextprotocol/sdk/types.js').ListRootsRequestSchema = bundle.ListRootsRequestSchema;
const ListToolsRequestSchema: typeof import('@modelcontextprotocol/sdk/types.js').ListToolsRequestSchema = bundle.ListToolsRequestSchema;
const PingRequestSchema: typeof import('@modelcontextprotocol/sdk/types.js').PingRequestSchema = bundle.PingRequestSchema;
const z: typeof import('zod') = bundle.z;

type ToolSchema<Input extends import('zod').Schema> = import('./tool').ToolSchema<Input>;

export {
  zodToJsonSchema,
  Client,
  Server,
  SSEServerTransport,
  StdioServerTransport,
  StreamableHTTPServerTransport,
  CallToolRequestSchema,
  ListRootsRequestSchema,
  ListToolsRequestSchema,
  PingRequestSchema,
  z,
};

export type { ToolSchema };
