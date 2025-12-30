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

import { test, expect } from './fixtures';

test.describe('Electron support', () => {

  test.describe('Core browser tools with Electron', () => {

    test('can launch Electron app and take snapshot', async ({ client }) => {
      const response = await client.callTool({
        name: 'browser_snapshot',
        arguments: {},
      });

      expect(response).toHaveResponse({
        pageState: expect.stringContaining('Hello Electron'),
      });
    });

    test('can click elements in Electron app', async ({ client }) => {
      // First take snapshot to get element references
      await client.callTool({
        name: 'browser_snapshot',
        arguments: {},
      });

      // Click the test button
      const clickResponse = await client.callTool({
        name: 'browser_click',
        arguments: {
          element: 'Test Button',
          ref: 'e2',
        },
      });

      expect(clickResponse).not.toHaveResponse({ isError: true });
    });

    test('can take screenshot of Electron app', async ({ client }) => {
      const response = await client.callTool({
        name: 'browser_take_screenshot',
        arguments: {},
      });

      expect(response).not.toHaveResponse({ isError: true });
      // Should have an image attachment
      expect((response.content as any[]).length).toBeGreaterThan(0);
    });

    test('can type in Electron app', async ({ client }) => {
      const snapshot = await client.callTool({
        name: 'browser_snapshot',
        arguments: {},
      });

      // Find the textbox ref from the snapshot
      const pageState = snapshot.content[0].text;
      const match = pageState.match(/textbox.*?\[ref=(e\d+)\]/);
      const textboxRef = match ? match[1] : 'e5';

      const response = await client.callTool({
        name: 'browser_type',
        arguments: {
          element: 'textbox',
          ref: textboxRef,
          text: 'Hello from MCP',
        },
      });

      expect(response).not.toHaveResponse({ isError: true });
    });

  });

  test.describe('Electron-specific tools', () => {

    test('electron_evaluate executes code in main process', async ({ client }) => {
      const response = await client.callTool({
        name: 'electron_evaluate',
        arguments: {
          function: "() => require('electron').app.getName()",
        },
      });

      expect(response).not.toHaveResponse({ isError: true });
      expect(response.content[0].text).toBeDefined();
    });

    test('electron_windows lists all open windows', async ({ client }) => {
      const response = await client.callTool({
        name: 'electron_windows',
        arguments: {},
      });

      expect(response).not.toHaveResponse({ isError: true });
      const text = response.content[0].text;
      expect(text).toContain('windows');
    });

    test('electron_app_info returns application details', async ({ client }) => {
      const response = await client.callTool({
        name: 'electron_app_info',
        arguments: {},
      });

      expect(response).not.toHaveResponse({ isError: true });
      const text = response.content[0].text;
      expect(text).toContain('name');
      expect(text).toContain('paths');
    });

    test('electron_select_window switches between windows', async ({ client }) => {
      // First get list of windows
      const windowsResponse = await client.callTool({
        name: 'electron_windows',
        arguments: {},
      });
      expect(windowsResponse).not.toHaveResponse({ isError: true });

      // Select the first window (index 0)
      const selectResponse = await client.callTool({
        name: 'electron_select_window',
        arguments: { index: 0 },
      });
      expect(selectResponse).not.toHaveResponse({ isError: true });
      expect(selectResponse.content[0].text).toContain('Switched to window');
    });

    test('electron_ipc_send sends IPC messages', async ({ client }) => {
      // Need to take snapshot first to have a current tab
      await client.callTool({
        name: 'browser_snapshot',
        arguments: {},
      });

      const response = await client.callTool({
        name: 'electron_ipc_send',
        arguments: {
          channel: 'test-channel',
          args: ['hello', 'world'],
        },
      });

      expect(response).not.toHaveResponse({ isError: true });
      expect(response.content[0].text).toContain('Sent IPC message');
    });

  });

  test.describe('Error handling', () => {

    test('handles invalid electron_evaluate gracefully', async ({ client }) => {
      const response = await client.callTool({
        name: 'electron_evaluate',
        arguments: {
          function: '() => { throw new Error("Test error"); }',
        },
      });

      expect(response).toHaveResponse({ isError: true });
    });

    test('handles invalid window index', async ({ client }) => {
      const response = await client.callTool({
        name: 'electron_select_window',
        arguments: { index: 999 },
      });

      expect(response).toHaveResponse({ isError: true });
      expect(response).toHaveResponse({ result: expect.stringContaining('out of bounds') });
    });

  });

});
