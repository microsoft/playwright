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

import * as extract from 'extract-zip';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as ProgressBar from 'progress';
import { getProxyForUrl } from 'proxy-from-env';
import * as URL from 'url';
import * as util from 'util';
import { assert, getFromENV } from '../utils/utils';
import * as browserPaths from '../utils/browserPaths';
import { BrowserName, BrowserPlatform, BrowserDescriptor } from '../utils/browserPaths';

// `https-proxy-agent` v5 is written in Typescript and exposes generated types.
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

function getDownloadHost(browserName: BrowserName, revision: number): string {
  const envDownloadHost: { [key: string]: string } = {
    chromium: 'PLAYWRIGHT_CHROMIUM_DOWNLOAD_HOST',
    firefox: 'PLAYWRIGHT_FIREFOX_DOWNLOAD_HOST',
    webkit: 'PLAYWRIGHT_WEBKIT_DOWNLOAD_HOST',
  };
  return getFromENV(envDownloadHost[browserName]) ||
         getFromENV('PLAYWRIGHT_DOWNLOAD_HOST') ||
         'https://playwright.azureedge.net';
}

function getDownloadUrl(browserName: BrowserName, revision: number, platform: BrowserPlatform): string | undefined {
  if (browserName === 'chromium') {
    return new Map<BrowserPlatform, string>([
      ['ubuntu18.04', '%s/builds/chromium/%s/chromium-linux.zip'],
      ['ubuntu20.04', '%s/builds/chromium/%s/chromium-linux.zip'],
      ['mac10.13', '%s/builds/chromium/%s/chromium-mac.zip'],
      ['mac10.14', '%s/builds/chromium/%s/chromium-mac.zip'],
      ['mac10.15', '%s/builds/chromium/%s/chromium-mac.zip'],
      ['mac11', '%s/builds/chromium/%s/chromium-mac.zip'],
      ['mac11-arm64', '%s/builds/chromium/%s/chromium-mac-arm64.zip'],
      ['win32', '%s/builds/chromium/%s/chromium-win32.zip'],
      ['win64', '%s/builds/chromium/%s/chromium-win64.zip'],
    ]).get(platform);
  }

  if (browserName === 'firefox') {
    return new Map<BrowserPlatform, string>([
      ['ubuntu18.04', '%s/builds/firefox/%s/firefox-ubuntu-18.04.zip'],
      ['ubuntu20.04', '%s/builds/firefox/%s/firefox-ubuntu-18.04.zip'],
      ['mac10.13', '%s/builds/firefox/%s/firefox-mac-10.14.zip'],
      ['mac10.14', '%s/builds/firefox/%s/firefox-mac-10.14.zip'],
      ['mac10.15', '%s/builds/firefox/%s/firefox-mac-10.14.zip'],
      ['mac11', '%s/builds/firefox/%s/firefox-mac-10.14.zip'],
      ['mac11-arm64', '%s/builds/firefox/%s/firefox-mac-11.0-arm64.zip'],
      ['win32', '%s/builds/firefox/%s/firefox-win32.zip'],
      ['win64', '%s/builds/firefox/%s/firefox-win64.zip'],
    ]).get(platform);
  }

  if (browserName === 'webkit') {
    return new Map<BrowserPlatform, string | undefined>([
      ['ubuntu18.04', '%s/builds/webkit/%s/webkit-ubuntu-18.04.zip'],
      ['ubuntu20.04', '%s/builds/webkit/%s/webkit-ubuntu-20.04.zip'],
      ['mac10.13', undefined],
      ['mac10.14', '%s/builds/webkit/%s/webkit-mac-10.14.zip'],
      ['mac10.15', '%s/builds/webkit/%s/webkit-mac-10.15.zip'],
      ['mac11', '%s/builds/webkit/%s/webkit-mac-10.15.zip'],
      ['mac11-arm64', '%s/builds/webkit/%s/webkit-mac-11.0-arm64.zip'],
      ['win32', '%s/builds/webkit/%s/webkit-win64.zip'],
      ['win64', '%s/builds/webkit/%s/webkit-win64.zip'],
    ]).get(platform);
  }
}

function revisionURL(browser: BrowserDescriptor, platform = browserPaths.hostPlatform): string {
  const revision = parseInt(browser.revision, 10);
  const serverHost = getDownloadHost(browser.name, revision);
  const urlTemplate = getDownloadUrl(browser.name, revision, platform);
  assert(urlTemplate, `ERROR: Playwright does not support ${browser.name} on ${platform}`);
  return util.format(urlTemplate, serverHost, browser.revision);
}

export async function downloadBrowserWithProgressBar(browsersPath: string, browser: BrowserDescriptor): Promise<boolean> {
  const browserPath = browserPaths.browserDirectory(browsersPath, browser);
  const progressBarName = `${browser.name} v${browser.revision}`;
  if (await existsAsync(browserPath)) {
    // Already downloaded.
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

  const url = revisionURL(browser);
  const zipPath = path.join(os.tmpdir(), `playwright-download-${browser.name}-${browserPaths.hostPlatform}-${browser.revision}.zip`);
  try {
    for (let attempt = 1, N = 3; attempt <= N; ++attempt) {
      const {error} = await downloadFile(url, zipPath, progress);
      if (!error)
        break;
      if (attempt < N && error && typeof error === 'object' && typeof error.message === 'string' && error.message.includes('ECONNRESET')) {
        // Maximum delay is 3rd retry: 1337.5ms
        const millis = (Math.random() * 200) + (250 * Math.pow(1.5, attempt));
        await new Promise(c => setTimeout(c, millis));
      } else {
        throw error;
      }
    }
    await extract(zipPath, { dir: browserPath});
    await chmodAsync(browserPaths.executablePath(browserPath, browser)!, 0o755);
  } catch (e) {
    process.exitCode = 1;
    throw e;
  } finally {
    if (await existsAsync(zipPath))
      await unlinkAsync(zipPath);
  }
  logPolitely(`${progressBarName} downloaded to ${browserPath}`);
  return true;
}

function toMegabytes(bytes: number) {
  const mb = bytes / 1024 / 1024;
  return `${Math.round(mb * 10) / 10} Mb`;
}

function downloadFile(url: string, destinationPath: string, progressCallback: OnProgressCallback | undefined): Promise<{error: any}> {
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
