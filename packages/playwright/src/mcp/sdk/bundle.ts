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

// @ts-ignore
import * as bundle from '../../mcpBundleImpl';

const zodToJsonSchema: typeof import('zod-to-json-schema').zodToJsonSchema = bundle.zodToJsonSchema;
const Client: typeof import('@modelcontextprotocol/sdk/client/index.js').Client = bundle.Client;
const Server: typeof import('@modelcontextprotocol/sdk/server/index.js').Server = bundle.Server;
const SSEServerTransport: typeof import('@modelcontextprotocol/sdk/server/sse.js').SSEServerTransport = bundle.SSEServerTransport;
const StdioClientTransport: typeof import('@modelcontextprotocol/sdk/client/stdio.js').StdioClientTransport = bundle.StdioClientTransport;
const StdioServerTransport: typeof import('@modelcontextprotocol/sdk/server/stdio.js').StdioServerTransport = bundle.StdioServerTransport;
const StreamableHTTPServerTransport: typeof import('@modelcontextprotocol/sdk/server/streamableHttp.js').StreamableHTTPServerTransport = bundle.StreamableHTTPServerTransport;
const StreamableHTTPClientTransport: typeof import('@modelcontextprotocol/sdk/client/streamableHttp.js').StreamableHTTPClientTransport = bundle.StreamableHTTPClientTransport;
const CallToolRequestSchema: typeof import('@modelcontextprotocol/sdk/types.js').CallToolRequestSchema = bundle.CallToolRequestSchema;
const ListRootsRequestSchema: typeof import('@modelcontextprotocol/sdk/types.js').ListRootsRequestSchema = bundle.ListRootsRequestSchema;
const ListToolsRequestSchema: typeof import('@modelcontextprotocol/sdk/types.js').ListToolsRequestSchema = bundle.ListToolsRequestSchema;
const PingRequestSchema: typeof import('@modelcontextprotocol/sdk/types.js').PingRequestSchema = bundle.PingRequestSchema;
const z: typeof import('zod') = bundle.z;

export {
  zodToJsonSchema,
  Client,
  Server,
  SSEServerTransport,
  StdioClientTransport,
  StdioServerTransport,
  StreamableHTTPClientTransport,
  StreamableHTTPServerTransport,
  CallToolRequestSchema,
  ListRootsRequestSchema,
  ListToolsRequestSchema,
  PingRequestSchema,
  z,
};
