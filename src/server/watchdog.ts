/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License");
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

// Watchdog contract:
// - run like this:
//     node watchdog.js <executable-path> <stdio> <temp-dir-count> ...temp-dirs ...args
// - when stdio === pipe:
//     inherits 0, 1, 2, 3, 4; communicates error through 2 (stderr); closes when 3 ends.
// - when stdio !== pipe:
//     inherits 0, 1, 2; communicates error through 2 (stderr); closes when 0 ends.
// - watchdog guarantees that once the input stream ends, it will shutdown the browser
//   and self-exit, no longer than after 30 seconds (if browser misbehaves).

// Disable signals - watchdog will self-destruct on input stream end.
const doNothing = () => {};
process.on('SIGINT', doNothing);
process.on('SIGTERM', doNothing);

import * as childProcess from 'child_process';
import * as fs from 'fs';
import * as removeFolder from 'rimraf';

const [,, executable, stdio, tempDirCount, ...rest] = process.argv;
const tempDirs = rest.slice(0, +tempDirCount);
const args = rest.slice(+tempDirCount);

const cleanup = () => {
  try {
    for (const dir of tempDirs)
      removeFolder.sync(dir);
  } catch (e) {
  }
};

const stdioParam: ('inherit' | 'pipe')[] = stdio === 'pipe' ? ['inherit', 'inherit', 'inherit', 'pipe', 'inherit'] : ['pipe', 'inherit', 'inherit'];
const spawnedProcess = childProcess.spawn(
    executable,
    args,
    {
      // On non-windows platforms, `detached: true` makes child process a leader of a new
      // process group, making it possible to kill child process tree with `.kill(-pid)` command.
      // @see https://nodejs.org/api/child_process.html#child_process_options_detached
      detached: process.platform !== 'win32',
      stdio: stdioParam,
    }
);
// Prevent unhandled 'error' event.
spawnedProcess.on('error', () => {});

if (!spawnedProcess.pid) {
  spawnedProcess.once('error', error => {
    cleanup();
    process.stderr.write(String(error.message));
    process.exit(1);
  });
}
process.stdout.write(`browser pid: ${spawnedProcess.pid}\n`);

let timerId: NodeJS.Timeout | undefined;
spawnedProcess.on('exit', (exitCode, signal) => {
  // Do not unnecessary wait for 30 seconds after the browser did exit.
  if (timerId)
    clearTimeout(timerId);
  cleanup();

  // Exit with the same exit code.
  if (exitCode !== null)
    process.exit(exitCode);

  // Here we mimic the signal of the browser process: removing our signal handlers
  // and sending the signal to our own process, so that default handler does the magic.
  process.removeListener('SIGINT' as any, doNothing);
  process.removeListener('SIGTERM' as any, doNothing);
  process.kill(process.pid, signal!);
});

const inputStream = stdio === 'pipe' ? fs.createReadStream('', {fd: 3}) : process.stdin;
const outputStream = stdio === 'pipe' ? (spawnedProcess.stdio as any)[3] as NodeJS.WritableStream : spawnedProcess.stdin;
inputStream.pipe(outputStream);
inputStream.on('close', () => {
  // Signal to the browser to close.
  outputStream.end();

  // And force kill it after 30 seconds.
  timerId = setTimeout(() => {
    if (spawnedProcess.pid && !spawnedProcess.killed) {
      try {
        if (process.platform === 'win32')
          childProcess.execSync(`taskkill /pid ${spawnedProcess.pid} /T /F`);
        else
          process.kill(-spawnedProcess.pid, 'SIGKILL');
      } catch (e) {
        // the process might have already stopped
      }
    }
    cleanup();
    process.exit(0);
  }, 30000);
});
