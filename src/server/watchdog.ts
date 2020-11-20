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
// - Run like this:
//     node watchdog.js <executable-path> <close-method> <temp-dir-count> ...temp-dirs ...args
// - When close-method === none:
//     inherits 0, 1, 2; communicates error through 2 (stderr); closes when 0 ends.
// - When close-method !== none:
//     inherits 0, 1, 2, 3, 4; communicates error through 2 (stderr); closes when 3 ends.
//     uses 'close-method' as a method to close the browser.
// - Watchdog guarantees that once the input stream ends, it will shutdown the browser,
//   remove temp directories and self-exit. If the browser fails to shutdown properly,
//   in 30 seconds it will be forecfully killed and watchdog will exit anyway.

const log = (s: string) => {
  process.stderr.write(`<watchdog> ${s}\n`);
};

// Disable signals - watchdog will self-destruct on input stream end.
const doNothing = (signal: any) => {
  log(`received ${signal}, ignoring`);
};
process.on('SIGINT', doNothing);
process.on('SIGTERM', doNothing);

process.on('uncaughtException', error => log(`unhandled exception: ${error.stack}`));
process.on('unhandledRejection', reason => log(`unhandled rejection: ${reason}`));

import * as childProcess from 'child_process';
import * as fs from 'fs';
import * as removeFolder from 'rimraf';

const [,, executable, closeMethod, tempDirCount, ...rest] = process.argv;
const tempDirs = rest.slice(0, +tempDirCount);
const args = rest.slice(+tempDirCount);

const cleanup = () => {
  for (const dir of tempDirs) {
    try {
      removeFolder.sync(dir);
    } catch (e) {
      log(`error removing ${dir}: ${e.stack}`);
    }
  }
};

const stdioParam: ('inherit' | 'pipe')[] = closeMethod === 'none' ? ['pipe', 'inherit', 'inherit'] : ['inherit', 'inherit', 'inherit', 'pipe', 'inherit'];
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
  log(`browser process did exit, cleaning up`);
  cleanup();

  inputStream.unpipe();
  outputStream.end();
  if (closeMethod !== 'none') {
    // If we do not close our file descriptors, process.exit just does not exit.
    // https://stackoverflow.com/questions/30853218/node-js-process-exit-will-not-exit-with-a-createreadstream-open
    fs.close(3, () => {});
    fs.close(4, () => {});
  }

  // Exit with the same exit code.
  if (exitCode !== null)
    process.exit(exitCode);

  // Here we mimic the signal of the browser process: removing our signal handlers
  // and sending the signal to our own process, so that default handler does the magic.
  process.removeListener('SIGINT' as any, doNothing);
  process.removeListener('SIGTERM' as any, doNothing);
  process.kill(process.pid, signal!);
});

const inputStream = closeMethod === 'none' ? process.stdin : fs.createReadStream('', {fd: 3});
const outputStream = closeMethod === 'none' ? spawnedProcess.stdin : (spawnedProcess.stdio as any)[3] as NodeJS.WritableStream;
inputStream.pipe(outputStream);

// On windows, when input stream is closed, it produces an error "EOF: end of file, read".
inputStream.on('error', () => {});
// Output stream could throw ECONNRESET when the browser exits.
outputStream.on('error', () => {});

inputStream.on('close', () => {
  // Input stream has closed - let's close the browser and exit.

  // Must unpipe before writing to the output ourselves.
  inputStream.unpipe();
  if (closeMethod !== 'none') {
    log(`pipe closed, sending ${closeMethod}`);
    try {
      outputStream.write(JSON.stringify({ method: closeMethod, params: {}, id: -9999 }));
      outputStream.write('\0');
    } catch (e) {
    }
  }
  outputStream.end();

  // Force kill the browser after 30 seconds.
  timerId = setTimeout(() => {
    log(`browser did not exit in 30 seconds, killing`);
    if (spawnedProcess.pid && !spawnedProcess.killed) {
      try {
        // We try to kill the whole process group, starting from the browser process
        // to include renderers and any other auxilary browser processes.
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
