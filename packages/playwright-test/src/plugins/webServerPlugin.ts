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
import type { TestPlugin, WebServerConfig } from '../types';
import { WebServer } from '../webServer';

export const webServer = (config: WebServerConfig): TestPlugin => {
  // eslint-disable-next-line no-console
  const server = new WebServer(config, { onStdOut: console.log, onStdErr: console.error });
  return {
    setup: async () => { await server.start({ setBaseURL: false }); },
    teardown: async () => server.kill(),
  };
};
