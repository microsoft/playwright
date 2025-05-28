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

import * as childProcess from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { debugLogger } from '../utils/debugLogger';
import { ManualPromise } from '../../utils/isomorphic/manualPromise';
import { getUserAgent } from '../utils/userAgent';
import { progress as ProgressBar, colors } from '../../utilsBundle';
import { existsAsync } from '../utils/fileUtils';

import { browserDirectoryToMarkerFilePath } from '.';

import type { DownloadParams } from './oopDownloadBrowserMain';

export async function downloadBrowserWithProgressBar(title: string, browserDirectory: string, executablePath: string | undefined, downloadURLs: string[], downloadFileName: string, downloadSocketTimeout: number): Promise<boolean> {
  if (await existsAsync(browserDirectoryToMarkerFilePath(browserDirectory))) {
    // Already downloaded.
    debugLogger.log('install', `${title} is already downloaded.`);
    return false;
  }

  const zipPath = path.join(os.tmpdir(), downloadFileName);
  try {
    const retryCount = 5;
    for (let attempt = 1; attempt <= retryCount; ++attempt) {
      debugLogger.log('install', `downloading ${title} - attempt #${attempt}`);
      const url = downloadURLs[(attempt - 1) % downloadURLs.length];
      logPolitely(`Downloading ${title}` + colors.dim(` from ${url}`));
      const { error } = await downloadBrowserWithProgressBarOutOfProcess(title, browserDirectory, url, zipPath, executablePath, downloadSocketTimeout);
      if (!error) {
        debugLogger.log('install', `SUCCESS installing ${title}`);
        break;
      }
      if (await existsAsync(zipPath))
        await fs.promises.unlink(zipPath);
      if (await existsAsync(browserDirectory))
        await fs.promises.rmdir(browserDirectory, { recursive: true });
      const errorMessage = error?.message || '';
      debugLogger.log('install', `attempt #${attempt} - ERROR: ${errorMessage}`);
      if (attempt >= retryCount)
        throw error;
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
function downloadBrowserWithProgressBarOutOfProcess(title: string, browserDirectory: string, url: string, zipPath: string, executablePath: string | undefined, socketTimeout: number): Promise<{ error: Error | null }> {
  const cp = childProcess.fork(path.join(__dirname, 'oopDownloadBrowserMain.js'));
  const promise = new ManualPromise<{ error: Error | null }>();
  const progress = getDownloadProgress();
  cp.on('message', (message: any) => {
    if (message?.method === 'log')
      debugLogger.log('install', message.params.message);
    if (message?.method === 'progress')
      progress(message.params.done, message.params.total);
  });
  cp.on('exit', code => {
    if (code !== 0) {
      promise.resolve({ error: new Error(`Download failure, code=${code}`) });
      return;
    }
    if (!fs.existsSync(browserDirectoryToMarkerFilePath(browserDirectory)))
      promise.resolve({ error: new Error(`Download failure, ${browserDirectoryToMarkerFilePath(browserDirectory)} does not exist`) });
    else
      promise.resolve({ error: null });
  });
  cp.on('error', error => {
    promise.resolve({ error });
  });

  debugLogger.log('install', `running download:`);
  debugLogger.log('install', `-- from url: ${url}`);
  debugLogger.log('install', `-- to location: ${zipPath}`);
  const downloadParams: DownloadParams = {
    title,
    browserDirectory,
    url,
    zipPath,
    executablePath,
    socketTimeout,
    userAgent: getUserAgent(),
  };
  cp.send({ method: 'download', params: downloadParams });
  return promise;
}

export function logPolitely(toBeLogged: string) {
  const logLevel = process.env.npm_config_loglevel;
  const logLevelDisplay = ['silent', 'error', 'warn'].indexOf(logLevel || '') > -1;

  if (!logLevelDisplay)
    console.log(toBeLogged);  // eslint-disable-line no-console
}

type OnProgressCallback = (downloadedBytes: number, totalBytes: number) => void;

function getDownloadProgress(): OnProgressCallback {
  if (process.stdout.isTTY)
    return getAnimatedDownloadProgress();
  return getBasicDownloadProgress();
}

function getAnimatedDownloadProgress(): OnProgressCallback {
  let progressBar: ProgressBar;
  let lastDownloadedBytes = 0;

  return (downloadedBytes: number, totalBytes: number) => {
    if (!progressBar) {
      progressBar = new ProgressBar(
          `${toMegabytes(
              totalBytes
          )} [:bar] :percent :etas`,
          {
            complete: '=',
            incomplete: ' ',
            width: 20,
            total: totalBytes,
          }
      );
    }
    const delta = downloadedBytes - lastDownloadedBytes;
    lastDownloadedBytes = downloadedBytes;
    progressBar.tick(delta);
  };
}

function getBasicDownloadProgress(): OnProgressCallback {
  const totalRows = 10;
  const stepWidth = 8;
  let lastRow = -1;
  return (downloadedBytes: number, totalBytes: number) => {
    const percentage = downloadedBytes / totalBytes;
    const row = Math.floor(totalRows * percentage);
    if (row > lastRow) {
      lastRow = row;
      const percentageString = String(percentage * 100 | 0).padStart(3);
      // eslint-disable-next-line no-console
      console.log(`|${'■'.repeat(row * stepWidth)}${' '.repeat((totalRows - row) * stepWidth)}| ${percentageString}% of ${toMegabytes(totalBytes)}`);
    }
  };
}

function toMegabytes(bytes: number) {
  const mb = bytes / 1024 / 1024;
  return `${Math.round(mb * 10) / 10} MiB`;
}
