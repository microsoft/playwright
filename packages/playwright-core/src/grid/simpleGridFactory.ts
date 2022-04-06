/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License");
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

import child_process from 'child_process';
import type { GridAgentLaunchOptions, GridFactory } from './gridServer';
import path from 'path';

const simpleFactory: GridFactory = {
  name: 'Agents co-located with grid',
  capacity: Infinity,
  launchTimeout: 10000,
  retireTimeout: 10000,
  launch: async (options: GridAgentLaunchOptions) => {
    child_process.spawn(process.argv[0], [
      path.join(__dirname, '..', 'cli', 'cli.js'),
      'experimental-grid-agent',
      '--grid-url', options.gridURL,
      '--agent-id', options.agentId,
    ], {
      cwd: __dirname,
      shell: true,
      stdio: 'inherit',
    });
  },
};

export default simpleFactory;
