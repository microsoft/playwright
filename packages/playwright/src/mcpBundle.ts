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

const InProcessTransport: typeof import('../bundles/mcp/src/mcpBundleImpl').InProcessTransport = require('./mcpBundleImpl').InProcessTransport;
const ProxyBackend: typeof import('../bundles/mcp/src/mcpBundleImpl').ProxyBackend = require('./mcpBundleImpl').ProxyBackend;
const createServer: typeof import('../bundles/mcp/src/mcpBundleImpl').createServer = require('./mcpBundleImpl').createServer;
const connect: typeof import('../bundles/mcp/src/mcpBundleImpl').connect = require('./mcpBundleImpl').connect;
const toMcpTool: typeof import('../bundles/mcp/src/mcpBundleImpl').toMcpTool = require('./mcpBundleImpl').toMcpTool;
const start: typeof import('../bundles/mcp/src/mcpBundleImpl').start = require('./mcpBundleImpl').start;

export type { Tool, CallToolRequest, CallToolResult, ServerBackend } from '../bundles/mcp/src/server';
export type { ToolSchemaBase } from '../bundles/mcp/src/tool';

export {
  InProcessTransport,
  ProxyBackend,
  start,
  createServer,
  connect,
  toMcpTool,
};
