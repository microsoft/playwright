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

import { test, expect } from './playwright-test-fixtures';
import fs from 'fs';
import { utils } from '../../packages/playwright-core/lib/coreBundle';

const { launchProcess } = utils;

async function launchProcessWithStdioGrandchild(pidFile: string, cleanupDir: string, waitForStdioClose: boolean) {
  fs.mkdirSync(cleanupDir, { recursive: true });
  let onExitCalls = 0;
  const script = `
    const { spawn } = require('child_process');
    const fs = require('fs');
    // This mirrors the failure mode from microsoft/playwright#41210: a helper
    // process outlives the browser process while keeping inherited stdio open.
    const child = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 30000)'], { stdio: 'inherit' });
    fs.writeFileSync(process.argv[1], String(child.pid));
    child.unref();
  `;
  const result = await launchProcess({
    command: process.execPath,
    args: ['-e', script, pidFile],
    stdio: 'pipe',
    waitForStdioClose,
    tempDirectories: [cleanupDir],
    attemptToGracefullyClose: async () => {},
    handleSIGINT: false,
    handleSIGTERM: false,
    handleSIGHUP: false,
    log: () => {},
    onExit: () => ++onExitCalls,
  });
  return { ...result, onExitCalls: () => onExitCalls };
}

function killGrandchild(pidFile: string) {
  if (!fs.existsSync(pidFile))
    return;
  const pid = +fs.readFileSync(pidFile, 'utf8');
  try {
    process.kill(pid, 'SIGKILL');
  } catch (e) {
  }
}

test('process launcher can close after parent exit when a descendant keeps stdio open', async ({}, testInfo) => {
  const pidFile = testInfo.outputPath('grandchild.pid');
  const cleanupDir = testInfo.outputPath('cleanup');
  const { gracefullyClose, onExitCalls } = await launchProcessWithStdioGrandchild(pidFile, cleanupDir, false);
  try {
    const start = Date.now();
    await gracefullyClose();
    expect(Date.now() - start).toBeLessThan(1000);
    expect(onExitCalls()).toBe(1);
    expect(fs.existsSync(cleanupDir)).toBe(false);
  } finally {
    killGrandchild(pidFile);
  }
});

test('process launcher still waits for stdio close by default', async ({}, testInfo) => {
  const pidFile = testInfo.outputPath('grandchild.pid');
  const cleanupDir = testInfo.outputPath('cleanup');
  const { gracefullyClose, onExitCalls } = await launchProcessWithStdioGrandchild(pidFile, cleanupDir, true);
  const closePromise = gracefullyClose();
  try {
    const closed = await Promise.race([
      closePromise.then(() => true),
      new Promise<boolean>(f => setTimeout(() => f(false), 1000)),
    ]);
    expect(closed).toBe(false);
  } finally {
    killGrandchild(pidFile);
    await closePromise;
    expect(onExitCalls()).toBe(1);
    expect(fs.existsSync(cleanupDir)).toBe(false);
  }
});
