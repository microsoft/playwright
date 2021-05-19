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
import { getProxyForUrl } from 'proxy-from-env';
import * as URL from 'url';
import * as util from 'util';
import { BrowserName, Registry, hostPlatform } from '../utils/registry';
import { debugLogger } from '../utils/debugLogger';

// `https-proxy-agent` v5 is written in TypeScript and exposes generated types.
// However, as of June 2020, its types are generated with tsconfig that enables
// `esModuleInterop` option.
//
// As a result, we can't depend on the package unless we enable the option
// for our codebase. Instead of doing this, we abuse "require" to import module
// without types.
const ProxyAgent = require('https-proxy-agent');

const unlinkAsync = util.promisify(fs.unlink.bind(fs));
const chmodAsync = util.promisify(fs.chmod.bind(fs));
const existsAsync = (path: string): Promise<boolean> => new Promise(resolve => fs.stat(path, err => resolve(!err)));

export type OnProgressCallback = (downloadedBytes: number, totalBytes: number) => void;

export async function downloadBrowserWithProgressBar(registry: Registry, browserName: BrowserName): Promise<boolean> {
  const browserDirectory = registry.browserDirectory(browserName);
  const progressBarName = `${browserName} v${registry.revision(browserName)}`;
  if (await existsAsync(browserDirectory)) {
    // Already downloaded.
    debugLogger.log('install', `browser ${browserName} is already downloaded.`);
    return false;
  }

  let progressBar: ProgressBar;
  let lastDownloadedBytes = 0;

  function progress(downloadedBytes: number, totalBytes: number) {
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

  const url = registry.downloadURL(browserName);
  const zipPath = path.join(os.tmpdir(), `playwright-download-${browserName}-${hostPlatform}-${registry.revision(browserName)}.zip`);
  try {
    for (let attempt = 1, N = 3; attempt <= N; ++attempt) {
      debugLogger.log('install', `downloading ${progressBarName} - attempt #${attempt}`);
      const {error} = await downloadFile(url, zipPath, progress);
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
    const executablePath = registry.executablePath(browserName)!;
    debugLogger.log('install', `fixing permissions at ${executablePath}`);
    await chmodAsync(executablePath, 0o755);
  } catch (e) {
    debugLogger.log('install', `FAILED installation ${progressBarName} with error: ${e}`);
    process.exitCode = 1;
    throw e;
  } finally {
    if (await existsAsync(zipPath))
      await unlinkAsync(zipPath);
  }
  logPolitely(`${progressBarName} downloaded to ${browserDirectory}`);
  return true;
}

function toMegabytes(bytes: number) {
  const mb = bytes / 1024 / 1024;
  return `${Math.round(mb * 10) / 10} Mb`;
}

function downloadFile(url: string, destinationPath: string, progressCallback: OnProgressCallback | undefined): Promise<{error: any}> {
  debugLogger.log('install', `running download:`);
  debugLogger.log('install', `-- from url: ${url}`);
  debugLogger.log('install', `-- to location: ${destinationPath}`);
  let fulfill: ({error}: {error: any}) => void = ({error}) => {};
  let downloadedBytes = 0;
  let totalBytes = 0;

  const promise: Promise<{error: any}> = new Promise(x => { fulfill = x; });

  const request = httpRequest(url, 'GET', response => {
    if (response.statusCode !== 200) {
      const error = new Error(`Download failed: server returned code ${response.statusCode}. URL: ${url}`);
      // consume response data to free up memory
      response.resume();
      fulfill({error});
      return;
    }
    const file = fs.createWriteStream(destinationPath);
    file.on('finish', () => fulfill({error: null}));
    file.on('error', error => fulfill({error}));
    response.pipe(file);
    totalBytes = parseInt(response.headers['content-length'], 10);
    debugLogger.log('install', `-- total bytes: ${totalBytes}`);
    if (progressCallback)
      response.on('data', onData);
  });
  request.on('error', (error: any) => fulfill({error}));
  return promise;

  function onData(chunk: string) {
    downloadedBytes += chunk.length;
    progressCallback!(downloadedBytes, totalBytes);
  }
}

function httpRequest(url: string, method: string, response: (r: any) => void) {
  let options: any = URL.parse(url);
  options.method = method;

  const proxyURL = getProxyForUrl(url);
  if (proxyURL) {
    if (url.startsWith('http:')) {
      const proxy = URL.parse(proxyURL);
      options = {
        path: options.href,
        host: proxy.hostname,
        port: proxy.port,
      };
    } else {
      const parsedProxyURL: any = URL.parse(proxyURL);
      parsedProxyURL.secureProxy = parsedProxyURL.protocol === 'https:';

      options.agent = new ProxyAgent(parsedProxyURL);
      options.rejectUnauthorized = false;
    }
  }

  const requestCallback = (res: any) => {
    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location)
      httpRequest(res.headers.location, method, response);
    else
      response(res);
  };
  const request = options.protocol === 'https:' ?
    require('https').request(options, requestCallback) :
    require('http').request(options, requestCallback);
  request.end();
  return request;
}

export function logPolitely(toBeLogged: string) {
  const logLevel = process.env.npm_config_loglevel;
  const logLevelDisplay = ['silent', 'error', 'warn'].indexOf(logLevel || '') > -1;

  if (!logLevelDisplay)
    console.log(toBeLogged);  // eslint-disable-line no-console
}
