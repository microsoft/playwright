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

import { gracefullyCloseAll, gracefullyCloseSet } from '@utils/processLauncher';
import { testDebug } from './log';

export function setupExitWatchdog() {
  let isExiting = false;
  const handleExit = async () => {
    if (isExiting)
      return;
    isExiting = true;
    // eslint-disable-next-line no-restricted-properties
    setTimeout(() => process.exit(0), 15000);
    testDebug('gracefully closing ' + gracefullyCloseSet.size);
    await gracefullyCloseAll();
    // eslint-disable-next-line no-restricted-properties
    process.exit(0);
  };

  process.stdin.on('close', handleExit);
  process.on('SIGINT', handleExit);
  process.on('SIGTERM', handleExit);

  // The host can die without delivering a signal or closing stdin (SIGKILL, OOM,
  // IDE reload), in which case we get re-parented. Poll for that to avoid leaking
  // the browser. No re-parenting on Windows.
  if (process.platform !== 'win32') {
    const parentPid = process.ppid;
    const interval = setInterval(() => {
      if (process.ppid !== parentPid)
        void handleExit();
    }, 1000);
    interval.unref();
  }
}
