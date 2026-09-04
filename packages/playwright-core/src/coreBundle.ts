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

export * as iso from '@isomorphic/index';
export * as utils from '@utils/index';
export { EventEmitter as clientEventEmitter } from './client/eventEmitter';
export * as libCli from './cli/program';
export * as libCliTestStub from './cli/programWithTestStub';
export * as inprocess from './inprocess';
export * as oop from './outofprocess';
export * as remote from './remote/playwrightServer';
export * as registry from './server/registry/index';
export * as server from './server/index';
import type * as toolsModule from './tools';

// The tools (MCP server, cli client, cli daemon, dashboard) are only needed by their commands; loading them here
// would initialise all of them for every command and for `run-driver`.
let toolsInstance: typeof toolsModule | undefined;
export const tools: typeof toolsModule = new Proxy({} as typeof toolsModule, {
  get: (_, property) => {
    if (!toolsInstance)
      toolsInstance = require('./tools') as typeof toolsModule;
    return toolsInstance[property as keyof typeof toolsModule];
  },
});
export { getUserAgent, getPlaywrightVersion } from './server/userAgent';
