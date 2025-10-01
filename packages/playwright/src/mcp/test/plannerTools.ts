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

import { z } from '../sdk/bundle';
import { defineTestTool } from './testTool';

export const setupPage = defineTestTool({
  schema: {
    name: 'planner_setup_page',
    title: 'Setup planner page',
    description: 'Setup the page for test planning',
    inputSchema: z.object({
      project: z.string().optional().describe('Project to use for setup. For example: "chromium", if no project is provided uses the first project in the config.'),
      seedFile: z.string().optional().describe('A seed file contains a single test that is used to setup the page for testing, for example: "tests/seed.spec.ts". If no seed file is provided, a default seed file is created.'),
    }),
    type: 'readOnly',
  },

  handle: async (context, params, progress) => {
    const seed = await context.getOrCreateSeedFile(params.seedFile, params.project);
    await context.runSeedTest(seed.file, seed.projectName, progress);
    return { content: [] };
  },
});
