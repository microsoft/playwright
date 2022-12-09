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
import { mime, parseStackTraceLine } from 'playwright-core/lib/utilsBundle';
import util from 'util';
import path from 'path';
import url from 'url';
import { colors, debug, minimatch } from 'playwright-core/lib/utilsBundle';
import type { TestError, Location } from './types';
import { calculateSha1, isRegExp, isString } from 'playwright-core/lib/utils';
import { currentTestInfo } from './globals';
import type { ParsedStackTrace } from 'playwright-core/lib/utils/stackTrace';
import { captureStackTrace as coreCaptureStackTrace } from 'playwright-core/lib/utils/stackTrace';

export type { ParsedStackTrace };

const PLAYWRIGHT_CORE_PATH = path.dirname(require.resolve('playwright-core'));
const EXPECT_PATH = require.resolve('./expectBundle');
const EXPECT_PATH_IMPL = require.resolve('./expectBundleImpl');
const PLAYWRIGHT_TEST_PATH = path.join(__dirname, '..');

export function captureStackTrace(customApiName?: string): ParsedStackTrace {
  const stackTrace: ParsedStackTrace = coreCaptureStackTrace();
  const frames = [];
  const frameTexts = [];
  for (let i = 0; i < stackTrace.frames.length; ++i) {
    const frame = stackTrace.frames[i];
    if (frame.file === EXPECT_PATH || frame.file === EXPECT_PATH_IMPL)
      continue;
    frames.push(frame);
    frameTexts.push(stackTrace.frameTexts[i]);
  }
  return {
    allFrames: stackTrace.allFrames,
    frames,
    frameTexts,
    apiName: customApiName ?? stackTrace.apiName,
  };
}

function findStackRange(lines: string[]): { start: number, end: number } {
  let start = lines.findIndex(line => line.startsWith('    at '));
  if (start === -1)
    start = lines.length;
  let end = lines.findIndex((line, index) => index > start && !line.startsWith('    at '));
  if (end === -1)
    end = lines.length;
  return { start, end };
}

function filterStackTrace(error: Error, depth = 10): string | undefined {
  if (process.env.PWDEBUGIMPL)
    return;

  if (depth && error.cause instanceof Error)
    filterStackTrace(error.cause, depth - 1);
  if (!error.stack)
    return;

  const lines = error.stack.split('\n');
  const stackRange = findStackRange(lines);
  const stackLines = lines.slice(stackRange.start, stackRange.end).filter(line => {
    const { frame, fileName } = parseStackTraceLine(line);
    if (!frame || !fileName)
      return false;
    if (belongsToNodeModules(fileName))
      return false;
    return !fileName.startsWith(PLAYWRIGHT_TEST_PATH) &&
           !fileName.startsWith(PLAYWRIGHT_CORE_PATH);
  });
  const resultLines = lines.slice(0, stackRange.start).concat(stackLines).concat(lines.slice(stackRange.end));
  // Note that we update the stack trace on the existing error object.
  error.stack = resultLines.join('\n');
}

export function serializeError(error: Error | any): TestError {
  if (!(error instanceof Error))
    return { value: util.inspect(error) };

  filterStackTrace(error);

  // We do not want extra details for expect and timeout errors.
  const isExpectError = !!(error as any).matcherResult;
  const isTimeoutError = error.name === 'TimeoutError';
  const description = (isExpectError || isTimeoutError) ? (error.stack || error.message) : util.inspect(error);
  const lines = description.split('\n');
  const stackRange = findStackRange(lines);

  // Account for util.inspect() custom properties formatting.
  const inspectSuffix = ' {';
  const lastStackLine = lines[stackRange.end - 1];
  if (lastStackLine && lastStackLine.endsWith(inspectSuffix) && stackRange.start > 0) {
    lines[stackRange.start - 1] += inspectSuffix;
    lines[stackRange.end - 1] = lastStackLine.substring(0, lastStackLine.length - inspectSuffix.length);
  }

  const messageLines = lines.slice(0, stackRange.start).concat(lines.slice(stackRange.end));
  const stackLines = lines.slice(stackRange.start, stackRange.end);
  return {
    message: messageLines.join('\n'),
    stack: stackLines.join('\n'),
  };
}

function belongsToNodeModules(file: string) {
  return file.includes(`${path.sep}node_modules${path.sep}`);
}

export type Matcher = (value: string) => boolean;

export type TestFileFilter = {
  re?: RegExp;
  exact?: string;
  line: number | null;
  column: number | null;
};

export function createFileMatcherFromFilters(filters: TestFileFilter[]): Matcher {
  return createFileMatcher(filters.map(filter => filter.re || filter.exact || ''));
}

export function createFileMatcher(patterns: string | RegExp | (string | RegExp)[]): Matcher {
  const reList: RegExp[] = [];
  const filePatterns: string[] = [];
  for (const pattern of Array.isArray(patterns) ? patterns : [patterns]) {
    if (isRegExp(pattern)) {
      reList.push(pattern);
    } else {
      if (!pattern.startsWith('**/'))
        filePatterns.push('**/' + pattern);
      else
        filePatterns.push(pattern);
    }
  }
  return (filePath: string) => {
    for (const re of reList) {
      re.lastIndex = 0;
      if (re.test(filePath))
        return true;
    }
    // Windows might still receive unix style paths from Cygwin or Git Bash.
    // Check against the file url as well.
    if (path.sep === '\\') {
      const fileURL = url.pathToFileURL(filePath).href;
      for (const re of reList) {
        re.lastIndex = 0;
        if (re.test(fileURL))
          return true;
      }
    }
    for (const pattern of filePatterns) {
      if (minimatch(filePath, pattern, { nocase: true, dot: true }))
        return true;
    }
    return false;
  };
}

export function createTitleMatcher(patterns: RegExp | RegExp[]): Matcher {
  const reList = Array.isArray(patterns) ? patterns : [patterns];
  return (value: string) => {
    for (const re of reList) {
      re.lastIndex = 0;
      if (re.test(value))
        return true;
    }
    return false;
  };
}

export function mergeObjects<A extends object, B extends object>(a: A | undefined | void, b: B | undefined | void): A & B {
  const result = { ...a } as any;
  if (!Object.is(b, undefined)) {
    for (const [name, value] of Object.entries(b as B)) {
      if (!Object.is(value, undefined))
        result[name] = value;
    }
  }
  return result as any;
}

export function forceRegExp(pattern: string): RegExp {
  const match = pattern.match(/^\/(.*)\/([gi]*)$/);
  if (match)
    return new RegExp(match[1], match[2]);
  return new RegExp(pattern, 'g');
}

export function relativeFilePath(file: string): string {
  if (!path.isAbsolute(file))
    return file;
  return path.relative(process.cwd(), file);
}

export function formatLocation(location: Location) {
  return relativeFilePath(location.file) + ':' + location.line + ':' + location.column;
}

export function errorWithFile(file: string, message: string) {
  return new Error(`${relativeFilePath(file)}: ${message}`);
}

export function errorWithLocation(location: Location, message: string) {
  return new Error(`${formatLocation(location)}: ${message}`);
}

export function expectTypes(receiver: any, types: string[], matcherName: string) {
  if (typeof receiver !== 'object' || !types.includes(receiver.constructor.name)) {
    const commaSeparated = types.slice();
    const lastType = commaSeparated.pop();
    const typesString = commaSeparated.length ? commaSeparated.join(', ') + ' or ' + lastType : lastType;
    throw new Error(`${matcherName} can be only used with ${typesString} object${types.length > 1 ? 's' : ''}`);
  }
}

export function sanitizeForFilePath(s: string) {
  return s.replace(/[\x00-\x2C\x2E-\x2F\x3A-\x40\x5B-\x60\x7B-\x7F]+/g, '-');
}

export function trimLongString(s: string, length = 100) {
  if (s.length <= length)
    return s;
  const hash = calculateSha1(s);
  const middle = `-${hash.substring(0, 5)}-`;
  const start = Math.floor((length - middle.length) / 2);
  const end = length - middle.length - start;
  return s.substring(0, start) + middle + s.slice(-end);
}

export function addSuffixToFilePath(filePath: string, suffix: string, customExtension?: string, sanitize = false): string {
  const dirname = path.dirname(filePath);
  const ext = path.extname(filePath);
  const name = path.basename(filePath, ext);
  const base = path.join(dirname, name);
  return (sanitize ? sanitizeForFilePath(base) : base) + suffix + (customExtension || ext);
}

/**
 * Returns absolute path contained within parent directory.
 */
export function getContainedPath(parentPath: string, subPath: string = ''): string | null {
  const resolvedPath = path.resolve(parentPath, subPath);
  if (resolvedPath === parentPath || resolvedPath.startsWith(parentPath + path.sep)) return resolvedPath;
  return null;
}

export const debugTest = debug('pw:test');

export function callLogText(log: string[] | undefined): string {
  if (!log)
    return '';
  return `
Call log:
  ${colors.dim('- ' + (log || []).join('\n  - '))}
`;
}

export function currentExpectTimeout(options: { timeout?: number }) {
  const testInfo = currentTestInfo();
  if (options.timeout !== undefined)
    return options.timeout;
  let defaultExpectTimeout = testInfo?.project._expect?.timeout;
  if (typeof defaultExpectTimeout === 'undefined')
    defaultExpectTimeout = 5000;
  return defaultExpectTimeout;
}

const folderToPackageJsonPath = new Map<string, string>();

export function getPackageJsonPath(folderPath: string): string {
  const cached = folderToPackageJsonPath.get(folderPath);
  if (cached !== undefined)
    return cached;

  const packageJsonPath = path.join(folderPath, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    folderToPackageJsonPath.set(folderPath, packageJsonPath);
    return packageJsonPath;
  }

  const parentFolder = path.dirname(folderPath);
  if (folderPath === parentFolder) {
    folderToPackageJsonPath.set(folderPath, '');
    return '';
  }

  const result = getPackageJsonPath(parentFolder);
  folderToPackageJsonPath.set(folderPath, result);
  return result;
}

export async function normalizeAndSaveAttachment(outputPath: string, name: string, options: { path?: string, body?: string | Buffer, contentType?: string } = {}): Promise<{ name: string; path?: string | undefined; body?: Buffer | undefined; contentType: string; }>  {
  if ((options.path !== undefined ? 1 : 0) + (options.body !== undefined ? 1 : 0) !== 1)
    throw new Error(`Exactly one of "path" and "body" must be specified`);
  if (options.path !== undefined) {
    const hash = calculateSha1(options.path);

    if (!isString(name))
      throw new Error('"name" should be string.');

    const sanitizedNamePrefix = sanitizeForFilePath(name) + '-';
    const dest = path.join(outputPath, 'attachments', sanitizedNamePrefix + hash + path.extname(options.path));
    await fs.promises.mkdir(path.dirname(dest), { recursive: true });
    await fs.promises.copyFile(options.path, dest);
    const contentType = options.contentType ?? (mime.getType(path.basename(options.path)) || 'application/octet-stream');
    return { name, contentType, path: dest };
  } else {
    const contentType = options.contentType ?? (typeof options.body === 'string' ? 'text/plain' : 'application/octet-stream');
    return { name, contentType, body: typeof options.body === 'string' ? Buffer.from(options.body) : options.body };
  }
}
