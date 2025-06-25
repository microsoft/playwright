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
import url from 'url';
import util from 'util';

import { parseStackFrame, sanitizeForFilePath, calculateSha1, isRegExp, isString, stringifyStackFrames, escapeWithQuotes } from 'playwright-core/lib/utils';
import { colors, debug, mime, minimatch } from 'playwright-core/lib/utilsBundle';

import type { Location } from './../types/testReporter';
import type { TestInfoErrorImpl } from './common/ipc';
import type { StackFrame } from '@protocol/channels';
import type { RawStack } from 'playwright-core/lib/utils';

const PLAYWRIGHT_TEST_PATH = path.join(__dirname, '..');
const PLAYWRIGHT_CORE_PATH = path.dirname(require.resolve('playwright-core/package.json'));

export function filterStackTrace(e: Error): { message: string, stack: string, cause?: ReturnType<typeof filterStackTrace> } {
  const name = e.name ? e.name + ': ' : '';
  const cause = e.cause instanceof Error ? filterStackTrace(e.cause) : undefined;
  if (process.env.PWDEBUGIMPL)
    return { message: name + e.message, stack: e.stack || '', cause };

  const stackLines = stringifyStackFrames(filteredStackTrace(e.stack?.split('\n') || []));
  return {
    message: name + e.message,
    stack: `${name}${e.message}${stackLines.map(line => '\n' + line).join('')}`,
    cause,
  };
}

export function filterStackFile(file: string) {
  if (!process.env.PWDEBUGIMPL && file.startsWith(PLAYWRIGHT_TEST_PATH))
    return false;
  if (!process.env.PWDEBUGIMPL && file.startsWith(PLAYWRIGHT_CORE_PATH))
    return false;
  return true;
}

export function filteredStackTrace(rawStack: RawStack): StackFrame[] {
  const frames: StackFrame[] = [];
  for (const line of rawStack) {
    const frame = parseStackFrame(line, path.sep, !!process.env.PWDEBUGIMPL);
    if (!frame || !frame.file)
      continue;
    if (!filterStackFile(frame.file))
      continue;
    frames.push(frame);
  }
  return frames;
}

export function serializeError(error: Error | any): TestInfoErrorImpl {
  if (error instanceof Error)
    return filterStackTrace(error);
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

export function mergeObjects<A extends object, B extends object, C extends object>(a: A | undefined | void, b: B | undefined | void, c: C | undefined | void): A & B & C {
  const result = { ...a } as any;
  for (const x of [b, c].filter(Boolean)) {
    for (const [name, value] of Object.entries(x as any)) {
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

export const windowsFilesystemFriendlyLength = 60;

export function trimLongString(s: string, length = 100) {
  if (s.length <= length)
    return s;
  const hash = calculateSha1(s);
  const middle = `-${hash.substring(0, 5)}-`;
  const start = Math.floor((length - middle.length) / 2);
  const end = length - middle.length - start;
  return s.substring(0, start) + middle + s.slice(-end);
}

export function addSuffixToFilePath(filePath: string, suffix: string): string {
  const ext = path.extname(filePath);
  const base = filePath.substring(0, filePath.length - ext.length);
  return base + suffix + ext;
}

export function sanitizeFilePathBeforeExtension(filePath: string, ext?: string): string {
  ext ??= path.extname(filePath);
  const base = filePath.substring(0, filePath.length - ext.length);
  return sanitizeForFilePath(base) + ext;
}

/**
 * Returns absolute path contained within parent directory.
 */
export function getContainedPath(parentPath: string, subPath: string = ''): string | null {
  const resolvedPath = path.resolve(parentPath, subPath);
  if (resolvedPath === parentPath || resolvedPath.startsWith(parentPath + path.sep))
    return resolvedPath;
  return null;
}

export const debugTest = debug('pw:test');

export const callLogText = (log: string[] | undefined) => {
  if (!log || !log.some(l => !!l))
    return '';
  return `
Call log:
${colors.dim(log.join('\n'))}
`;
};

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

export function resolveReporterOutputPath(defaultValue: string, configDir: string, configValue: string | undefined) {
  if (configValue)
    return path.resolve(configDir, configValue);
  let basePath = getPackageJsonPath(configDir);
  basePath = basePath ? path.dirname(basePath) : process.cwd();
  return path.resolve(basePath, defaultValue);
}

export async function normalizeAndSaveAttachment(outputPath: string, name: string, options: { path?: string, body?: string | Buffer, contentType?: string } = {}): Promise<{ name: string; path?: string; body?: Buffer; contentType: string; }> {
  if (options.path === undefined && options.body === undefined)
    return { name, contentType: 'text/plain' };
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
  if (file.endsWith('.mjs') || file.endsWith('.mts'))
    return true;
  if (file.endsWith('.cjs') || file.endsWith('.cts'))
    return false;
  const folder = path.dirname(file);
  return folderIsModule(folder);
}

function folderIsModule(folder: string): boolean {
  const packageJsonPath = getPackageJsonPath(folder);
  if (!packageJsonPath)
    return false;
  // Rely on `require` internal caching logic.
  return require(packageJsonPath).type === 'module';
}

const packageJsonMainFieldCache = new Map<string, string | undefined>();

function getMainFieldFromPackageJson(packageJsonPath: string) {
  if (!packageJsonMainFieldCache.has(packageJsonPath)) {
    let mainField: string | undefined;
    try {
      mainField = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')).main;
    } catch {
    }
    packageJsonMainFieldCache.set(packageJsonPath, mainField);
  }
  return packageJsonMainFieldCache.get(packageJsonPath);
}

// This method performs "file extension subsitution" to find the ts, js or similar source file
// based on the import specifier, which might or might not have an extension. See TypeScript docs:
// https://www.typescriptlang.org/docs/handbook/modules/reference.html#file-extension-substitution.
const kExtLookups = new Map([
  ['.js', ['.jsx', '.ts', '.tsx']],
  ['.jsx', ['.tsx']],
  ['.cjs', ['.cts']],
  ['.mjs', ['.mts']],
  ['', ['.js', '.ts', '.jsx', '.tsx', '.cjs', '.mjs', '.cts', '.mts']],
]);
function resolveImportSpecifierExtension(resolved: string): string | undefined {
  if (fileExists(resolved))
    return resolved;

  for (const [ext, others] of kExtLookups) {
    if (!resolved.endsWith(ext))
      continue;
    for (const other of others) {
      const modified = resolved.substring(0, resolved.length - ext.length) + other;
      if (fileExists(modified))
        return modified;
    }
    break;  // Do not try '' when a more specific extension like '.jsx' matched.
  }
}

// This method resolves directory imports and performs "file extension subsitution".
// It is intended to be called after the path mapping resolution.
//
// Directory imports follow the --moduleResolution=bundler strategy from tsc.
// https://www.typescriptlang.org/docs/handbook/modules/reference.html#directory-modules-index-file-resolution
// https://www.typescriptlang.org/docs/handbook/modules/reference.html#bundler
//
// See also Node.js "folder as module" behavior:
// https://nodejs.org/dist/latest-v20.x/docs/api/modules.html#folders-as-modules.
export function resolveImportSpecifierAfterMapping(resolved: string, afterPathMapping: boolean): string | undefined {
  const resolvedFile = resolveImportSpecifierExtension(resolved);
  if (resolvedFile)
    return resolvedFile;

  if (dirExists(resolved)) {
    const packageJsonPath = path.join(resolved, 'package.json');

    if (afterPathMapping) {
      // Most notably, the module resolution algorithm is not performed after the path mapping.
      // This means no node_modules lookup or package.json#exports.
      //
      // Only the "folder as module" Node.js behavior is respected:
      //  - consult `package.json#main`;
      //  - look for `index.js` or similar.
      const mainField = getMainFieldFromPackageJson(packageJsonPath);
      const mainFieldResolved = mainField ? resolveImportSpecifierExtension(path.resolve(resolved, mainField)) : undefined;
      return mainFieldResolved || resolveImportSpecifierExtension(path.join(resolved, 'index'));
    }

    // If we import a package, let Node.js figure out the correct import based on package.json.
    // This also covers the "main" field for "folder as module".
    if (fileExists(packageJsonPath))
      return resolved;

    // Implement the "folder as module" Node.js behavior.
    // Note that we do not delegate to Node.js, because we support this for ESM as well,
    // following the TypeScript "bundler" mode.
    const dirImport = path.join(resolved, 'index');
    return resolveImportSpecifierExtension(dirImport);
  }
}

function fileExists(resolved: string) {
  return fs.statSync(resolved, { throwIfNoEntry: false })?.isFile();
}

export async function fileExistsAsync(resolved: string) {
  try {
    const stat = await fs.promises.stat(resolved);
    return stat.isFile();
  } catch {
    return false;
  }
}

function dirExists(resolved: string) {
  return fs.statSync(resolved, { throwIfNoEntry: false })?.isDirectory();
}

export async function removeDirAndLogToConsole(dir: string) {
  try {
    if (!fs.existsSync(dir))
      return;
    // eslint-disable-next-line no-console
    console.log(`Removing ${await fs.promises.realpath(dir)}`);
    await fs.promises.rm(dir, { recursive: true, force: true });
  } catch {
  }
}

export const ansiRegex = new RegExp('([\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:[a-zA-Z\\d]*(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)|(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-ntqry=><~])))', 'g');
export function stripAnsiEscapes(str: string): string {
  return str.replace(ansiRegex, '');
}

export type TestStepCategory = 'expect' | 'fixture' | 'hook' | 'pw:api' | 'test.step' | 'test.attach';

export function stepTitle(category: TestStepCategory, title: string): string {
  switch (category) {
    case 'fixture':
      return `Fixture ${escapeWithQuotes(title, '"')}`;
    case 'expect':
      return `Expect ${escapeWithQuotes(title, '"')}`;
    case 'test.step':
      return title;
    case 'test.attach':
      return `Attach ${escapeWithQuotes(title, '"')}`;
    case 'hook':
    case 'pw:api':
      return title;
    default:
      return `[${category}] ${title}`;
  }
}
