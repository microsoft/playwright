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
import removeFolder from 'rimraf';
import * as crypto from 'crypto';
import os from 'os';
import { spawn } from 'child_process';
import { getProxyForUrl } from 'proxy-from-env';
import * as URL from 'url';
import { getUbuntuVersionSync } from './ubuntuVersion';

// `https-proxy-agent` v5 is written in TypeScript and exposes generated types.
// However, as of June 2020, its types are generated with tsconfig that enables
// `esModuleInterop` option.
//
// As a result, we can't depend on the package unless we enable the option
// for our codebase. Instead of doing this, we abuse "require" to import module
// without types.
const ProxyAgent = require('https-proxy-agent');

export const existsAsync = (path: string): Promise<boolean> => new Promise(resolve => fs.stat(path, err => resolve(!err)));

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

export function fetchData(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    httpRequest(url, 'GET', function(response){
      if (response.statusCode !== 200) {
        reject(new Error(`fetch failed: server returned code ${response.statusCode}. URL: ${url}`));
        return;
      }
      let body = '';
      response.on('data', (chunk: string) => body += chunk);
      response.on('error', (error: any) => reject(error));
      response.on('end', () => resolve(body));
    }).on('error', (error: any) => reject(error));
  });
}

type OnProgressCallback = (downloadedBytes: number, totalBytes: number) => void;
type DownloadFileLogger = (message: string) => void;

export function downloadFile(url: string, destinationPath: string, options: {progressCallback?: OnProgressCallback, log?: DownloadFileLogger} = {}): Promise<{error: any}> {
  const {
    progressCallback,
    log = () => {},
  } = options;
  log(`running download:`);
  log(`-- from url: ${url}`);
  log(`-- to location: ${destinationPath}`);
  let fulfill: ({error}: {error: any}) => void = ({error}) => {};
  let downloadedBytes = 0;
  let totalBytes = 0;

  const promise: Promise<{error: any}> = new Promise(x => { fulfill = x; });

  const request = httpRequest(url, 'GET', response => {
    log(`-- response status code: ${response.statusCode}`);
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
    log(`-- total bytes: ${totalBytes}`);
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

export function spawnAsync(cmd: string, args: string[], options: any): Promise<{stdout: string, stderr: string, code: number, error?: Error}> {
  const process = spawn(cmd, args, options);

  return new Promise(resolve => {
    let stdout = '';
    let stderr = '';
    if (process.stdout)
      process.stdout.on('data', data => stdout += data);
    if (process.stderr)
      process.stderr.on('data', data => stderr += data);
    process.on('close', code => resolve({stdout, stderr, code}));
    process.on('error', error => resolve({stdout, stderr, code: 0, error}));
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
    throw new Error(message);
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
  await fs.promises.mkdir(path.dirname(filePath), {recursive: true}).catch(() => {});
}

type HeadersArray = { name: string, value: string }[];
type HeadersObject = { [key: string]: string };

export function headersObjectToArray(headers: HeadersObject): HeadersArray {
  const result: HeadersArray = [];
  for (const name in headers) {
    if (!Object.is(headers[name], undefined))
      result.push({ name, value: headers[name] });
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

export function calculateSha1(buffer: Buffer | string): string {
  const hash = crypto.createHash('sha1');
  hash.update(buffer);
  return hash.digest('hex');
}

export function createGuid(): string {
  return crypto.randomBytes(16).toString('hex');
}

export async function removeFolders(dirs: string[]): Promise<Array<Error|undefined>> {
  return await Promise.all(dirs.map((dir: string) => {
    return new Promise<Error|undefined>(fulfill => {
      removeFolder(dir, { maxBusyTries: 10 }, error => {
        fulfill(error);
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

const localIpAddresses = [
  'localhost',
  '127.0.0.1',
  '::ffff:127.0.0.1',
  '::1',
  '0000:0000:0000:0000:0000:0000:0000:0001', // WebKit (Windows)
];

export function isLocalIpAddress(ipAdress: string): boolean {
  return localIpAddresses.includes(ipAdress);
}

export function getUserAgent() {
  const packageJson = require('./../../package.json');
  return `Playwright/${packageJson.version} (${os.arch()}/${os.platform()}/${os.release()})`;
}

export function constructURLBasedOnBaseURL(baseURL: string | undefined, givenURL: string): string {
  try {
    return (new URL.URL(givenURL, baseURL)).toString();
  } catch (e) {
    return givenURL;
  }
}

export type HostPlatform = 'win32'|'win64'|'mac10.13'|'mac10.14'|'mac10.15'|'mac11'|'mac11-arm64'|'ubuntu18.04'|'ubuntu20.04';
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
      const LAST_STABLE_MAC_MAJOR_VERSION = 11;
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
    if (parseInt(ubuntuVersion, 10) <= 19)
      return 'ubuntu18.04';
    return 'ubuntu20.04';
  }
  if (platform === 'win32')
    return os.arch() === 'x64' ? 'win64' : 'win32';
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
