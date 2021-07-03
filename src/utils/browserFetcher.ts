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

import extract from 'extract-zip';
import fs from 'fs';
import os from 'os';
import path from 'path';
import ProgressBar from 'progress';
import { downloadFile, existsAsync } from './utils';
import { debugLogger } from './debugLogger';

export async function downloadBrowserWithProgressBar(title: string, browserDirectory: string, executablePath: string, downloadURL: string, downloadFileName: string): Promise<boolean> {
  const progressBarName = `Playwright build of ${title}`;
  if (await existsAsync(browserDirectory)) {
    // Already downloaded.
    debugLogger.log('install', `browser ${title} is already downloaded.`);
    return false;
  }

  let progressBar: ProgressBar;
  let lastDownloadedBytes = 0;

  function progress(downloadedBytes: number, totalBytes: number) {
    if (!process.stderr.isTTY)
      return;
    if (!progressBar) {
      progressBar = new ProgressBar(`Downloading ${progressBarName} - ${toMegabytes(totalBytes)} [:bar] :percent :etas `, {
        complete: '=',
        incomplete: ' ',
        width: 20,
        total: totalBytes,
      });
    }
    const delta = downloadedBytes - lastDownloadedBytes;
    lastDownloadedBytes = downloadedBytes;
    progressBar.tick(delta);
  }

  const url = downloadURL;
  const zipPath = path.join(os.tmpdir(), downloadFileName);
  try {
    for (let attempt = 1, N = 3; attempt <= N; ++attempt) {
      debugLogger.log('install', `downloading ${progressBarName} - attempt #${attempt}`);
      const {error} = await downloadFile(url, zipPath, {progressCallback: progress, log: debugLogger.log.bind(debugLogger, 'install')});
      if (!error) {
        debugLogger.log('install', `SUCCESS downloading ${progressBarName}`);
        break;
      }
      const errorMessage = typeof error === 'object' && typeof error.message === 'string' ? error.message : '';
      debugLogger.log('install', `attempt #${attempt} - ERROR: ${errorMessage}`);
      if (attempt < N && (errorMessage.includes('ECONNRESET') || errorMessage.includes('ETIMEDOUT'))) {
        // Maximum delay is 3rd retry: 1337.5ms
        const millis = (Math.random() * 200) + (250 * Math.pow(1.5, attempt));
        debugLogger.log('install', `sleeping ${millis}ms before retry...`);
        await new Promise(c => setTimeout(c, millis));
      } else {
        throw error;
      }
    }
    debugLogger.log('install', `extracting archive`);
    debugLogger.log('install', `-- zip: ${zipPath}`);
    debugLogger.log('install', `-- location: ${browserDirectory}`);
    await extract(zipPath, { dir: browserDirectory});
    debugLogger.log('install', `fixing permissions at ${executablePath}`);
    await fs.promises.chmod(executablePath, 0o755);
  } catch (e) {
    debugLogger.log('install', `FAILED installation ${progressBarName} with error: ${e}`);
    process.exitCode = 1;
    throw e;
  } finally {
    if (await existsAsync(zipPath))
      await fs.promises.unlink(zipPath);
  }
  logPolitely(`${progressBarName} downloaded to ${browserDirectory}`);
  return true;
}

function toMegabytes(bytes: number) {
  const mb = bytes / 1024 / 1024;
  return `${Math.round(mb * 10) / 10} Mb`;
}

export function logPolitely(toBeLogged: string) {
  const logLevel = process.env.npm_config_loglevel;
  const logLevelDisplay = ['silent', 'error', 'warn'].indexOf(logLevel || '') > -1;

  if (!logLevelDisplay)
    console.log(toBeLogged);  // eslint-disable-line no-console
}
