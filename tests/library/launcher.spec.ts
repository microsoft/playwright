/**
 * Copyright 2017 Google Inc. All rights reserved.
 * Modifications copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { launchProcess } from '@utils/processLauncher';
import { inheritAndCleanEnv } from '../config/utils';
import { playwrightTest as it, expect } from '../config/browserTest';

it('should have an errors object', async ({ playwright }) => {
  expect(String(playwright.errors.TimeoutError)).toContain('TimeoutError');
});

it('should have a devices object', async ({ playwright }) => {
  expect(playwright.devices['iPhone 6']).toBeTruthy();
  expect(playwright.devices['iPhone 6'].defaultBrowserType).toBe('webkit');
});

it('should kill browser process on timeout after close', async ({ browserType, mode }) => {
  it.skip(mode !== 'default', 'Test passes server hooks via options');

  const launchOptions: any = {};
  let stalled = false;
  launchOptions.__testHookGracefullyClose = () => {
    stalled = true;
    return new Promise(() => {});
  };
  launchOptions.__testHookBrowserCloseTimeout = 1_000;
  const browser = await browserType.launch(launchOptions);
  await browser.close();
  expect(stalled).toBeTruthy();
});

it('should resolve close on process exit even if a child keeps stdio open', async ({ mode }) => {
  it.skip(mode !== 'default', 'Exercises @utils/processLauncher directly; no browser needed');

  // Regression: msedge spawns EdgeUpdater, which inherits the browser's stdio pipe
  // and outlives it. The process 'close' event (stdio EOF) is then delayed until
  // EdgeUpdater exits, which used to block close() for ~20s. Model that with a fake
  // "browser" that backgrounds a grandchild inheriting stdio for a few seconds, then
  // exits on graceful close. close() must resolve on the process 'exit' event rather
  // than wait for the lingering grandchild to release the pipe.
  const grandchildLifetimeMs = 5_000;
  const script = [
    `const cp = require('child_process');`,
    // Detached grandchild in its own process group (like msedge's EdgeUpdater): it
    // inherits this process's stdio pipe and outlives it, and is not taken down by a
    // process-group kill of the parent.
    `const g = cp.spawn(process.execPath, ['-e', 'setTimeout(() => {}, ${grandchildLifetimeMs})'], { stdio: ['ignore', 'inherit', 'inherit'], detached: true });`,
    `g.unref();`,
    `process.on('SIGTERM', () => process.exit(0));`,
    // Signal readiness only after the grandchild holds the pipe and the SIGTERM
    // handler is installed, so close() runs against a fully-started process.
    `console.log('READY_FOR_CLOSE');`,
    `setInterval(() => {}, 1000);`,
  ].join('\n');

  let onReady = () => {};
  const ready = new Promise<void>(f => onReady = f);
  const result = await launchProcess({
    command: process.execPath,
    args: ['-e', script],
    stdio: 'pipe',
    tempDirectories: [],
    attemptToGracefullyClose: async () => void result.launchedProcess.kill('SIGTERM'),
    onExit: () => {},
    log: message => {
      if (message.includes('[out] READY_FOR_CLOSE'))
        onReady();
    },
  });
  await ready;

  const start = Date.now();
  await result.gracefullyClose();
  const elapsed = Date.now() - start;

  // With the fix, close resolves on 'exit' (~tens of ms). Without it, it waits for
  // the grandchild to release the inherited pipe (~grandchildLifetimeMs).
  expect(elapsed).toBeLessThan(grandchildLifetimeMs - 1_000);
});

it('should throw a friendly error if its headed and there is no xserver on linux running', async ({ mode, browserType, platform, channel }) => {
  it.skip(platform !== 'linux');
  it.skip(mode.startsWith('service'));
  it.skip(channel === 'chromium-headless-shell', 'shell is never headed');
  it.skip(channel === 'chromium-tip-of-tree-headless-shell', 'shell is never headed');

  const error: Error = await browserType.launch({
    headless: false,
    env: inheritAndCleanEnv({ DISPLAY: undefined }),
  }).catch(e => e);
  expect(error).toBeInstanceOf(Error);
  expect(error.message).toMatch(/Looks like you launched a headed browser without having a XServer running./);
  expect(error.message).toMatch(/xvfb-run/);
});
