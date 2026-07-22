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

import { utils } from '../../packages/playwright-core/lib/coreBundle';
import { test, expect, parseResponse, consoleEntries } from './fixtures';

test.describe('crash recovery', () => {
  test.skip(({ mcpBrowser }) => mcpBrowser !== 'chromium' && mcpBrowser !== 'chrome', 'chrome://crash is chromium-specific');
  test.skip(utils.hostPlatform.startsWith('ubuntu24.04'), 'never dispatches the crash event');

  test.beforeEach(async ({ client, server }) => {
    await client.callTool({
      name: 'browser_navigate',
      arguments: { url: server.HELLO_WORLD },
    });
  });

  test('reports the navigation error, then resets and logs the crash', async ({ client, server }) => {
    expect(await client.callTool({
      name: 'browser_navigate',
      arguments: { url: 'chrome://crash' },
    })).toHaveResponse({
      error: expect.stringContaining('net::ERR_ABORTED'),
      isError: true,
    });

    await expect(async () => {
      const response = parseResponse(await client.callTool({
        name: 'browser_snapshot',
      }));
      expect(response.page).toBe('- Page URL: about:blank');

      const log = await consoleEntries(response);
      expect(log).toContain('Page crashed and was reset to about:blank.');
    }).toPass();

    expect(await client.callTool({
      name: 'browser_navigate',
      arguments: { url: server.HELLO_WORLD },
    })).toHaveResponse({
      page: `- Page URL: ${server.HELLO_WORLD}\n- Page Title: Title`,
    });
  });

  test('lists only one tab', async ({ client }) => {
    await client.callTool({
      name: 'browser_run_code_unsafe',
      arguments: {
        code: `async page => {
          await Promise.all([
            page.waitForEvent('crash'),
            page.goto('chrome://crash').catch(() => {}),
          ]);
        }`,
      },
    });

    expect(await client.callTool({
      name: 'browser_tabs',
      arguments: { action: 'list' },
    })).toHaveResponse({
      result: `- 0: (current) [](about:blank)`,
    });
  });

  test('marks non-current crashed tab in the tab list', async ({ client, server }) => {
    await client.callTool({
      name: 'browser_run_code_unsafe',
      arguments: {
        code: `async page => {
          const otherPage = await page.context().newPage();
          await Promise.all([
            otherPage.waitForEvent('crash'),
            otherPage.goto('chrome://crash').catch(() => {}),
          ]);
        }`,
      },
    });

    expect(await client.callTool({
      name: 'browser_tabs',
      arguments: { action: 'list' },
    })).toHaveResponse({
      result: `- 0: (current) [Title](${server.HELLO_WORLD})\n- 1: [](about:blank) [crashed]`,
    });
  });
});
