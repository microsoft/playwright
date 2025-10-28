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

import { test, expect, writeFiles } from './fixtures';

test.use({ mcpServerType: 'test-mcp' });

const workspace = {
  'playwright.config.ts': `
    module.exports = {
      projects: [{ name: 'chromium' }],
      webServer: {
        command: 'node web-server.js',
        stdout: 'pipe',
        stderr: 'pipe',
        wait: { stderr: /started/ }
      },
      globalSetup: 'global-setup.ts',
      globalTeardown: 'global-teardown.ts',
    };
  `,
  'web-server.js': `
    console.log('web server started');
    console.error('web server started');
  `,
  'global-setup.ts': `
    module.exports = async () => {
      console.log('global setup');
      console.error('global setup');
    };
  `,
  'global-teardown.ts': `
    module.exports = async () => {
      console.log('global teardown');
      console.error('global teardown');
    };
  `,
  'a.test.ts': `
    import { test, expect } from '@playwright/test';
    test('test', async ({ page }) => {
      console.log('test');
      console.error('test');
    });
  `
};

test('setup should run global setup and teardown', async ({ startClient }, { workerIndex }) => {
  await writeFiles(workspace);
  const { client } = await startClient();

  // Call planner_setup_page without specifying a project - should use first top-level project
  expect(await client.callTool({
    name: 'planner_setup_page',
    arguments: {
      seedFile: 'a.test.ts',
    },
  })).toHaveTextResponse(expect.stringContaining(`[WebServer] web server started
[err] [WebServer] web server started
global setup
[err] global setup

Running 1 test using 1 worker
test
[err] test
### Paused at end of test. ready for interaction`));
});

test('test_run should run global setup and teardown', async ({ startClient }) => {
  await writeFiles(workspace);

  const { client } = await startClient();
  expect(await client.callTool({
    name: 'test_run',
    arguments: {
      locations: ['a.test.ts'],
      projects: ['chromium'],
    },
  })).toHaveTextResponse(`[WebServer] web server started
[err] [WebServer] web server started
global setup
[err] global setup

Running 1 test using 1 worker
test
[err] test
  ok 1 [id=<ID>] [project=chromium] › a.test.ts:3:9 › test (XXms)
  1 passed (XXms)
global teardown
[err] global teardown`);
});

test('test_debug should run global setup and teardown', async ({ startClient }) => {
  await writeFiles(workspace);

  const { client } = await startClient();
  const listResult = await client.callTool({
    name: 'test_list',
  });
  const [, id] = listResult.content[0].text.match(/\[id=([^\]]+)\]/);

  expect(await client.callTool({
    name: 'test_debug',
    arguments: {
      test: { id, title: 'pass' },
    },
  })).toHaveTextResponse(`[WebServer] web server started
[err] [WebServer] web server started
global setup
[err] global setup

Running 1 test using 1 worker
test
[err] test
  ok 1 [id=<ID>] [project=chromium] › a.test.ts:3:9 › test (XXms)
  1 passed (XXms)
global teardown
[err] global teardown`);
});
