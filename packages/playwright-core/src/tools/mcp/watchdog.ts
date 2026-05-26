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

import { gracefullyCloseAll, gracefullyCloseSet, killSet } from '@utils/processLauncher';
import { testDebug } from './log';

const PPID_POLL_INTERVAL_MS = 2000;
const HARD_EXIT_TIMEOUT_MS = 15000;

export function setupExitWatchdog() {
  let isExiting = false;

  const forceKillSubprocesses = () => {
    for (const kill of killSet) {
      try {
        kill();
      } catch {
        // Best-effort sync kill — nothing we can do if it throws.
      }
    }
  };

  const handleExit = async (signal: string) => {
    if (isExiting)
      return;
    isExiting = true;
    testDebug(`watchdog exit (${signal}); gracefully closing ${gracefullyCloseSet.size} subprocess(es)`);
    // Hard fallback: if any graceful close hangs past HARD_EXIT_TIMEOUT_MS, force-kill
    // every spawned subprocess (chrome process groups) before exiting. The previous
    // implementation only called `process.exit(0)` on timeout, which leaves chrome
    // re-parented to PID 1 (orphaned). See microsoft/playwright-mcp#1568.
    // eslint-disable-next-line no-restricted-properties
    setTimeout(() => {
      testDebug(`watchdog forced exit; force-killing ${killSet.size} subprocess(es)`);
      forceKillSubprocesses();
      // eslint-disable-next-line no-restricted-properties
      process.exit(0);
    }, HARD_EXIT_TIMEOUT_MS);
    await gracefullyCloseAll();
    // eslint-disable-next-line no-restricted-properties
    process.exit(0);
  };

  process.stdin.on('close', () => handleExit('stdin-close'));
  process.on('SIGINT', () => handleExit('SIGINT'));
  process.on('SIGTERM', () => handleExit('SIGTERM'));
  process.on('SIGHUP', () => handleExit('SIGHUP'));

  // IPC channel close — when the MCP host spawns us with `stdio: 'ipc'` and disconnects,
  // this fires even if the stdin pipe is held alive by an intermediary (e.g. `npm exec`).
  if (process.connected)
    process.on('disconnect', () => handleExit('disconnect'));

  // PPID polling — when the parent process dies via SIGKILL, is reaped by the OS, or sits
  // behind an `npm exec` intermediary so stdin close doesn't propagate, no signal arrives
  // and stdin may stay open. The kernel re-parents us to PID 1 in that case. Poll cheaply
  // every PPID_POLL_INTERVAL_MS; on any change of parent (or PPID dropping to 1), treat as
  // parent-death and exit. Covers the stdio-via-npm-exec orphan pattern documented in
  // microsoft/playwright-mcp#1512 and the chrome orphan pattern in #1568.
  const initialPpid = process.ppid;
  const ppidTimer = setInterval(() => {
    if (process.ppid !== initialPpid || process.ppid === 1) {
      clearInterval(ppidTimer);
      handleExit(`parent-died (ppid ${initialPpid} -> ${process.ppid})`);
    }
  }, PPID_POLL_INTERVAL_MS);
  ppidTimer.unref();

  // Last-resort synchronous kill on Node's `exit` event. Async work isn't allowed here,
  // but `killSet` callbacks are synchronous SIGKILLs against subprocess groups — the
  // exact thing needed to guarantee chrome doesn't outlive us in the orphan corner cases.
  process.on('exit', forceKillSubprocesses);
}
