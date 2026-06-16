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

import { test, expect } from './fixtures';

test('session log should record tool calls', async ({ startClient, server, mcpBrowser }, testInfo) => {
  test.skip(mcpBrowser === 'webkit');

  const { client, stderr } = await startClient({
    args: [
      '--save-session',
      '--output-dir', testInfo.outputPath('output'),
    ],
  });

  server.setContent('/', `<title>Title</title><button>Submit</button>`, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  expect(await client.callTool({
    name: 'browser_click',
    arguments: {
      element: 'Submit button',
      target: 'e2',
    },
  })).toHaveResponse({
    code: `await page.getByRole('button', { name: 'Submit' }).click();`,
  });

  const output = stderr().split('\n').filter(line => line.startsWith('Session: '))[0];
  const sessionFolder = output.substring('Session: '.length);
  await expect.poll(() => readSessionLog(sessionFolder)).toMatch(new RegExp(`
### Tool call: browser_navigate
- Args
\\\`\\\`\\\`json
\\{
  "url": "http://localhost:${server.PORT}"
\\}
\\\`\\\`\\\`
- Result
\\\`\\\`\\\`json
\\{
  "code": "await page.goto\\('http://localhost:${server.PORT}'\\);",
  "page": "- Page URL: http://localhost:${server.PORT}/\\\\n- Page Title: Title",
  "snapshot": "- button \\\\"Submit\\\\" \\[ref=e2\\]"
\\}
\\\`\\\`\\\`

### Tool call: browser_click
- Args
\\\`\\\`\\\`json
\\{
  "element": "Submit button",
  "target": "e2"
\\}
\\\`\\\`\\\`
- Result
\\\`\\\`\\\`json
\\{
  "code": "await page.getByRole\\('button', \\{ name: 'Submit' \\}\\).click\\(\\);",
  "page": "- Page URL: http://localhost:${server.PORT}/\\\\n- Page Title: Title",
  "snapshot": "- button \\\\"Submit\\\\" \\[active\\] \\[ref=e2\\]"
\\}
\\\`\\\`\\\`
`.trim()));
});

test('session log should recover after write failure', async ({ startClient, server, mcpBrowser }, testInfo) => {
  test.skip(mcpBrowser === 'webkit');

  const { client, stderr } = await startClient({
    args: [
      '--save-session',
      '--output-dir', testInfo.outputPath('output'),
    ],
  });

  server.setContent('/', `<title>Title</title><button>Submit</button>`, 'text/html');

  // First call: logs successfully.
  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  const output = stderr().split('\n').filter(line => line.startsWith('Session: '))[0];
  const sessionFolder = output.substring('Session: '.length);
  const sessionFile = path.join(sessionFolder, 'session.md');

  // Wait for the first entry to be written.
  await expect.poll(() => readSessionLog(sessionFolder)).toContain('browser_navigate');

  // Make the session file read-only so the next write fails.
  await fs.promises.chmod(sessionFile, 0o444);

  // Second call: write fails (EACCES) but the chain should recover.
  await client.callTool({
    name: 'browser_click',
    arguments: { element: 'Submit button', target: 'e2' },
  });

  // Restore write permission.
  await fs.promises.chmod(sessionFile, 0o644);

  // Third call: without the fix the chain stays rejected and this is never logged.
  await client.callTool({
    name: 'browser_click',
    arguments: { element: 'Submit button', target: 'e2' },
  });

  // Verify the third call was logged (chain recovered).
  await expect.poll(() => readSessionLog(sessionFolder)).toContain('browser_click');
});

async function readSessionLog(sessionFolder: string): Promise<string> {
  return await fs.promises.readFile(path.join(sessionFolder, 'session.md'), 'utf8').catch(() => '');
}
