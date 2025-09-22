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
import path from 'path';

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

  2 passed (XXms)
`);
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

  3 passed (XXms)
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
Error: expect(locator).toBeVisible() failed

Locator: getByRole('button', { name: 'Missing' })
Expected: visible
Timeout: 1000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 1000ms
  - waiting for getByRole('button', { name: 'Missing' })


### Page state
- Page URL: about:blank
- Page Title:
- Page Snapshot:
\`\`\`yaml
- button "Submit" [ref=e2]
\`\`\`

### Task
Try recovering from the error prior to continuing`);

  expect(await client.callTool({
    name: 'test_run',
    arguments: {
      locations: ['a.test.ts'],
    },
  })).toHaveTextResponse(expect.stringContaining(`1) [id=<ID>] a.test.ts:3:11 › fail`));
});

test('test_debug (browser_snapshot/network/console)', async ({ startClient, server }) => {
  const { client, id } = await prepareDebugTest(startClient, `
      import { test, expect } from '@playwright/test';
      test('fail', async ({ page }) => {
        await page.goto(${JSON.stringify(server.HELLO_WORLD)});
        await page.evaluate(() => {
          console.log('hello from console');
          setTimeout(() => { throw new Error('error from page'); }, 0);
        });
        await expect(page.getByRole('button', { name: 'Missing' })).toBeVisible({ timeout: 1000 });
      });
  `);
  await client.callTool({
    name: 'test_debug',
    arguments: {
      test: { id, title: 'fail' },
    },
  });
  await expect.poll(() => client.callTool({
    name: 'browser_network_requests',
  })).toHaveResponse({
    result: expect.stringContaining(`[GET] ${server.HELLO_WORLD} => [200] OK`),
  });
  expect(await client.callTool({
    name: 'browser_console_messages',
  })).toHaveResponse({
    result: expect.stringMatching(/\[LOG\] hello from console.*\nError: error from page/),
  });
  expect(await client.callTool({
    name: 'browser_snapshot',
  })).toHaveResponse({
    pageState: expect.stringContaining(`generic [active] [ref=e1]: Hello, world!`),
  });
});

test('test_debug (multiple pages and custom errors)', async ({ startClient, server }) => {
  const { client, id } = await prepareDebugTest(startClient, `
      import { test, expect } from '@playwright/test';
      test('fail', async ({ page }) => {
        const page2 = await page.context().newPage();
        await page.goto(${JSON.stringify(server.PREFIX + '/frames/frame.html')});
        await page2.goto(${JSON.stringify(server.PREFIX + '/wrappedlink.html')});
        throw new Error('non-api error');
      });
  `);
  expect(await client.callTool({
    name: 'test_debug',
    arguments: {
      test: { id, title: 'fail' },
    },
  })).toHaveTextResponse(`### Paused on error:
Error: non-api error

### Page 1 of 2
- Page URL: ${server.PREFIX + '/frames/frame.html'}
- Page Title:
- Page Snapshot:
\`\`\`yaml
- generic [ref=e2]: Hi, I'm frame
\`\`\`

### Page 2 of 2
- Page URL: ${server.PREFIX + '/wrappedlink.html'}
- Page Title:
- Page Snapshot:
\`\`\`yaml
- link "123321" [ref=e3] [cursor=pointer]:
  - /url: "#clicked"
\`\`\`

### Task
Try recovering from the error prior to continuing`);
});

test('test_debug (pause/snapshot/resume)', async ({ startClient }) => {
  const { client, id } = await prepareDebugTest(startClient);

  expect(await client.callTool({
    name: 'test_debug',
    arguments: {
      test: { id, title: 'fail' },
    },
  })).toHaveTextResponse(`### Paused on error:
Error: expect(locator).toBeVisible() failed

Locator: getByRole('button', { name: 'Missing' })
Expected: visible
Timeout: 1000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 1000ms
  - waiting for getByRole('button', { name: 'Missing' })


### Page state
- Page URL: about:blank
- Page Title:
- Page Snapshot:
\`\`\`yaml
- button "Submit" [ref=e2]
\`\`\`

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

### Page state
- Page URL: about:blank
- Page Title:
- Page Snapshot:
\`\`\`yaml
- button "Submit" [ref=e2]
\`\`\`
`);

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

test('test_setup_page with dependencies', async ({ startClient }) => {
  const baseDir = await writeFiles({
    'playwright.config.ts': `
      module.exports = {
        projects: [
          { name: 'setup', testMatch: /.*setup\\.ts/ },
          { name: 'chromium', dependencies: ['setup'] },
          { name: 'ignored', dependencies: ['chromium'] },
        ],
      };
    `,
    'auth.setup.ts': `
      import { test as setup, expect } from '@playwright/test';
      setup('auth', async ({ page }, testInfo) => {
        require('fs').writeFileSync(testInfo.outputPath('auth.txt'), 'done');
      });
    `,
    'template.test.ts': `
      import { test, expect } from '@playwright/test';
      test('template', async ({ page }, testInfo) => {
        require('fs').writeFileSync(testInfo.outputPath('template.txt'), 'done');
      });
    `,
  });

  const { client } = await startClient();
  expect(await client.callTool({
    name: 'test_setup_page',
    arguments: {
      testLocation: 'template.test.ts:3',
      project: 'chromium',
    },
  })).toHaveTextResponse(`### Paused at end of test. ready for interaction

### Page state
- Page URL: about:blank
- Page Title:
- Page Snapshot:
\`\`\`yaml

\`\`\`
`);

  // Should pause at the target test, not in a dependency or any other stray project.
  expect(fs.existsSync(path.join(baseDir, 'test-results', 'auth.setup.ts-auth-setup', 'auth.txt'))).toBe(true);
  expect(fs.existsSync(path.join(baseDir, 'test-results', 'template-template-chromium', 'template.txt'))).toBe(true);
  expect(fs.existsSync(path.join(baseDir, 'test-results', 'template-template-ignored', 'template.txt'))).toBe(false);
});

test('test_setup_page (no test location)', async ({ startClient }) => {
  const { client } = await startClient();
  expect(await client.callTool({
    name: 'test_setup_page',
    arguments: {},
  })).toHaveTextResponse(`### Paused at end of test. ready for interaction

### Page state
- Page URL: about:blank
- Page Title:
- Page Snapshot:
\`\`\`yaml

\`\`\`
`);
});

test('test_setup_page chooses top-level project', async ({ startClient }) => {
  const baseDir = await writeFiles({
    'playwright.config.ts': `
      module.exports = {
        projects: [
          { name: 'one', testDir: './one' },
          { name: 'two', testDir: './two', dependencies: ['one'] },
        ],
      };
    `,
  });

  const { client } = await startClient();
  expect(await client.callTool({
    name: 'test_setup_page',
    arguments: {},
  })).toHaveTextResponse(`### Paused at end of test. ready for interaction

### Page state
- Page URL: about:blank
- Page Title:
- Page Snapshot:
\`\`\`yaml

\`\`\`
`);

  expect(fs.existsSync(path.join(baseDir, 'one', 'default.seed.spec.ts'))).toBe(false);
  expect(fs.existsSync(path.join(baseDir, 'two', 'default.seed.spec.ts'))).toBe(true);
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

### Page state
- Page URL: about:blank
- Page Title:
- Page Snapshot:
\`\`\`yaml

\`\`\`
`);
  expect(fs.existsSync(test.info().outputPath('tests', 'default.seed.spec.ts'))).toBe(true);
});

async function prepareDebugTest(startClient: StartClient, testFile?: string) {
  await writeFiles({
    'a.test.ts': testFile || `
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
