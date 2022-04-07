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

import type { SpawnOptions } from 'child_process';
import { execSync, spawn } from 'child_process';
import * as crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import removeFolder from 'rimraf';
import type stream from 'stream';
import * as URL from 'url';
import type { NameValue } from '../protocol/channels';
import { getUbuntuVersionSync, parseOSReleaseText } from './ubuntuVersion';

export { ManualPromise } from './manualPromise';
export { MultiMap } from './multimap';
export { raceAgainstTimeout, TimeoutRunner, TimeoutRunnerError } from './timeoutRunner';
export type { HTTPRequestParams } from './netUtils';
export { httpRequest, fetchData } from './netUtils';

export const existsAsync = (path: string): Promise<boolean> => new Promise(resolve => fs.stat(path, err => resolve(!err)));

export function spawnAsync(cmd: string, args: string[], options: SpawnOptions = {}): Promise<{stdout: string, stderr: string, code: number | null, error?: Error}> {
  const process = spawn(cmd, args, Object.assign({ windowsHide: true }, options));

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
  // As of Mar 2021, Electron v12 doesn't create new task with `setImmediate` despite
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
  if (debugEnv === '0' || debugEnv === 'false')
    return '';
  return debugEnv ? 'inspector' : '';
}

let _isUnderTest = false;
export function setUnderTest() {
  _isUnderTest = true;
}
export function isUnderTest(): boolean {
  return _isUnderTest;
}

export function experimentalFeaturesEnabled() {
  return isUnderTest() || !!process.env.PLAYWRIGHT_EXPERIMENTAL_FEATURES;
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

let cachedUserAgent: string | undefined;
export function getUserAgent(): string {
  if (cachedUserAgent)
    return cachedUserAgent;
  try {
    cachedUserAgent = determineUserAgent();
  } catch (e) {
    cachedUserAgent = 'Playwright/unknown';
  }
  return cachedUserAgent;
}

function determineUserAgent(): string {
  let osIdentifier = 'unknown';
  let osVersion = 'unknown';
  if (process.platform === 'win32') {
    const version = os.release().split('.');
    osIdentifier = 'windows';
    osVersion = `${version[0]}.${version[1]}`;
  } else if (process.platform === 'darwin') {
    const version = execSync('sw_vers -productVersion', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim().split('.');
    osIdentifier = 'macOS';
    osVersion = `${version[0]}.${version[1]}`;
  } else if (process.platform === 'linux') {
    try {
      // List of /etc/os-release values for different distributions could be
      // found here: https://gist.github.com/aslushnikov/8ceddb8288e4cf9db3039c02e0f4fb75
      const osReleaseText = fs.readFileSync('/etc/os-release', 'utf8');
      const fields = parseOSReleaseText(osReleaseText);
      osIdentifier = fields.get('id') || 'unknown';
      osVersion = fields.get('version_id') || 'unknown';
    } catch (e) {
      // Linux distribution without /etc/os-release.
      // Default to linux/unknown.
      osIdentifier = 'linux';
    }
  }

  const { langName, langVersion } = getClientLanguage();
  return `Playwright/${getPlaywrightVersion()} (${os.arch()}; ${osIdentifier} ${osVersion}) ${langName}/${langVersion}`;
}

export function getClientLanguage(): { langName: string, langVersion: string } {
  let langName = 'unknown';
  let langVersion = 'unknown';
  if (!process.env.PW_LANG_NAME) {
    langName = 'node';
    langVersion = process.version.substring(1).split('.').slice(0, 2).join('.');
  } else if (['node', 'python', 'java', 'csharp'].includes(process.env.PW_LANG_NAME)) {
    langName = process.env.PW_LANG_NAME;
    langVersion = process.env.PW_LANG_NAME_VERSION ?? 'unknown';
  }
  return { langName, langVersion };
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

export type HostPlatform = 'win64' |
                           'mac10.13' |
                           'mac10.14' |
                           'mac10.15' |
                           'mac11' | 'mac11-arm64' |
                           'mac12' | 'mac12-arm64' |
                           'ubuntu18.04' | 'ubuntu18.04-arm64' |
                           'ubuntu20.04' | 'ubuntu20.04-arm64' |
                           'generic-linux' | 'generic-linux-arm64' |
                           '<unknown>';

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
    const archSuffix = os.arch() === 'arm64' ? '-arm64' : '';
    const ubuntuVersion = getUbuntuVersionSync();
    if (!ubuntuVersion)
      return ('generic-linux' + archSuffix) as HostPlatform;
    if (parseInt(ubuntuVersion, 10) <= 19)
      return ('ubuntu18.04' + archSuffix) as HostPlatform;
    return ('ubuntu20.04' + archSuffix) as HostPlatform;
  }
  if (platform === 'win32')
    return 'win64';
  return '<unknown>';
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

export async function transformCommandsForRoot(commands: string[]): Promise<{ command: string, args: string[], elevatedPermissions: boolean}> {
  const isRoot = process.getuid() === 0;
  if (isRoot)
    return { command: 'sh', args: ['-c', `${commands.join('&& ')}`], elevatedPermissions: false };
  const sudoExists = await spawnAsync('which', ['sudo']);
  if (sudoExists.code === 0)
    return { command: 'sudo', args: ['--', 'sh', '-c', `${commands.join('&& ')}`], elevatedPermissions: true };
  return { command: 'su', args: ['root', '-c', `${commands.join('&& ')}`], elevatedPermissions: true };
}

export class SigIntWatcher {
  private _hadSignal: boolean = false;
  private _sigintPromise: Promise<void>;
  private _sigintHandler: () => void;
  constructor() {
    let sigintCallback: () => void;
    this._sigintPromise = new Promise<void>(f => sigintCallback = f);
    this._sigintHandler = () => {
      // We remove the handler so that second Ctrl+C immediately kills the runner
      // via the default sigint handler. This is handy in the case where our shutdown
      // takes a lot of time or is buggy.
      //
      // When running through NPM we might get multiple SIGINT signals
      // for a single Ctrl+C - this is an NPM bug present since at least NPM v6.
      // https://github.com/npm/cli/issues/1591
      // https://github.com/npm/cli/issues/2124
      //
      // Therefore, removing the handler too soon will just kill the process
      // with default handler without printing the results.
      // We work around this by giving NPM 1000ms to send us duplicate signals.
      // The side effect is that slow shutdown or bug in our runner will force
      // the user to hit Ctrl+C again after at least a second.
      setTimeout(() => process.off('SIGINT', this._sigintHandler), 1000);
      this._hadSignal = true;
      sigintCallback();
    };
    process.on('SIGINT', this._sigintHandler);
  }

  promise(): Promise<void> {
    return this._sigintPromise;
  }

  hadSignal(): boolean {
    return this._hadSignal;
  }

  disarm() {
    process.off('SIGINT', this._sigintHandler);
  }
}

