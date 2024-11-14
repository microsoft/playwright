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

export type { Executable } from './registry';
export {
  registry,
  registryDirectory,
  Registry,
  installBrowsersForNpmInstall,
  writeDockerVersion } from './registry';

export { DispatcherConnection, RootDispatcher } from './dispatchers/dispatcher';
export { PlaywrightDispatcher } from './dispatchers/playwrightDispatcher';
export { createPlaywright } from './playwright';

export type { DispatcherScope } from './dispatchers/dispatcher';
export type { Playwright } from './playwright';
export { openTraceInBrowser, openTraceViewerApp, runTraceViewerApp, startTraceViewerServer, installRootRedirect } from './trace/viewer/traceViewer';
export { serverSideCallMetadata } from './instrumentation';
export { SocksProxy } from '../common/socksProxy';
