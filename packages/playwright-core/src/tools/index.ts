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

export { setupExitWatchdog } from './mcp/watchdog';

export { BrowserBackend } from './backend/browserBackend';
export { parseResponse } from './backend/response';
export { Tab } from './backend/tab';
export { browserTools, filteredTools } from './backend/tools';
export { start } from './utils/mcp/server';
export { createConnection } from './mcp/index';
export { resolveCLIConfigForCLI, resolveCLIConfigForMCP } from './mcp/config';
export { isProfileLocked } from './mcp/browserFactory';
export { compareSemver } from './utils/socketConnection';
export { extractTrace, DirTraceLoaderBackend } from './trace/traceParser';
export { decorateMCPCommand } from './mcp/program';
export { program as cliProgram } from './cli-client/program';
export { generateHelp, generateHelpJSON } from './cli-daemon/helpGenerator';
export { decorateProgram as decorateCliDaemonProgram } from './cli-daemon/program';
export { openDashboardApp, startDashboardServer } from './dashboard/dashboardApp';

export type { ContextConfig } from './backend/context';
export type { CallToolRequest, CallToolResult, Tool } from './backend/tool';
export type { ClientInfo } from './utils/mcp/server';
export type { FullConfig } from './mcp/config';
export type { ServerBackend } from './utils/mcp/server';
export type { ToolSchema } from './utils/mcp/tool';
export type { ServerBackendFactory } from './utils/mcp/server';
