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

import { chromium } from 'playwright';

import { test, expect } from './fixtures';
import { isProfileLocked } from '../../packages/playwright/lib/mcp/browser/browserContextFactory';

test('isProfileLocked returns false for empty directory', async ({ mcpBrowser }, testInfo) => {
  test.skip(!['chromium', 'chrome', 'msedge'].includes(mcpBrowser!), 'Chromium-only');
  const dir = testInfo.outputPath('profile');
  expect(isProfileLocked(dir)).toBe(false);
});

test('isProfileLocked detects a real browser holding the profile', async ({ mcpBrowser }, testInfo) => {
  test.skip(!['chromium', 'chrome', 'msedge'].includes(mcpBrowser!), 'Chromium-only');
  const userDataDir = testInfo.outputPath('user-data-dir');
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: mcpBrowser === 'chromium' ? undefined : mcpBrowser,
    headless: true,
  });
  try {
    expect(isProfileLocked(userDataDir)).toBe(true);
  } finally {
    await context.close();
  }
});

test('isProfileLocked returns false after browser closes', async ({ mcpBrowser }, testInfo) => {
  test.skip(!['chromium', 'chrome', 'msedge'].includes(mcpBrowser!), 'Chromium-only');
  const userDataDir = testInfo.outputPath('user-data-dir');
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: mcpBrowser === 'chromium' ? undefined : mcpBrowser,
    headless: true,
  });
  await context.close();
  expect(isProfileLocked(userDataDir)).toBe(false);
});

test('locked profile produces actionable error on navigate', async ({ mcpBrowser, startClient, server }, testInfo) => {
  test.skip(!['chromium', 'chrome', 'msedge'].includes(mcpBrowser!), 'Chromium-only');
  const userDataDir = testInfo.outputPath('user-data-dir');
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: mcpBrowser,
    headless: true,
  });
  try {
    const { client } = await startClient({
      args: [`--user-data-dir=${userDataDir}`],
    });
    const result = await client.callTool({
      name: 'browser_navigate',
      arguments: { url: server.HELLO_WORLD },
    });
    expect(result).toHaveResponse({
      isError: true,
      error: expect.stringContaining('already in use'),
    });
  } finally {
    await context.close();
  }
});

test('stale profile does not prevent browser launch', async ({ mcpBrowser, startClient, server }, testInfo) => {
  test.skip(!['chromium', 'chrome', 'msedge'].includes(mcpBrowser!), 'Chromium-only');
  const userDataDir = testInfo.outputPath('user-data-dir');
  // Launch and close a browser to leave behind a stale user data dir.
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: mcpBrowser,
    headless: true,
  });
  await context.close();

  const { client } = await startClient({
    args: [`--user-data-dir=${userDataDir}`],
  });
  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  })).toHaveResponse({
    snapshot: expect.stringContaining('Hello, world!'),
  });
});
