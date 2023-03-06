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
import { mime } from 'playwright-core/lib/utilsBundle';
import type { StackFrame } from '@protocol/channels';
import util from 'util';
import path from 'path';
import url from 'url';
import { colors, debug, minimatch, parseStackTraceLine } from 'playwright-core/lib/utilsBundle';
import type { TestInfoError, Location } from './common/types';
import { calculateSha1, isRegExp, isString } from 'playwright-core/lib/utils';
import type { RawStack } from 'playwright-core/lib/utils';

const PLAYWRIGHT_TEST_PATH = path.join(__dirname, '..');
const PLAYWRIGHT_CORE_PATH = path.dirname(require.resolve('playwright-core/package.json'));

export function filterStackTrace(e: Error) {
  if (process.env.PWDEBUGIMPL)
    return;
  const stackLines = stringifyStackFrames(filteredStackTrace(e.stack?.split('\n') || []));
  const message = e.message;
  e.stack = `${e.name}: ${e.message}\n${stackLines.join('\n')}`;
  e.message = message;
}

export function filteredStackTrace(rawStack: RawStack): StackFrame[] {
  const frames: StackFrame[] = [];
  for (const line of rawStack) {
    const frame = parseStackTraceLine(line);
    if (!frame || !frame.file)
      continue;
    if (!process.env.PWDEBUGIMPL && frame.file.startsWith(PLAYWRIGHT_TEST_PATH))
      continue;
    if (!process.env.PWDEBUGIMPL && frame.file.startsWith(PLAYWRIGHT_CORE_PATH))
      continue;
    frames.push(frame);
  }
  return frames;
}

export function stringifyStackFrames(frames: StackFrame[]): string[] {
  const stackLines: string[] = [];
  for (const frame of frames) {
    if (frame.function)
      stackLines.push(`    at ${frame.function} (${frame.file}:${frame.line}:${frame.column})`);
    else
      stackLines.push(`    at ${frame.file}:${frame.line}:${frame.column}`);
  }
  return stackLines;
}

export function serializeError(error: Error | any): TestInfoError {
  if (error instanceof Error) {
    filterStackTrace(error);
    return {
      message: error.message,
      stack: error.stack
    };
  }
  return {
    value: util.inspect(error)
  };
}

export type Matcher = (value: string) => boolean;

export type TestFileFilter = {
  re?: RegExp;
  exact?: string;
  line: number | null;
  column: number | null;
};

export function createFileFiltersFromArguments(args: string[]): TestFileFilter[] {
  return args.map(arg => {
    const match = /^(.*?):(\d+):?(\d+)?$/.exec(arg);
    return {
      re: forceRegExp(match ? match[1] : arg),
      line: match ? parseInt(match[2], 10) : null,
      column: match?.[3] ? parseInt(match[3], 10) : null,
    };
  });
}

export function createFileMatcherFromArguments(args: string[]): Matcher {
  const filters = createFileFiltersFromArguments(args);
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
  return new RegExp(pattern, 'gi');
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

export function fileIsModule(file: string): boolean {
  if (file.endsWith('.mjs'))
    return true;

  const folder = path.dirname(file);
  return folderIsModule(folder);
}

export function folderIsModule(folder: string): boolean {
  const packageJsonPath = getPackageJsonPath(folder);
  if (!packageJsonPath)
    return false;
  // Rely on `require` internal caching logic.
  return require(packageJsonPath).type === 'module';
}

export function experimentalLoaderOption() {
  return ` --no-warnings --experimental-loader=${url.pathToFileURL(require.resolve('@playwright/test/lib/experimentalLoader')).toString()}`;
}

export function envWithoutExperimentalLoaderOptions(): NodeJS.ProcessEnv {
  const substring = experimentalLoaderOption();
  const result = { ...process.env };
  if (result.NODE_OPTIONS)
    result.NODE_OPTIONS = result.NODE_OPTIONS.replace(substring, '').trim() || undefined;
  return result;
}
