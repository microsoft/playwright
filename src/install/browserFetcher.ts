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
import * as ProxyAgent from 'https-proxy-agent';
import * as os from 'os';
import * as path from 'path';
import * as ProgressBar from 'progress';
import { getProxyForUrl } from 'proxy-from-env';
import * as URL from 'url';
import * as util from 'util';
import { assert, logPolitely, getFromENV } from '../helper';
import * as browserPaths from './browserPaths';
import { BrowserName, BrowserPlatform, BrowserDescriptor } from './browserPaths';

const unlinkAsync = util.promisify(fs.unlink.bind(fs));
const chmodAsync = util.promisify(fs.chmod.bind(fs));
const existsAsync = (path: string): Promise<boolean> => new Promise(resolve => fs.stat(path, err => resolve(!err)));

export type OnProgressCallback = (downloadedBytes: number, totalBytes: number) => void;

const DEFAULT_DOWNLOAD_HOSTS: { [key: string]: string } = {
  chromium: 'https://storage.googleapis.com',
  firefox: 'https://playwright.azureedge.net',
  webkit: 'https://playwright.azureedge.net',
};

function getDownloadUrl(browserName: BrowserName, platform: BrowserPlatform): string | undefined {
  if (browserName === 'chromium') {
    return new Map<BrowserPlatform, string>([
      ['linux', '%s/chromium-browser-snapshots/Linux_x64/%d/chrome-linux.zip'],
      ['mac10.13', '%s/chromium-browser-snapshots/Mac/%d/chrome-mac.zip'],
      ['mac10.14', '%s/chromium-browser-snapshots/Mac/%d/chrome-mac.zip'],
      ['mac10.15', '%s/chromium-browser-snapshots/Mac/%d/chrome-mac.zip'],
      ['win32', '%s/chromium-browser-snapshots/Win/%d/chrome-win.zip'],
      ['win64', '%s/chromium-browser-snapshots/Win_x64/%d/chrome-win.zip'],
    ]).get(platform);
  }

  if (browserName === 'firefox') {
    return new Map<BrowserPlatform, string>([
      ['linux', '%s/builds/firefox/%s/firefox-linux.zip'],
      ['mac10.13', '%s/builds/firefox/%s/firefox-mac.zip'],
      ['mac10.14', '%s/builds/firefox/%s/firefox-mac.zip'],
      ['mac10.15', '%s/builds/firefox/%s/firefox-mac.zip'],
      ['win32', '%s/builds/firefox/%s/firefox-win32.zip'],
      ['win64', '%s/builds/firefox/%s/firefox-win64.zip'],
    ]).get(platform);
  }

  if (browserName === 'webkit') {
    return new Map<BrowserPlatform, string | undefined>([
      ['linux', '%s/builds/webkit/%s/minibrowser-gtk-wpe.zip'],
      ['mac10.13', undefined],
      ['mac10.14', '%s/builds/webkit/%s/minibrowser-mac-10.14.zip'],
      ['mac10.15', '%s/builds/webkit/%s/minibrowser-mac-10.15.zip'],
      ['win32', '%s/builds/webkit/%s/minibrowser-win64.zip'],
      ['win64', '%s/builds/webkit/%s/minibrowser-win64.zip'],
    ]).get(platform);
  }
}

function revisionURL(browser: BrowserDescriptor, platform = browserPaths.hostPlatform): string {
  const serverHost = getFromENV('PLAYWRIGHT_DOWNLOAD_HOST') || DEFAULT_DOWNLOAD_HOSTS[browser.name];
  const urlTemplate = getDownloadUrl(browser.name, platform);
  assert(urlTemplate, `ERROR: Playwright does not support ${browser.name} on ${platform}`);
  return util.format(urlTemplate, serverHost, browser.revision);
}

export async function downloadBrowserWithProgressBar(browserPath: string, browser: BrowserDescriptor): Promise<boolean> {
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
    await downloadFile(url, zipPath, progress);
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

export async function canDownload(browserName: BrowserName, browserRevision: string, platform: BrowserPlatform): Promise<boolean> {
  const url = revisionURL({ name: browserName, revision: browserRevision }, platform);
  let resolve: (result: boolean) => void = () => {};
  const promise = new Promise<boolean>(x => resolve = x);
  const request = httpRequest(url, 'HEAD', response => {
    resolve(response.statusCode === 200);
  });
  request.on('error', (error: any) => {
    console.error(error);  // eslint-disable-line no-console
    resolve(false);
  });
  return promise;
}

function downloadFile(url: string, destinationPath: string, progressCallback: OnProgressCallback | undefined): Promise<any> {
  let fulfill: () => void = () => {};
  let reject: (error: any) => void = () => {};
  let downloadedBytes = 0;
  let totalBytes = 0;

  const promise = new Promise((x, y) => { fulfill = x; reject = y; });

  const request = httpRequest(url, 'GET', response => {
    if (response.statusCode !== 200) {
      const error = new Error(`Download failed: server returned code ${response.statusCode}. URL: ${url}`);
      // consume response data to free up memory
      response.resume();
      reject(error);
      return;
    }
    const file = fs.createWriteStream(destinationPath);
    file.on('finish', () => fulfill());
    file.on('error', error => reject(error));
    response.pipe(file);
    totalBytes = parseInt(response.headers['content-length'], 10);
    if (progressCallback)
      response.on('data', onData);
  });
  request.on('error', (error: any) => reject(error));
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
