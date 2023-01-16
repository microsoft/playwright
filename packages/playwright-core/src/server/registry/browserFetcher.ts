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

import fs from 'fs';
import os from 'os';
import path from 'path';
import childProcess from 'child_process';
import { getUserAgent } from '../../utils/userAgent';
import { existsAsync } from '../../utils/fileUtils';
import { debugLogger } from '../../common/debugLogger';
import { extract } from '../../zipBundle';
import { ManualPromise } from '../../utils/manualPromise';
import { colors } from '../../utilsBundle';

export async function downloadBrowserWithProgressBar(title: string, browserDirectory: string, executablePath: string | undefined, downloadURLs: string[], downloadFileName: string, downloadConnectionTimeout: number): Promise<boolean> {
  if (await existsAsync(browserDirectory)) {
    // Already downloaded.
    debugLogger.log('install', `${title} is already downloaded.`);
    return false;
  }

  const zipPath = path.join(os.tmpdir(), downloadFileName);
  try {
    const retryCount = 3;
    for (let attempt = 1; attempt <= retryCount; ++attempt) {
      debugLogger.log('install', `downloading ${title} - attempt #${attempt}`);
      const url = downloadURLs[(attempt - 1) % downloadURLs.length];
      logPolitely(`Downloading ${title}` + colors.dim(` from ${url}`));
      const { error } = await downloadFileOutOfProcess(url, zipPath, getUserAgent(), downloadConnectionTimeout);
      if (!error) {
        debugLogger.log('install', `SUCCESS downloading ${title}`);
        break;
      }
      const errorMessage = error?.message || '';
      debugLogger.log('install', `attempt #${attempt} - ERROR: ${errorMessage}`);
      if (attempt >= retryCount)
        throw error;
    }
    debugLogger.log('install', `extracting archive`);
    debugLogger.log('install', `-- zip: ${zipPath}`);
    debugLogger.log('install', `-- location: ${browserDirectory}`);
    await extract(zipPath, { dir: browserDirectory });
    if (executablePath) {
      debugLogger.log('install', `fixing permissions at ${executablePath}`);
      await fs.promises.chmod(executablePath, 0o755);
    }
  } catch (e) {
    debugLogger.log('install', `FAILED installation ${title} with error: ${e}`);
    process.exitCode = 1;
    throw e;
  } finally {
    if (await existsAsync(zipPath))
      await fs.promises.unlink(zipPath);
  }
  logPolitely(`${title} downloaded to ${browserDirectory}`);
  return true;
}

/**
 * Node.js has a bug where the process can exit with 0 code even though there was an uncaught exception.
 * Thats why we execute it in a separate process and check manually if the destination file exists.
 * https://github.com/microsoft/playwright/issues/17394
 */
function downloadFileOutOfProcess(url: string, destinationPath: string, userAgent: string, downloadConnectionTimeout: number): Promise<{ error: Error | null }> {
  const cp = childProcess.fork(path.join(__dirname, 'oopDownloadMain.js'), [url, destinationPath, userAgent, String(downloadConnectionTimeout)]);
  const promise = new ManualPromise<{ error: Error | null }>();
  cp.on('message', (message: any) => {
    if (message?.method === 'log')
      debugLogger.log('install', message.params.message);
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

export function logPolitely(toBeLogged: string) {
  const logLevel = process.env.npm_config_loglevel;
  const logLevelDisplay = ['silent', 'error', 'warn'].indexOf(logLevel || '') > -1;

  if (!logLevelDisplay)
    console.log(toBeLogged);  // eslint-disable-line no-console
}
