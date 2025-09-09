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

import { test, expect, writeFiles, StartClient } from './fixtures';

test.use({ mcpServerType: 'test-mcp' });

test('playwright_test_list_tests', async ({ startClient }) => {
  await writeFiles({
    'playwright.config.ts': `
      module.exports = { projects: [{ name: 'foo' }, {}] };
    `,
    'a.test.ts': `
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
    name: 'playwright_test_list_tests',
    arguments: {},
  })).toHaveTextResponse(`Listing tests:
  [id=<ID>] [project=foo] › a.test.ts:3:11 › example1
  [id=<ID>] [project=foo] › a.test.ts:6:11 › example2
  [id=<ID>] a.test.ts:3:11 › example1
  [id=<ID>] a.test.ts:6:11 › example2
Total: 4 tests in 1 file
`);
});

test('playwright_test_run_tests', async ({ startClient }) => {
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
    name: 'playwright_test_run_tests',
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

test('playwright_test_run_tests filters', async ({ startClient }) => {
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
    name: 'playwright_test_run_tests',
    arguments: {
      locations: ['b.test.ts'],
      projects: ['foo'],
    },
  })).toHaveTextResponse(`
Running 2 tests using 1 worker

  ok 1 [id=<ID>] [project=foo] › b.test.ts:3:11 › example1 (XXms)
  ok 2 [id=<ID>] [project=foo] › b.test.ts:6:11 › example2 (XXms)

  2 passed (XXms)
`);
});

test('playwright_test_debug_test (passed)', async ({ startClient }) => {
  await writeFiles({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('pass', async ({}) => {
        expect(1 + 1).toBe(2);
      });
    `
  });

  const { client } = await startClient();
  const listResult = await client.callTool({
    name: 'playwright_test_list_tests',
  });
  const [, id] = listResult.content[0].text.match(/\[id=([^\]]+)\]/);

  expect(await client.callTool({
    name: 'playwright_test_debug_test',
    arguments: {
      test: { id, title: 'pass' },
    },
  })).toHaveTextResponse(`
Running 1 test using 1 worker

  ok 1 a.test.ts:3:11 › pass (XXms)

  1 passed (XXms)
`);
});

test('playwright_test_debug_test (pause/resume)', async ({ startClient }) => {
  const { client, id } = await prepareDebugTest(startClient);

  expect(await client.callTool({
    name: 'playwright_test_debug_test',
    arguments: {
      test: { id, title: 'fail' },
    },
  })).toHaveTextResponse(`### Paused on error:
expect(locator).toBeVisible() failed

Locator:  getByRole('button', { name: 'Missing' })
Expected: visible
Error: element(s) not found
Timeout:  1000ms

Call log:
  - Expect "toBeVisible" with timeout 1000ms
  - waiting for getByRole('button', { name: 'Missing' })


### Current page snapshot:
- button "Submit" [ref=e2]

### Task
Try recovering from the error prior to continuing, use following tools to recover: playwright_test_browser_snapshot, playwright_test_generate_locator, playwright_test_evaluate_on_pause`);

  expect(await client.callTool({
    name: 'playwright_test_run_tests',
    arguments: {
      locations: ['a.test.ts'],
    },
  })).toHaveTextResponse(expect.stringContaining(`1) [id=<ID>] a.test.ts:3:11 › fail`));
});

test('playwright_test_browser_snapshot', async ({ startClient }) => {
  const { client, id } = await prepareDebugTest(startClient);
  await client.callTool({
    name: 'playwright_test_debug_test',
    arguments: {
      test: { id, title: 'fail' },
    },
  });
  expect(await client.callTool({
    name: 'playwright_test_browser_snapshot',
  })).toHaveTextResponse(`- button \"Submit\" [ref=e2]`);
});

test('playwright_test_evaluate_on_pause', async ({ startClient }) => {
  const { client, id } = await prepareDebugTest(startClient);
  await client.callTool({
    name: 'playwright_test_debug_test',
    arguments: {
      test: { id, title: 'fail' },
    },
  });
  expect(await client.callTool({
    name: 'playwright_test_evaluate_on_pause',
    arguments: {
      function: '() => 21+21',
    },
  })).toHaveTextResponse(`42`);
});

test('playwright_test_evaluate_on_pause (with element)', async ({ startClient }) => {
  const { client, id } = await prepareDebugTest(startClient);
  await client.callTool({
    name: 'playwright_test_debug_test',
    arguments: {
      test: { id, title: 'fail' },
    },
  });
  expect(await client.callTool({
    name: 'playwright_test_evaluate_on_pause',
    arguments: {
      function: 'element => element.textContent',
      element: 'button',
      ref: 'e2',
    },
  })).toHaveTextResponse(`"Submit"`);
});

test('playwright_test_generate_locator', async ({ startClient }) => {
  const { client, id } = await prepareDebugTest(startClient);
  await client.callTool({
    name: 'playwright_test_debug_test',
    arguments: {
      test: { id, title: 'fail' },
    },
  });
  expect(await client.callTool({
    name: 'playwright_test_generate_locator',
    arguments: {
      element: 'button',
      ref: 'e2',
    },
  })).toHaveTextResponse(`getByRole('button', { name: 'Submit' })`);
});

async function prepareDebugTest(startClient: StartClient) {
  await writeFiles({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('fail', async ({ page }) => {
        await page.setContent('<button>Submit</button>');
        await expect(page.getByRole('button', { name: 'Missing' })).toBeVisible({ timeout: 1000 });
      });
    `
  });

  const { client } = await startClient();
  const listResult = await client.callTool({
    name: 'playwright_test_list_tests',
  });
  const [, id] = listResult.content[0].text.match(/\[id=([^\]]+)\]/);
  return { client, id };
}
