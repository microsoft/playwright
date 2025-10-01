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

import fs from 'fs';
import path from 'path';
import { test, expect, writeFiles } from './fixtures';

test.use({ mcpServerType: 'test-mcp' });

test('seed test runs in first top-level project by default', async ({ startClient }) => {
  const baseDir = await writeFiles({
    'playwright.config.ts': `
      module.exports = {
        projects: [
          { name: 'first-project', testDir: './first' },
          { name: 'second-project', testDir: './second' },
          { name: 'third-project', testDir: './third' },
        ],
      };
    `,
  });

  const { client } = await startClient();

  // Call planner_setup_page without specifying a project - should use first top-level project
  expect(await client.callTool({
    name: 'planner_setup_page',
    arguments: {},
  })).toHaveTextResponse(expect.stringContaining(`### Paused at end of test. ready for interaction`));

  // Verify seed.spec.ts was created in the first project's testDir
  expect(fs.existsSync(path.join(baseDir, 'first', 'seed.spec.ts'))).toBe(true);
  expect(fs.existsSync(path.join(baseDir, 'second', 'seed.spec.ts'))).toBe(false);
  expect(fs.existsSync(path.join(baseDir, 'third', 'seed.spec.ts'))).toBe(false);
});

test('seed test runs in first top-level project with dependencies', async ({ startClient }) => {
  const baseDir = await writeFiles({
    'playwright.config.ts': `
      module.exports = {
        projects: [
          { name: 'setup', testDir: './setup', testMatch: /.*setup\\.ts/ },
          { name: 'first-top-level', testDir: './first', dependencies: ['setup'] },
          { name: 'second-top-level', testDir: './second', dependencies: ['setup'] },
          { name: 'third-top-level', testDir: './third' },
        ],
      };
    `,
  });

  const { client } = await startClient();

  // Call planner_setup_page without specifying a project
  // Should use the first top-level project (first-top-level, not setup which is a dependency)
  expect(await client.callTool({
    name: 'planner_setup_page',
    arguments: {},
  })).toHaveTextResponse(expect.stringContaining(`### Paused at end of test. ready for interaction`));

  // Verify seed.spec.ts was created in the first top-level project's testDir
  expect(fs.existsSync(path.join(baseDir, 'setup', 'seed.spec.ts'))).toBe(false);
  expect(fs.existsSync(path.join(baseDir, 'first', 'seed.spec.ts'))).toBe(true);
  expect(fs.existsSync(path.join(baseDir, 'second', 'seed.spec.ts'))).toBe(false);
  expect(fs.existsSync(path.join(baseDir, 'third', 'seed.spec.ts'))).toBe(false);
});

test('generator_setup_page uses first top-level project by default', async ({ startClient }) => {
  const baseDir = await writeFiles({
    'playwright.config.ts': `
      module.exports = {
        projects: [
          { name: 'alpha', testDir: './alpha' },
          { name: 'beta', testDir: './beta', dependencies: ['alpha'] },
          { name: 'gamma', testDir: './gamma' },
        ],
      };
    `,
  });

  const { client } = await startClient();

  // Call generator_setup_page without specifying a project - should use first top-level project
  expect(await client.callTool({
    name: 'generator_setup_page',
    arguments: {
      plan: 'Test plan for verification',
    },
  })).toHaveTextResponse(expect.stringContaining(`### Paused at end of test. ready for interaction`));

  // Verify seed.spec.ts was created in the first project's testDir
  expect(fs.existsSync(path.join(baseDir, 'alpha', 'seed.spec.ts'))).toBe(false);
  expect(fs.existsSync(path.join(baseDir, 'beta', 'seed.spec.ts'))).toBe(true);
  expect(fs.existsSync(path.join(baseDir, 'gamma', 'seed.spec.ts'))).toBe(false);
});
