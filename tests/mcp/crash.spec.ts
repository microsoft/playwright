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

  test('resets to about:blank and logs the crash', async ({ client, server }) => {
    await client.callTool({
      name: 'browser_navigate',
      arguments: { url: 'chrome://crash' },
    });

    const response = parseResponse(await client.callTool({
      name: 'browser_snapshot',
    }));
    expect(response.page).toBe('- Page URL: about:blank');

    const log = await consoleEntries(response);
    expect(log).toContain('Page crashed and was reset to about:blank.');

    expect(await client.callTool({
      name: 'browser_navigate',
      arguments: { url: server.HELLO_WORLD },
    })).toHaveResponse({
      page: `- Page URL: ${server.HELLO_WORLD}\n- Page Title: Title`,
    });
  });

  test('lists only one tab', async ({ client }) => {
    await client.callTool({
      name: 'browser_navigate',
      arguments: { url: 'chrome://crash' },
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
      name: 'browser_tabs',
      arguments: { action: 'new', url: 'chrome://crash' },
    });
    await client.callTool({
      name: 'browser_tabs',
      arguments: { action: 'select', index: 0 },
    });

    expect(await client.callTool({
      name: 'browser_tabs',
      arguments: { action: 'list' },
    })).toHaveResponse({
      result: `- 0: (current) [Title](${server.HELLO_WORLD})\n- 1: [](about:blank) [crashed]`,
    });
  });
});
