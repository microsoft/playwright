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

import { test, expect, retries } from './ui-mode-fixtures';

test.describe.configure({ mode: 'parallel', retries });

test.beforeAll(() => process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS = '1');
test.afterAll(() => delete process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS);

test('openai', async ({ runUITest, server }) => {
  server.setRoute('/v1/chat/completions', async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');
    if (req.method === 'OPTIONS')
      return res.end();

    expect(req.headers.authorization).toBe('Bearer fake-key');
    expect((await req.postBody).toString()).toContain(`- button \\"Submit\\"`);
    const event = {
      object: 'chat.completion.chunk',
      choices: [{ delta: { content: 'This is a mock response' } }]
    };
    res.setHeader('Content-Type', 'text/event-stream');
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  });

  const { page } = await runUITest({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('trace test', async ({ page }) => {
        await page.setContent('<button>Submit</button>');
        expect(1).toBe(2);
      });
    `,
  }, {
    OPENAI_API_KEY: 'fake-key',
    OPENAI_BASE_URL: server.PREFIX,
  });

  await page.getByTitle('Run all').click();
  await page.getByText('Errors', { exact: true }).click();
  await page.getByRole('button', { name: 'Fix with AI' }).click();
  await expect(page.getByRole('tabpanel', { name: 'Errors' })).toMatchAriaSnapshot(`
    - tabpanel "Errors":
      - paragraph: Help me with the error above. Take the page snapshot into account.
      - paragraph: This is a mock response
  `);
});

test('anthropic', async ({ runUITest }) => {
  const { page } = await runUITest({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('trace test', async ({ page }) => {
        await page.setContent('<button>Submit</button>');
        expect(1).toBe(2);
      });
    `,
  }, {
    ANTHROPIC_API_KEY: 'fake-key'
  });

  await page.context().route('https://api.anthropic.com/**', async (route, request) => {
    expect(await request.headerValue('x-api-key')).toBe('fake-key');
    expect(request.postData()).toContain(`- button \\"Submit\\"`);
    const event = {
      type: 'content_block_delta',
      delta: { text: 'This is a mock response' },
    };
    await route.fulfill({
      body: `\n\ndata: ${JSON.stringify(event)}\n\n`
    });
  });

  await page.getByTitle('Run all').click();
  await page.getByText('Errors', { exact: true }).click();
  await page.getByRole('button', { name: 'Fix with AI' }).click();
  await expect(page.getByRole('tabpanel', { name: 'Errors' })).toMatchAriaSnapshot(`
    - tabpanel "Errors":
      - paragraph: Help me with the error above. Take the page snapshot into account.
      - paragraph: This is a mock response
  `);
});
