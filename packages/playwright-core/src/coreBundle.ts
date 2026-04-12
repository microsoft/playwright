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
export * as client from './client';
export * as libCli from './cli/program';
export * as libCliTestStub from './cli/programWithTestStub';
export * as inprocess from './inprocess';
export * as oop from './outofprocess';
export * as remote from './remote/playwrightServer';
export * as registry from './server/registry/index';
export * as server from './server/index';
export * as tools from './tools';
export { getUserAgent, getPlaywrightVersion } from './server/userAgent';
