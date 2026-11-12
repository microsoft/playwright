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
import util from 'util';

import debug from 'debug';
import mime from 'mime';
import { minimatch } from 'minimatch';
import { calculateSha1 } from '@utils/crypto';
import { sanitizeForFilePath } from '@utils/fileUtils';
import { isRegExp } from '@isomorphic/rtti';
import { stringifyStackFrames, filteredStackTrace } from '@utils/stackTrace';
import { ansiRegex, isString, stripAnsiEscapes } from '@isomorphic/stringUtils';

import type { Location } from './../types/testReporter';
import type { TestInfoError } from './../types/test';
import type { TestCase } from './common/test';

export function filterStackTrace(e: Error): TestInfoError {
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

export function serializeError(error: Error | any): TestInfoError {
  if (error instanceof Error)
    return filterStackTrace(error);
  return {
    value: util.inspect(error)
  };
}

export type Matcher = (value: string) => boolean;
export type TestCaseFilter = (test: TestCase) => boolean;

export function parseLocationArg(arg: string): { file: string, line: number | null, column: number | null } {
  const match = /^(.*?):(\d+):?(\d+)?$/.exec(arg);
  return {
    file: match ? match[1] : arg,
    line: match ? parseInt(match[2], 10) : null,
    column: match?.[3] ? parseInt(match[3], 10) : null,
  };
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
    // Check against the forward-slash form as well.
    if (path.sep === '\\') {
      const unixPath = filePath.split(path.sep).join('/');
      for (const re of reList) {
        re.lastIndex = 0;
        if (re.test(unixPath))
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

export function expectTypes(receiver: any, types: ('APIResponse' | 'Page' | 'Locator')[], matcherName: string) {
  if (typeof receiver !== 'object' || !types.includes(receiver._apiName)) {
    const receiverString = typeof receiver === 'object' && receiver !== null ? `${receiver.constructor.name} ${util.inspect(receiver)}` : String(receiver);
    const commaSeparated = types.slice();
    const lastType = commaSeparated.pop();
    const typesString = commaSeparated.length ? commaSeparated.join(', ') + ' or ' + lastType : lastType;
    throw new Error(`${matcherName} can be only used with ${typesString} object${types.length > 1 ? 's' : ''}, was called with ${receiverString}`);
  }
}

export const windowsFilesystemFriendlyLength = 60;

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
  return readPackageJson(packageJsonPath).type === 'module';
}

const packageJsonCache = new Map<string, any>();

// Note: do not `require()` the package.json here to avoid running
// our resolve hook from inside itself.
function readPackageJson(packageJsonPath: string): any {
  if (!packageJsonCache.has(packageJsonPath)) {
    let json: any = {};
    try {
      json = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) ?? {};
    } catch {
    }
    packageJsonCache.set(packageJsonPath, json);
  }
  return packageJsonCache.get(packageJsonPath);
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
function resolveImportSpecifierExtension(resolved: string, implicitExtension = true): string | undefined {
  if (fileExists(resolved))
    return resolved;

  for (const [ext, others] of kExtLookups) {
    if (!resolved.endsWith(ext))
      continue;
    if (!ext && !implicitExtension)
      return;
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
      const mainField: string | undefined = readPackageJson(packageJsonPath).main;
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

type SubpathImportTarget = string | null | SubpathImportTarget[] | { [condition: string]: SubpathImportTarget };

function matchSubpathImportPattern(key: string, specifier: string): string | undefined {
  const [prefix, suffix, ...rest] = key.split('*');
  if (suffix === undefined || rest.length || specifier.length < key.length || !specifier.startsWith(prefix) || !specifier.endsWith(suffix))
    return;
  return specifier.substring(prefix.length, specifier.length - suffix.length);
}

function flattenSubpathImportTarget(target: SubpathImportTarget, conditions: Set<string>): string[] | null {
  if (typeof target === 'string')
    return [target];
  if (target === null)
    return null;
  const entries = Array.isArray(target) ? target : Object.entries(target).filter(([condition]) => condition === 'default' || conditions.has(condition)).map(([, value]) => value);
  const result: string[] = [];
  for (const entry of entries) {
    const flat = flattenSubpathImportTarget(entry, conditions);
    if (flat === null)
      return result.length ? result : null;
    result.push(...flat);
  }
  return result;
}

const kInvalidSubpathImportSegment = /(^|[\\/])(\.\.?|node_modules)([\\/]|$)/i;

// Like tsc, list every target of the matching subpath import: existing local files as absolute paths, packages as bare specifiers.
export function* resolveSubpathImportCandidates(filename: string, specifier: string, conditions: Set<string>): Generator<string> {
  const packageJsonPath = getPackageJsonPath(path.dirname(filename));
  const imports: { [key: string]: SubpathImportTarget } | undefined = packageJsonPath ? readPackageJson(packageJsonPath).imports : undefined;
  if (!imports)
    return;

  const match = Object.hasOwn(imports, specifier) ? { key: specifier, subpath: undefined } : Object.keys(imports)
      .map(key => ({ key, subpath: matchSubpathImportPattern(key, specifier) }))
      .filter(match => match.subpath !== undefined)
      .sort((a, b) => b.key.indexOf('*') - a.key.indexOf('*') || b.key.length - a.key.length)[0];
  if (!match || (match.subpath !== undefined && kInvalidSubpathImportSegment.test(match.subpath)))
    return;

  for (const target of flattenSubpathImportTarget(imports[match.key], conditions) ?? []) {
    if (target.startsWith('../') || target.startsWith('/'))
      continue;
    const mapped = match.subpath === undefined ? target : target.replaceAll('*', () => match.subpath!);
    if (!target.startsWith('./')) {
      yield mapped;
      continue;
    }
    if (kInvalidSubpathImportSegment.test(target.substring(2)))
      continue;
    const resolved = resolveImportSpecifierExtension(path.resolve(path.dirname(packageJsonPath), mapped), false);
    if (resolved)
      yield resolved;
  }
}

function fileExists(resolved: string) {
  try {
    return fs.statSync(resolved, { throwIfNoEntry: false })?.isFile();
  } catch {
    return false;
  }
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
  try {
    return fs.statSync(resolved, { throwIfNoEntry: false })?.isDirectory();
  } catch {
    return false;
  }
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

export function takeFirst<T>(...args: (T | undefined)[]): T {
  for (const arg of args) {
    if (arg !== undefined)
      return arg;
  }
  return undefined as any as T;
}

export { ansiRegex, stripAnsiEscapes };
