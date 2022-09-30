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

import fs from 'fs';
import path from 'path';
import childProcess from 'child_process';
import { ManualPromise } from '../../utils/manualPromise';

type DownloadFileLogger = (message: string) => void;
type DownloadFileOptions = {
  progressBarName?: string,
  log?: DownloadFileLogger,
  userAgent?: string
};

/**
 * Node.js has a bug where the process can exit with 0 code even though there was an uncaught exception.
 * Thats why we execute it in a separate process and check manually if the destination file exists.
 * https://github.com/microsoft/playwright/issues/17394
 */
function downloadFileOutOfProcess(url: string, destinationPath: string, options: DownloadFileOptions = {}): Promise<{ error: Error | null }> {
  const cp = childProcess.fork(path.join(__dirname, 'oopDownloadMain.js'), [url, destinationPath, options.progressBarName || '', options.userAgent || '']);
  const promise = new ManualPromise<{ error: Error | null }>();
  cp.on('message', (message: any) => {
    if (message?.method === 'log')
      options.log?.(message.params.message);
  });
  cp.on('exit', code => {
    if (code !== 0) {
      promise.resolve({ error: new Error(`Download failure, code=${code}`) });
      return;
    }
    if (!fs.existsSync(destinationPath))
      promise.resolve({ error: new Error(`Download failure, ${destinationPath} does not exist`) });
    else
      promise.resolve({ error: null });
  });
  cp.on('error', error => {
    promise.resolve({ error });
  });
  return promise;
}

type DownloadOptions = {
  progressBarName?: string,
  retryCount?: number
  log?: DownloadFileLogger
  userAgent?: string
};

export async function download(
  urls: string | string[],
  destination: string,
  options: DownloadOptions = {}
) {
  const { progressBarName = 'file', retryCount = 3, log = () => { }, userAgent } = options;
  for (let attempt = 1; attempt <= retryCount; ++attempt) {
    log(
        `downloading ${progressBarName} - attempt #${attempt}`
    );
    if (!Array.isArray(urls))
      urls = [urls];
    const url = urls[(attempt - 1) % urls.length];

    const { error } = await downloadFileOutOfProcess(url, destination, {
      progressBarName,
      log,
      userAgent,
    });
    if (!error) {
      log(`SUCCESS downloading ${progressBarName}`);
      break;
    }
    const errorMessage = error?.message || '';
    log(`attempt #${attempt} - ERROR: ${errorMessage}`);
    if (attempt >= retryCount)
      throw error;
  }
}
