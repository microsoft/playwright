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
import { httpRequest } from '../../utils/network';
import { ManualPromise } from '../../utils/manualPromise';
import { extract, tarFs } from '../../zipBundle';
import type http from 'http';
import { pipeline } from 'stream/promises';
import { createBrotliDecompress } from 'zlib';

export type DownloadParams = {
  title: string;
  browserDirectory: string;
  url: string;
  zipPath: string;
  executablePath: string | undefined;
  connectionTimeout: number;
  userAgent: string;
};

function log(message: string) {
  process.send?.({ method: 'log', params: { message } });
}

function progress(done: number, total: number) {
  process.send?.({ method: 'progress', params: { done, total } });
}

function browserDirectoryToMarkerFilePath(browserDirectory: string): string {
  return path.join(browserDirectory, 'INSTALLATION_COMPLETE');
}

function downloadFile(options: DownloadParams): Promise<void> {
  let downloadedBytes = 0;
  let totalBytes = 0;

  const promise = new ManualPromise<void>();

  httpRequest({
    url: options.url,
    headers: {
      'User-Agent': options.userAgent,
    },
    timeout: options.connectionTimeout,
  }, response => {
    log(`-- response status code: ${response.statusCode}`);
    if (response.statusCode !== 200) {
      let content = '';
      const handleError = () => {
        const error = new Error(`Download failed: server returned code ${response.statusCode} body '${content}'. URL: ${options.url}`);
        // consume response data to free up memory
        response.resume();
        promise.reject(error);
      };
      response
          .on('data', chunk => content += chunk)
          .on('end', handleError)
          .on('error', handleError);
      return;
    }
    totalBytes = parseInt(response.headers['content-length'] || '0', 10);
    log(`-- total bytes: ${totalBytes}`);
    const file = fs.createWriteStream(options.zipPath);
    file.on('finish', () => {
      if (downloadedBytes !== totalBytes) {
        log(`-- download failed, size mismatch: ${downloadedBytes} != ${totalBytes}`);
        promise.reject(new Error(`Download failed: size mismatch, file size: ${downloadedBytes}, expected size: ${totalBytes} URL: ${options.url}`));
      } else {
        log(`-- download complete, size: ${downloadedBytes}`);
        promise.resolve();
      }
    });
    file.on('error', error => promise.reject(error));
    response.pipe(file);
    response.on('data', onData);
    response.on('error', (error: any) => {
      file.close();
      if (error?.code === 'ECONNRESET') {
        log(`-- download failed, server closed connection`);
        promise.reject(new Error(`Download failed: server closed connection. URL: ${options.url}`));
      } else {
        log(`-- download failed, unexpected error`);
        promise.reject(new Error(`Download failed: ${error?.message ?? error}. URL: ${options.url}`));
      }
    });
  }, (error: any) => promise.reject(error));
  return promise;

  function onData(chunk: string) {
    downloadedBytes += chunk.length;
    progress(downloadedBytes, totalBytes);
  }
}

async function throwUnexpectedResponseError(response: http.IncomingMessage) {
  let body = '';
  try {
    await new Promise<void>((resolve, reject) => {
      response
          .on('data', chunk => body += chunk)
          .on('end', resolve)
          .on('error', reject);
    });
  } catch (error) {
    body += error;
  }

  response.resume(); // consume response data to free up memory

  throw new Error(`server returned code ${response.statusCode} body '${body}'`);
}

async function downloadAndExtractBrotli(options: DownloadParams) {
  const response = await new Promise<http.IncomingMessage>((resolve, reject) => httpRequest({
    url: options.url,
    headers: {
      'User-Agent': options.userAgent,
    },
    timeout: options.connectionTimeout,
  }, resolve, reject));

  log(`-- response status code: ${response.statusCode}`);
  if (response.statusCode !== 200)
    await throwUnexpectedResponseError(response);

  const totalBytes = parseInt(response.headers['content-length'] || '0', 10);
  log(`-- total bytes: ${totalBytes}`);

  let downloadedBytes = 0;
  response.on('data', chunk => {
    downloadedBytes += chunk.length;
    progress(downloadedBytes, totalBytes);
  });

  await pipeline(
      response,
      createBrotliDecompress(),
      tarFs.extract(options.browserDirectory)
  );

  if (downloadedBytes !== totalBytes)
    throw new Error(`size mismatch, file size: ${downloadedBytes}, expected size: ${totalBytes}`);

  log(`-- download complete, size: ${downloadedBytes}`);
}

async function main(options: DownloadParams) {
  if (options.url.endsWith('.tar.br')) {
    try {
      await downloadAndExtractBrotli(options);
    } catch (error) {
      throw new Error(`Download failed. URL: ${options.url}`, { cause: error });
    }
    log(`SUCCESS downloading and extracting ${options.title}`);
  } else {
    await downloadFile(options);
    log(`SUCCESS downloading ${options.title}`);
    log(`extracting archive`);
    await extract(options.zipPath, { dir: options.browserDirectory });
  }
  if (options.executablePath) {
    log(`fixing permissions at ${options.executablePath}`);
    await fs.promises.chmod(options.executablePath, 0o755);
  }
  await fs.promises.writeFile(browserDirectoryToMarkerFilePath(options.browserDirectory), '');
}

process.on('message', async message => {
  const { method, params } = message as any;
  if (method === 'download') {
    try {
      await main(params);
      // eslint-disable-next-line no-restricted-properties
      process.exit(0);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
      // eslint-disable-next-line no-restricted-properties
      process.exit(1);
    }
  }
});

// eslint-disable-next-line no-restricted-properties
process.on('disconnect', () => { process.exit(0); });
