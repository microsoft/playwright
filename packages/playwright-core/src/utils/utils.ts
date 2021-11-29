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

import path from 'path';
import fs from 'fs';
import stream from 'stream';
import removeFolder from 'rimraf';
import * as crypto from 'crypto';
import os from 'os';
import http from 'http';
import https from 'https';
import { spawn, SpawnOptions } from 'child_process';
import { getProxyForUrl } from 'proxy-from-env';
import * as URL from 'url';
import { getUbuntuVersionSync } from './ubuntuVersion';
import { NameValue } from '../protocol/channels';
import ProgressBar from 'progress';

// `https-proxy-agent` v5 is written in TypeScript and exposes generated types.
// However, as of June 2020, its types are generated with tsconfig that enables
// `esModuleInterop` option.
//
// As a result, we can't depend on the package unless we enable the option
// for our codebase. Instead of doing this, we abuse "require" to import module
// without types.
const ProxyAgent = require('https-proxy-agent');

export const existsAsync = (path: string): Promise<boolean> => new Promise(resolve => fs.stat(path, err => resolve(!err)));

export type HTTPRequestParams = {
  url: string,
  method?: string,
  headers?: http.OutgoingHttpHeaders,
  data?: string | Buffer,
  timeout?: number,
};

function httpRequest(params: HTTPRequestParams, onResponse: (r: http.IncomingMessage) => void, onError: (error: Error) => void) {
  const parsedUrl = URL.parse(params.url);
  let options: https.RequestOptions = { ...parsedUrl };
  options.method = params.method || 'GET';
  options.headers = params.headers;

  const proxyURL = getProxyForUrl(params.url);
  if (proxyURL) {
    if (params.url.startsWith('http:')) {
      const proxy = URL.parse(proxyURL);
      options = {
        path: parsedUrl.href,
        host: proxy.hostname,
        port: proxy.port,
      };
    } else {
      const parsedProxyURL = URL.parse(proxyURL);
      (parsedProxyURL as any).secureProxy = parsedProxyURL.protocol === 'https:';

      options.agent = new ProxyAgent(parsedProxyURL);
      options.rejectUnauthorized = false;
    }
  }

  const requestCallback = (res: http.IncomingMessage) => {
    const statusCode = res.statusCode || 0;
    if (statusCode >= 300 && statusCode < 400 && res.headers.location)
      httpRequest({ ...params, url: res.headers.location }, onResponse, onError);
    else
      onResponse(res);
  };
  const request = options.protocol === 'https:' ?
    https.request(options, requestCallback) :
    http.request(options, requestCallback);
  request.on('error', onError);
  if (params.timeout !== undefined) {
    const rejectOnTimeout = () =>  {
      onError(new Error(`Request to ${params.url} timed out after ${params.timeout}ms`));
      request.abort();
    };
    if (params.timeout <= 0) {
      rejectOnTimeout();
      return;
    }
    request.setTimeout(params.timeout, rejectOnTimeout);
  }
  request.end(params.data);
}

export function fetchData(params: HTTPRequestParams, onError?: (params: HTTPRequestParams, response: http.IncomingMessage) => Promise<Error>): Promise<string> {
  return new Promise((resolve, reject) => {
    httpRequest(params, async response => {
      if (response.statusCode !== 200) {
        const error = onError ? await onError(params, response) : new Error(`fetch failed: server returned code ${response.statusCode}. URL: ${params.url}`);
        reject(error);
        return;
      }
      let body = '';
      response.on('data', (chunk: string) => body += chunk);
      response.on('error', (error: any) => reject(error));
      response.on('end', () => resolve(body));
    }, reject);
  });
}

type OnProgressCallback = (downloadedBytes: number, totalBytes: number) => void;
type DownloadFileLogger = (message: string) => void;

function downloadFile(url: string, destinationPath: string, options: {progressCallback?: OnProgressCallback, log?: DownloadFileLogger} = {}): Promise<{error: any}> {
  const {
    progressCallback,
    log = () => {},
  } = options;
  log(`running download:`);
  log(`-- from url: ${url}`);
  log(`-- to location: ${destinationPath}`);
  let fulfill: ({ error }: {error: any}) => void = ({ error }) => {};
  let downloadedBytes = 0;
  let totalBytes = 0;

  const promise: Promise<{error: any}> = new Promise(x => { fulfill = x; });

  httpRequest({ url }, response => {
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

export async function download(
  url: string,
  destination: string,
  options: {
		progressBarName?: string,
		retryCount?: number
    log?: DownloadFileLogger
	} = {}
) {
  const { progressBarName = 'file', retryCount = 3, log = () => {} } = options;
  for (let attempt = 1; attempt <= retryCount; ++attempt) {
    log(
        `downloading ${progressBarName} - attempt #${attempt}`
    );
    const { error } = await downloadFile(url, destination, {
      progressCallback: getDownloadProgress(progressBarName),
      log,
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
  let progressBar: ProgressBar;
  let lastDownloadedBytes = 0;

  return (downloadedBytes: number, totalBytes: number) => {
    if (!process.stderr.isTTY)
      return;
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

function toMegabytes(bytes: number) {
  const mb = bytes / 1024 / 1024;
  return `${Math.round(mb * 10) / 10} Mb`;
}

export function spawnAsync(cmd: string, args: string[], options: SpawnOptions = {}): Promise<{stdout: string, stderr: string, code: number | null, error?: Error}> {
  const process = spawn(cmd, args, options);

  return new Promise(resolve => {
    let stdout = '';
    let stderr = '';
    if (process.stdout)
      process.stdout.on('data', data => stdout += data);
    if (process.stderr)
      process.stderr.on('data', data => stderr += data);
    process.on('close', code => resolve({ stdout, stderr, code }));
    process.on('error', error => resolve({ stdout, stderr, code: 0, error }));
  });
}

// See https://joel.tools/microtasks/
export function makeWaitForNextTask() {
  // As of Mar 2021, Electorn v12 doesn't create new task with `setImmediate` despite
  // using Node 14 internally, so we fallback to `setTimeout(0)` instead.
  // @see https://github.com/electron/electron/issues/28261
  if ((process.versions as any).electron)
    return (callback: () => void) => setTimeout(callback, 0);
  if (parseInt(process.versions.node, 10) >= 11)
    return setImmediate;

  // Unlike Node 11, Node 10 and less have a bug with Task and MicroTask execution order:
  // - https://github.com/nodejs/node/issues/22257
  //
  // So we can't simply run setImmediate to dispatch code in a following task.
  // However, we can run setImmediate from-inside setImmediate to make sure we're getting
  // in the following task.

  let spinning = false;
  const callbacks: (() => void)[] = [];
  const loop = () => {
    const callback = callbacks.shift();
    if (!callback) {
      spinning = false;
      return;
    }
    setImmediate(loop);
    // Make sure to call callback() as the last thing since it's
    // untrusted code that might throw.
    callback();
  };

  return (callback: () => void) => {
    callbacks.push(callback);
    if (!spinning) {
      spinning = true;
      setImmediate(loop);
    }
  };
}

export function assert(value: any, message?: string): asserts value {
  if (!value)
    throw new Error(message || 'Assertion error');
}

export function debugAssert(value: any, message?: string): asserts value {
  if (isUnderTest() && !value)
    throw new Error(message);
}

export function isString(obj: any): obj is string {
  return typeof obj === 'string' || obj instanceof String;
}

export function isRegExp(obj: any): obj is RegExp {
  return obj instanceof RegExp || Object.prototype.toString.call(obj) === '[object RegExp]';
}

export function isObject(obj: any): obj is NonNullable<object> {
  return typeof obj === 'object' && obj !== null;
}

export function isError(obj: any): obj is Error {
  return obj instanceof Error || (obj && obj.__proto__ && obj.__proto__.name === 'Error');
}

const debugEnv = getFromENV('PWDEBUG') || '';
export function debugMode() {
  if (debugEnv === 'console')
    return 'console';
  return debugEnv ? 'inspector' : '';
}

let _isUnderTest = false;
export function setUnderTest() {
  _isUnderTest = true;
}
export function isUnderTest(): boolean {
  return _isUnderTest;
}

export function getFromENV(name: string): string | undefined {
  let value = process.env[name];
  value = value === undefined ? process.env[`npm_config_${name.toLowerCase()}`] : value;
  value = value === undefined ?  process.env[`npm_package_config_${name.toLowerCase()}`] : value;
  return value;
}

export function getAsBooleanFromENV(name: string): boolean {
  const value = getFromENV(name);
  return !!value && value !== 'false' && value !== '0';
}

export async function mkdirIfNeeded(filePath: string) {
  // This will harmlessly throw on windows if the dirname is the root directory.
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true }).catch(() => {});
}

type HeadersArray = { name: string, value: string }[];
type HeadersObject = { [key: string]: string };

export function headersObjectToArray(headers: HeadersObject, separator?: string, setCookieSeparator?: string): HeadersArray {
  if (!setCookieSeparator)
    setCookieSeparator = separator;
  const result: HeadersArray = [];
  for (const name in headers) {
    const values = headers[name];
    if (separator) {
      const sep = name.toLowerCase() === 'set-cookie' ? setCookieSeparator : separator;
      for (const value of values.split(sep!))
        result.push({ name, value: value.trim() });
    } else {
      result.push({ name, value: values });
    }
  }
  return result;
}

export function headersArrayToObject(headers: HeadersArray, lowerCase: boolean): HeadersObject {
  const result: HeadersObject = {};
  for (const { name, value } of headers)
    result[lowerCase ? name.toLowerCase() : name] = value;
  return result;
}

export function monotonicTime(): number {
  const [seconds, nanoseconds] = process.hrtime();
  return seconds * 1000 + (nanoseconds / 1000 | 0) / 1000;
}

class HashStream extends stream.Writable {
  private _hash = crypto.createHash('sha1');

  override _write(chunk: Buffer, encoding: string, done: () => void) {
    this._hash.update(chunk);
    done();
  }

  digest(): string {
    return this._hash.digest('hex');
  }
}

export function objectToArray(map?:  { [key: string]: any }): NameValue[] | undefined {
  if (!map)
    return undefined;
  const result = [];
  for (const [name, value] of Object.entries(map))
    result.push({ name, value: String(value) });
  return result;
}

export function arrayToObject(array?: NameValue[]): { [key: string]: string } | undefined {
  if (!array)
    return undefined;
  const result: { [key: string]: string } = {};
  for (const { name, value } of array)
    result[name] = value;
  return result;
}

export async function calculateFileSha1(filename: string): Promise<string> {
  const hashStream = new HashStream();
  const stream = fs.createReadStream(filename);
  stream.on('open', () => stream.pipe(hashStream));
  await new Promise((f, r) => {
    hashStream.on('finish', f);
    hashStream.on('error', r);
  });
  return hashStream.digest();
}

export function calculateSha1(buffer: Buffer | string): string {
  const hash = crypto.createHash('sha1');
  hash.update(buffer);
  return hash.digest('hex');
}

export function createGuid(): string {
  return crypto.randomBytes(16).toString('hex');
}

export async function removeFolders(dirs: string[]): Promise<Array<Error|null|undefined>> {
  return await Promise.all(dirs.map((dir: string) => {
    return new Promise<Error|null|undefined>(fulfill => {
      removeFolder(dir, { maxBusyTries: 10 }, error => {
        fulfill(error ?? undefined);
      });
    });
  }));
}

export function canAccessFile(file: string) {
  if (!file)
    return false;

  try {
    fs.accessSync(file);
    return true;
  } catch (e) {
    return false;
  }
}

export function getUserAgent() {
  return `Playwright/${getPlaywrightVersion()} (${os.arch()}/${os.platform()}/${os.release()})`;
}

export function getPlaywrightVersion(majorMinorOnly = false) {
  const packageJson = require('./../../package.json');
  return majorMinorOnly ? packageJson.version.split('.').slice(0, 2).join('.') : packageJson.version;
}

export function constructURLBasedOnBaseURL(baseURL: string | undefined, givenURL: string): string {
  try {
    return (new URL.URL(givenURL, baseURL)).toString();
  } catch (e) {
    return givenURL;
  }
}

export type HostPlatform = 'win64'|'mac10.13'|'mac10.14'|'mac10.15'|'mac11'|'mac11-arm64'|'mac12'|'mac12-arm64'|'ubuntu18.04'|'ubuntu20.04'|'ubuntu18.04-arm64'|'ubuntu20.04-arm64';
export const hostPlatform = ((): HostPlatform => {
  const platform = os.platform();
  if (platform === 'darwin') {
    const ver = os.release().split('.').map((a: string) => parseInt(a, 10));
    let macVersion = '';
    if (ver[0] < 18) {
      // Everything before 10.14 is considered 10.13.
      macVersion = 'mac10.13';
    } else if (ver[0] === 18) {
      macVersion = 'mac10.14';
    } else if (ver[0] === 19) {
      macVersion = 'mac10.15';
    } else {
      // ver[0] >= 20
      const LAST_STABLE_MAC_MAJOR_VERSION = 12;
      // Best-effort support for MacOS beta versions.
      macVersion = 'mac' + Math.min(ver[0] - 9, LAST_STABLE_MAC_MAJOR_VERSION);
      // BigSur is the first version that might run on Apple Silicon.
      if (os.cpus().some(cpu => cpu.model.includes('Apple')))
        macVersion += '-arm64';
    }
    return macVersion as HostPlatform;
  }
  if (platform === 'linux') {
    const ubuntuVersion = getUbuntuVersionSync();
    const archSuffix = os.arch() === 'arm64' ? '-arm64' : '';
    if (parseInt(ubuntuVersion, 10) <= 19)
      return ('ubuntu18.04' + archSuffix) as HostPlatform;
    return ('ubuntu20.04' + archSuffix) as HostPlatform;
  }
  if (platform === 'win32')
    return 'win64';
  return platform as HostPlatform;
})();

export function wrapInASCIIBox(text: string, padding = 0): string {
  const lines = text.split('\n');
  const maxLength = Math.max(...lines.map(line => line.length));
  return [
    '╔' + '═'.repeat(maxLength + padding * 2) + '╗',
    ...lines.map(line => '║' + ' '.repeat(padding) + line + ' '.repeat(maxLength - line.length + padding) + '║'),
    '╚' + '═'.repeat(maxLength + padding * 2) + '╝',
  ].join('\n');
}

export function isFilePayload(value: any): boolean {
  return typeof value === 'object' && value['name'] && value['mimeType'] && value['buffer'];
}

export function streamToString(stream: stream.Readable): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', chunk => chunks.push(Buffer.from(chunk)));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  });
}
