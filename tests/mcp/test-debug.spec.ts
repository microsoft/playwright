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

import { test, expect, writeFiles, prepareDebugTest } from './fixtures';

test.use({ mcpServerType: 'test-mcp' });

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
  ok 1 [id=<ID>] a.test.ts:3:11 › pass (XXms)
  1 passed (XXms)`);
});

test('test_debug (pause/resume)', async ({ startClient }) => {
  const { client, id } = await prepareDebugTest(startClient);

  expect(await client.callTool({
    name: 'test_debug',
    arguments: {
      test: { id, title: 'fail' },
    },
  })).toHaveTextResponse(`
Running 1 test using 1 worker
### Paused on error:
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
        await page.evaluate(async () => {
          console.log('hello from console');
          await fetch('/missing');
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
    result: expect.stringContaining(`[GET] ${server.PREFIX}/missing => [404]`),
  });
  expect(await client.callTool({
    name: 'browser_console_messages',
  })).toHaveResponse({
    result: expect.stringMatching(/\[LOG\] hello from console.*\n.*404.*\nError: error from page/),
  });
  expect(await client.callTool({
    name: 'browser_snapshot',
  })).toHaveResponse({
    snapshot: expect.stringContaining(`generic [active] [ref=e1]: Hello, world!`),
  });
});

test('test_debug (multiple pages and custom error)', async ({ startClient, server }) => {
  const { client, id } = await prepareDebugTest(startClient, `
      import { test, expect } from '@playwright/test';
      test('fail', async ({ page }) => {
        const page2 = await page.context().newPage();
        await page.goto(${JSON.stringify(server.EMPTY_PAGE)});
        await page2.goto(${JSON.stringify(server.PREFIX + '/wrappedlink.html')});
        throw new Error('non-api error');
      });
  `);
  expect(await client.callTool({
    name: 'test_debug',
    arguments: {
      test: { id, title: 'fail' },
    },
  })).toHaveTextResponse(`
Running 1 test using 1 worker
### Paused on error:
Error: non-api error

### Page 1 of 2
- Page URL: ${server.EMPTY_PAGE}
- Page Title:
- Page Snapshot:
\`\`\`yaml

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
  })).toHaveTextResponse(`
Running 1 test using 1 worker
### Paused on error:
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
    snapshot: expect.stringContaining(`- button \"Submit\" [ref=e2]`),
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
      intent: 'Calculate 21+21',
    },
  })).toHaveResponse({
    result: `42`,
  });
});

test('test_debug / evaluate x 2', async ({ startClient }) => {
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
      intent: 'Calculate 21+21',
    },
  })).toHaveResponse({
    result: `42`,
  });

  expect(await client.callTool({
    name: 'test_debug',
    arguments: {
      test: { id, title: 'fail' },
    },
  })).toEqual({
    content: [
      { type: 'text', text: expect.stringContaining(`Paused on error`) },
    ],
    isError: false,
  });

  expect(await client.callTool({
    name: 'browser_evaluate',
    arguments: {
      function: '() => 21+23',
      intent: 'Calculate 21+23',
    },
  })).toHaveResponse({
    result: `44`,
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
      intent: 'Get button text',
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

test('test_debug w/ console.log in test', async ({ startClient }) => {
  const { client, id } = await prepareDebugTest(startClient, `
      import { test, expect } from '@playwright/test';
      test('fail', async ({ page }) => {
        console.log('console.log');
        console.error('console.error');
        await expect(page.getByRole('button', { name: 'Missing' })).toBeVisible({ timeout: 1000 });
      });
  `);

  expect(await client.callTool({
    name: 'test_debug',
    arguments: {
      test: { id, title: 'fail' },
    },
  })).toHaveTextResponse(expect.stringContaining(`
Running 1 test using 1 worker
console.log
[err] console.error
### Paused on error:
Error: expect(locator).toBeVisible() failed`));
});

test('test_debug w/ console_messages', async ({ startClient }) => {
  const { client, id } = await prepareDebugTest(startClient, `
      import { test, expect } from '@playwright/test';
      test('fail', async ({ page }) => {
        await page.evaluate(() => {
          console.error('console.error');
          console.log('console.log');  // Log should be ignored in the initial message.
          setTimeout(() => {
            const error = new Error('Error from page');
            error.stack = '';
            throw error;
          }, 0);
          return new Promise(f => setTimeout(f, 10));
        });
        throw new Error('failure');
      });
  `);

  expect(await client.callTool({
    name: 'test_debug',
    arguments: {
      test: { id, title: 'fail' },
    },
  })).toHaveTextResponse(expect.stringContaining(`
Running 1 test using 1 worker
### Paused on error:
Error: failure

### Page state
- Page URL: about:blank
- Page Title:
- Console Messages:
  - [ERROR] console.error @ :1
  - Error from page
- Page Snapshot:
`));

  expect(await client.callTool({
    name: 'browser_console_messages',
  })).toHaveResponse({
    result: expect.stringMatching(/\[ERROR\] console.error.*\n\[LOG] console.log/),
  });
});

test('test_debug w/ network_requests', async ({ startClient, server }) => {
  const { client, id } = await prepareDebugTest(startClient, `
      import { test, expect } from '@playwright/test';
      test('fail', async ({ page }) => {
        await page.goto(${JSON.stringify(server.HELLO_WORLD)});
        await page.evaluate(async () => {
          await fetch('missing');
        });
        await expect(page.getByRole('button', { name: 'Missing' })).toBeVisible({ timeout: 1000 });
      });
  `);

  expect(await client.callTool({
    name: 'test_debug',
    arguments: {
      test: { id, title: 'fail' },
    },
  })).toHaveTextResponse(expect.stringContaining(`
Running 1 test using 1 worker
### Paused on error:
Error: expect(locator).toBeVisible() failed`));

  expect(await client.callTool({
    name: 'browser_network_requests',
  })).toHaveResponse({
    result: `[GET\] ${server.PREFIX}/missing => [404] Not Found`,
  });
});

test('test_debug w/ route', async ({ startClient, server }) => {
  const { client, id } = await prepareDebugTest(startClient, `
      import { test, expect } from '@playwright/test';
      test('fail', async ({ page }) => {
        let counter = 0;
        await page.route('**', route => route.fulfill({ body: '<title>Title' + (++counter) + '</title><div>mocked</div>', contentType: 'text/html' }));
        await page.goto(${JSON.stringify(server.EMPTY_PAGE)});
        await expect(page.getByRole('button', { name: 'Missing' })).toBeVisible({ timeout: 1000 });
      });
  `);

  const response = await client.callTool({
    name: 'test_debug',
    arguments: {
      test: { id, title: 'fail' },
    },
  });
  expect(response).toHaveTextResponse(expect.stringContaining(`
Running 1 test using 1 worker
### Paused on error:
Error: expect(locator).toBeVisible() failed`));
  expect(response).toHaveTextResponse(expect.stringContaining(`- Page URL: ${server.EMPTY_PAGE}\n- Page Title: Title1`));

  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD, intent: 'Go to hello world' },
  })).toHaveResponse({
    page: expect.stringContaining(`- Page URL: ${server.HELLO_WORLD}\n- Page Title: Title2`),
  });
});
