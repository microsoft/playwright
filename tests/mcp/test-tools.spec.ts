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

import fs from 'fs';

test.use({ mcpServerType: 'test-mcp' });

test('test_list', async ({ startClient }) => {
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
    name: 'test_list',
    arguments: {},
  })).toHaveTextResponse(`Listing tests:
  [id=<ID>] [project=foo] › a.test.ts:3:11 › example1
  [id=<ID>] [project=foo] › a.test.ts:6:11 › example2
  [id=<ID>] a.test.ts:3:11 › example1
  [id=<ID>] a.test.ts:6:11 › example2
Total: 4 tests in 1 file
`);
});

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

  2 passed (XXms)
`);
});

test('test_debug (passed)', async ({ startClient }) => {
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
    name: 'test_list',
  });
  const [, id] = listResult.content[0].text.match(/\[id=([^\]]+)\]/);

  expect(await client.callTool({
    name: 'test_debug',
    arguments: {
      test: { id, title: 'pass' },
    },
  })).toHaveTextResponse(`
Running 1 test using 1 worker

  ok 1 a.test.ts:3:11 › pass (XXms)

  1 passed (XXms)
`);
});

test('test_debug (pause/resume)', async ({ startClient }) => {
  const { client, id } = await prepareDebugTest(startClient);

  expect(await client.callTool({
    name: 'test_debug',
    arguments: {
      test: { id, title: 'fail' },
    },
  })).toHaveTextResponse(`### Paused on error:
expect(locator).toBeVisible() failed

Locator: getByRole('button', { name: 'Missing' })
Expected: visible
Timeout: 1000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 1000ms
  - waiting for getByRole('button', { name: 'Missing' })


### Current page snapshot:
- button "Submit" [ref=e2]

### Task
Try recovering from the error prior to continuing`);

  expect(await client.callTool({
    name: 'test_run',
    arguments: {
      locations: ['a.test.ts'],
    },
  })).toHaveTextResponse(expect.stringContaining(`1) [id=<ID>] a.test.ts:3:11 › fail`));
});

test('test_debug / browser_snapshot', async ({ startClient }) => {
  const { client, id } = await prepareDebugTest(startClient);
  await client.callTool({
    name: 'test_debug',
    arguments: {
      test: { id, title: 'fail' },
    },
  });
  expect(await client.callTool({
    name: 'browser_snapshot',
  })).toHaveResponse({
    pageState: expect.stringContaining(`- button \"Submit\" [ref=e2]`),
  });
});

test('test_debug_test (pause/snapshot/resume)', async ({ startClient }) => {
  const { client, id } = await prepareDebugTest(startClient);

  expect(await client.callTool({
    name: 'test_debug',
    arguments: {
      test: { id, title: 'fail' },
    },
  })).toHaveTextResponse(`### Paused on error:
expect(locator).toBeVisible() failed

Locator: getByRole('button', { name: 'Missing' })
Expected: visible
Timeout: 1000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 1000ms
  - waiting for getByRole('button', { name: 'Missing' })


### Current page snapshot:
- button "Submit" [ref=e2]

### Task
Try recovering from the error prior to continuing`);

  expect(await client.callTool({
    name: 'browser_snapshot',
  })).toHaveResponse({
    pageState: expect.stringContaining(`- button \"Submit\" [ref=e2]`),
  });

  expect(await client.callTool({
    name: 'test_run',
    arguments: {
      locations: ['a.test.ts'],
    },
  })).toHaveTextResponse(expect.stringContaining(`1) [id=<ID>] a.test.ts:3:11 › fail`));
});

test('test_debug / evaluate', async ({ startClient }) => {
  const { client, id } = await prepareDebugTest(startClient);
  await client.callTool({
    name: 'test_debug',
    arguments: {
      test: { id, title: 'fail' },
    },
  });
  expect(await client.callTool({
    name: 'browser_evaluate',
    arguments: {
      function: '() => 21+21',
    },
  })).toHaveResponse({
    result: `42`,
  });
});

test('test_debug / evaluate (with element)', async ({ startClient }) => {
  const { client, id } = await prepareDebugTest(startClient);
  await client.callTool({
    name: 'test_debug',
    arguments: {
      test: { id, title: 'fail' },
    },
  });
  expect(await client.callTool({
    name: 'browser_evaluate',
    arguments: {
      function: 'element => element.textContent',
      element: 'button',
      ref: 'e2',
    },
  })).toHaveResponse({
    result: `"Submit"`,
  });
});

test('test_debug / generate_locator', async ({ startClient }) => {
  const { client, id } = await prepareDebugTest(startClient);
  await client.callTool({
    name: 'test_debug',
    arguments: {
      test: { id, title: 'fail' },
    },
  });
  expect(await client.callTool({
    name: 'browser_generate_locator',
    arguments: {
      element: 'button',
      ref: 'e2',
    },
  })).toHaveResponse({
    result: `getByRole('button', { name: 'Submit' })`,
  });
});

test('test_setup_page', async ({ startClient }) => {
  await writeFiles({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test.beforeEach(async ({ page }) => {
        await page.setContent('<button>Submit</button>');
      });
      test('template', async ({ page }) => {
      });
    `,
  });

  const { client } = await startClient();
  expect(await client.callTool({
    name: 'test_setup_page',
    arguments: {
      testLocation: 'a.test.ts:6',
    },
  })).toHaveTextResponse(`### Paused at end of test. ready for interaction

### Current page snapshot:
- button "Submit" [ref=e2]`);

  expect(await client.callTool({
    name: 'browser_click',
    arguments: {
      element: 'Submit button',
      ref: 'e2',
    },
  })).toHaveResponse({
    code: `await page.getByRole('button', { name: 'Submit' }).click();`,
    pageState: expect.stringContaining(`- button "Submit"`),
  });
});

test('test_setup_page (no test location)', async ({ startClient }) => {
  const { client } = await startClient();
  expect(await client.callTool({
    name: 'test_setup_page',
    arguments: {},
  })).toHaveTextResponse(`### Paused at end of test. ready for interaction

### Current page snapshot:
`);
});

test('test_setup_page without location respects testsDir', async ({ startClient }) => {
  await writeFiles({
    'playwright.config.ts': `
      module.exports = {
        testDir: './tests',
        projects: [{ name: 'foo' }]
      };
    `,

    'tests/a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('existing', async ({ page }) => {
      });
    `,
  });

  const { client } = await startClient();
  expect(await client.callTool({
    name: 'test_setup_page',
    arguments: {},
  })).toHaveTextResponse(`### Paused at end of test. ready for interaction

### Current page snapshot:
`);
  expect(fs.existsSync(test.info().outputPath('tests', '.template.spec.ts'))).toBe(true);
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
    name: 'test_list',
  });
  const [, id] = listResult.content[0].text.match(/\[id=([^\]]+)\]/);
  return { client, id };
}
