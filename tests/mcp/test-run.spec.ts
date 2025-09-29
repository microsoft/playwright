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

test('test_run', async ({ startClient }) => {
  await writeFiles({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('passes', () => {});
      test('fails', () => { expect(1).toBe(2); });
      test.describe('suite', () => {
        test('inner passes', () => {});
        test('inner fails', () => { expect(1).toBe(2); });
      });
    `,
    'b.test.ts': `
      import { test, expect } from '@playwright/test';
      test('passes', () => {});
      test('fails', () => { expect(1).toBe(2); });
    `,
    'c.test.ts': `
      import { test, expect } from '@playwright/test';
      test('passes', () => {});
      test.skip('skipped', () => {});
    `,
  });

  const { client } = await startClient();
  const response = await client.callTool({
    name: 'test_run',
  });

  const text = response.content[0].text;

  expect(text).toContain(`3 failed`);
  expect(text).toContain(`1 skipped`);
  expect(text).toContain(`4 passed`);

  expect(text).toContain(`a.test.ts:3:11 › passes`);
  expect(text).toContain(`c.test.ts:3:11 › passes`);
  expect(text).toContain(`c.test.ts:4:12 › skipped`);
  expect(text).toContain(`b.test.ts:3:11 › passes`);
  expect(text).toContain(`a.test.ts:4:11 › fails`);
  expect(text).toContain(`b.test.ts:4:11 › fails`);
  expect(text).toContain(`a.test.ts:6:13 › suite › inner passes`);
  expect(text).toContain(`a.test.ts:7:13 › suite › inner fails`);

  expect(text).not.toContain(`../../test-results`);
});

test('test_run for a failed tests is not an error', async ({ startClient }) => {
  await writeFiles({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('fails', () => { expect(1).toBe(2); });
    `,
  });

  const { client } = await startClient();
  const response = await client.callTool({
    name: 'test_run',
  });

  const text = response.content[0].text;
  // The tool run has succeeded, even though the test has failed.
  expect(response.isError).toBeFalsy();

  expect(text).toContain(`1 failed`);
});

test('test_run filters', async ({ startClient }) => {
  await writeFiles({
    'playwright.config.ts': `
      module.exports = { projects: [{ name: 'foo' }, { name: 'bar' }] };
    `,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('example1', async ({}) => {
        expect(1 + 1).toBe(2);
      });
      test('example2', async ({}) => {
        expect(1 + 1).toBe(2);
      });
    `,
    'b.test.ts': `
      import { test, expect } from '@playwright/test';
      test('example1', async ({}) => {
        expect(1 + 1).toBe(2);
      });
      test('example2', async ({}) => {
        expect(1 + 1).toBe(2);
      });
    `
  });

  const { client } = await startClient();
  expect(await client.callTool({
    name: 'test_run',
    arguments: {
      locations: ['b.test.ts'],
      projects: ['foo'],
    },
  })).toHaveTextResponse(`
Running 2 tests using 1 worker
  ok 1 [id=<ID>] [project=foo] › b.test.ts:3:11 › example1 (XXms)
  ok 2 [id=<ID>] [project=foo] › b.test.ts:6:11 › example2 (XXms)
  2 passed (XXms)`);
});

test('test_run should include dependencies', async ({ startClient }) => {
  await writeFiles({
    'playwright.config.ts': `
      module.exports = {
        projects: [
          { name: 'setup', testMatch: /.*setup\\.ts/ },
          { name: 'chromium', dependencies: ['setup'] },
        ],
      };
    `,
    'auth.setup.ts': `
      import { test as setup, expect } from '@playwright/test';
      setup('auth', async ({}) => {
        expect(1 + 1).toBe(2);
      });
    `,
    'example.test.ts': `
      import { test, expect } from '@playwright/test';
      test('example1', async ({}) => {
        expect(1 + 1).toBe(2);
      });
      test('example2', async ({}) => {
        expect(1 + 1).toBe(2);
      });
    `
  });

  const { client } = await startClient();
  expect(await client.callTool({
    name: 'test_run',
    arguments: {
      locations: ['example.test.ts'],
      projects: ['chromium'],
    },
  })).toHaveTextResponse(`
Running 3 tests using 1 worker
  ok 1 [id=<ID>] [project=setup] › auth.setup.ts:3:12 › auth (XXms)
  ok 2 [id=<ID>] [project=chromium] › example.test.ts:3:11 › example1 (XXms)
  ok 3 [id=<ID>] [project=chromium] › example.test.ts:6:11 › example2 (XXms)
  3 passed (XXms)`);
});
