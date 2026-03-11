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

export { createClientInfo } from './cli-client/registry';
export { startCliDaemonServer } from './cli-daemon/daemon';
export { logUnhandledError } from './mcp/log';
export { setupExitWatchdog } from './mcp/watchdog';
export { toMcpTool } from './utils/mcp/tool';

export { BrowserBackend } from './backend/browserBackend';
export { parseResponse } from './backend/response';
export { Tab } from './backend/tab';
export { browserTools, filteredTools } from './backend/tools';
export { start } from './utils/mcp/server';

export type { ContextConfig } from './backend/context';
export type { CallToolRequest, CallToolResult, Tool } from './backend/tool';
export type { ClientInfo } from './utils/mcp/server';
export type { FullConfig } from './mcp/config';
export type { ServerBackend } from './utils/mcp/server';
export type { ToolSchema } from './utils/mcp/tool';
export type { ServerBackendFactory } from './utils/mcp/server';
export { createConnection } from './mcp/index';
