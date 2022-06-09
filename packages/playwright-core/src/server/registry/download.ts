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
import { progress as ProgressBar } from '../../utilsBundle';
import { httpRequest } from '../../common/netUtils';

type OnProgressCallback = (downloadedBytes: number, totalBytes: number) => void;
type DownloadFileLogger = (message: string) => void;
type DownloadFileOptions = {
  progressCallback?: OnProgressCallback,
  log?: DownloadFileLogger,
  userAgent?: string
};

function downloadFile(url: string, destinationPath: string, options: DownloadFileOptions = {}): Promise<{ error: any }> {
  const {
    progressCallback,
    log = () => { },
  } = options;
  log(`running download:`);
  log(`-- from url: ${url}`);
  log(`-- to location: ${destinationPath}`);
  let fulfill: ({ error }: { error: any }) => void = ({ error }) => { };
  let downloadedBytes = 0;
  let totalBytes = 0;

  const promise: Promise<{ error: any }> = new Promise(x => { fulfill = x; });

  httpRequest({
    url,
    headers: options.userAgent ? {
      'User-Agent': options.userAgent,
    } : undefined,
  }, response => {
    log(`-- response status code: ${response.statusCode}`);
    if (response.statusCode !== 200) {
      const error = new Error(`Download failed: server returned code ${response.statusCode}. URL: ${url}`);
      // consume response data to free up memory
      response.resume();
      fulfill({ error });
      return;
    }
    const file = fs.createWriteStream(destinationPath);
    file.on('finish', () => fulfill({ error: null }));
    file.on('error', error => fulfill({ error }));
    response.pipe(file);
    totalBytes = parseInt(response.headers['content-length'] || '0', 10);
    log(`-- total bytes: ${totalBytes}`);
    if (progressCallback)
      response.on('data', onData);
  }, (error: any) => fulfill({ error }));
  return promise;

  function onData(chunk: string) {
    downloadedBytes += chunk.length;
    progressCallback!(downloadedBytes, totalBytes);
  }
}

type DownloadOptions = {
  progressBarName?: string,
  retryCount?: number
  log?: DownloadFileLogger
  userAgent?: string
};

export async function download(
  url: string,
  destination: string,
  options: DownloadOptions = {}
) {
  const { progressBarName = 'file', retryCount = 3, log = () => { }, userAgent } = options;
  for (let attempt = 1; attempt <= retryCount; ++attempt) {
    log(
        `downloading ${progressBarName} - attempt #${attempt}`
    );
    const { error } = await downloadFile(url, destination, {
      progressCallback: getDownloadProgress(progressBarName),
      log,
      userAgent,
    });
    if (!error) {
      log(`SUCCESS downloading ${progressBarName}`);
      break;
    }
    const errorMessage = error?.message || '';
    log(`attempt #${attempt} - ERROR: ${errorMessage}`);
    if (
      attempt < retryCount &&
      (errorMessage.includes('ECONNRESET') ||
        errorMessage.includes('ETIMEDOUT'))
    ) {
      // Maximum default delay is 3rd retry: 1337.5ms
      const millis = Math.random() * 200 + 250 * Math.pow(1.5, attempt);
      log(`sleeping ${millis}ms before retry...`);
      await new Promise(c => setTimeout(c, millis));
    } else {
      throw error;
    }
  }
}

function getDownloadProgress(progressBarName: string): OnProgressCallback {
  if (process.stdout.isTTY)
    return _getAnimatedDownloadProgress(progressBarName);
  return _getBasicDownloadProgress(progressBarName);
}

function _getAnimatedDownloadProgress(progressBarName: string): OnProgressCallback {
  let progressBar: ProgressBar;
  let lastDownloadedBytes = 0;

  return (downloadedBytes: number, totalBytes: number) => {
    if (!progressBar) {
      progressBar = new ProgressBar(
          `Downloading ${progressBarName} - ${toMegabytes(
              totalBytes
          )} [:bar] :percent :etas `,
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

function _getBasicDownloadProgress(progressBarName: string): OnProgressCallback {
  // eslint-disable-next-line no-console
  console.log(`Downloading ${progressBarName}...`);
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
  return `${Math.round(mb * 10) / 10} Mb`;
}
