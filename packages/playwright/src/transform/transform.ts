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

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import url from 'url';
import { sourceMapSupport, pirates } from '../utilsBundle';
import type { Location } from '../../types/testReporter';
import type { LoadedTsConfig } from '../third_party/tsconfig-loader';
import { loadTsConfig } from '../third_party/tsconfig-loader';
import Module from 'module';
import type { BabelPlugin, BabelTransformFunction } from './babelBundle';
import { createFileMatcher, fileIsModule, resolveImportSpecifierAfterMapping } from '../util';
import type { Matcher } from '../util';
import { getFromCompilationCache, currentFileDepsCollector, belongsToNodeModules, installSourceMapSupport } from './compilationCache';

const version = require('../../package.json').version;

type ParsedTsConfigData = {
  pathsBase?: string;
  paths: { key: string, values: string[] }[];
  allowJs: boolean;
};
const cachedTSConfigs = new Map<string, ParsedTsConfigData[]>();

export type TransformConfig = {
  babelPlugins: [string, any?][];
  external: string[];
};

let _transformConfig: TransformConfig = {
  babelPlugins: [],
  external: [],
};

let _externalMatcher: Matcher = () => false;

export function setTransformConfig(config: TransformConfig) {
  _transformConfig = config;
  _externalMatcher = createFileMatcher(_transformConfig.external);
}

export function transformConfig(): TransformConfig {
  return _transformConfig;
}

let _singleTSConfigPath: string | undefined;
let _singleTSConfig: ParsedTsConfigData[] | undefined;

export function setSingleTSConfig(value: string | undefined) {
  _singleTSConfigPath = value;
}

export function singleTSConfig(): string | undefined {
  return _singleTSConfigPath;
}

function validateTsConfig(tsconfig: LoadedTsConfig): ParsedTsConfigData {
  // When no explicit baseUrl is set, resolve paths relative to the tsconfig file.
  // See https://www.typescriptlang.org/tsconfig#paths
  const pathsBase = tsconfig.absoluteBaseUrl ?? tsconfig.paths?.pathsBasePath;
  // Only add the catch-all mapping when baseUrl is specified
  const pathsFallback = tsconfig.absoluteBaseUrl ? [{ key: '*', values: ['*'] }] : [];
  return {
    allowJs: !!tsconfig.allowJs,
    pathsBase,
    paths: Object.entries(tsconfig.paths?.mapping || {}).map(([key, values]) => ({ key, values })).concat(pathsFallback)
  };
}

function loadAndValidateTsconfigsForFile(file: string): ParsedTsConfigData[] {
  if (_singleTSConfigPath && !_singleTSConfig)
    _singleTSConfig = loadTsConfig(_singleTSConfigPath).map(validateTsConfig);
  if (_singleTSConfig)
    return _singleTSConfig;
  return loadAndValidateTsconfigsForFolder(path.dirname(file));
}

function loadAndValidateTsconfigsForFolder(folder: string): ParsedTsConfigData[] {
  const foldersWithConfig: string[] = [];
  let currentFolder = path.resolve(folder);
  let result: ParsedTsConfigData[] | undefined;
  while (true) {
    const cached = cachedTSConfigs.get(currentFolder);
    if (cached) {
      result = cached;
      break;
    }

    foldersWithConfig.push(currentFolder);

    for (const name of ['tsconfig.json', 'jsconfig.json']) {
      const configPath = path.join(currentFolder, name);
      if (fs.existsSync(configPath)) {
        const loaded = loadTsConfig(configPath);
        result = loaded.map(validateTsConfig);
        break;
      }
    }
    if (result)
      break;

    const parentFolder = path.resolve(currentFolder, '../');
    if (currentFolder === parentFolder)
      break;
    currentFolder = parentFolder;
  }

  result = result || [];
  for (const folder of foldersWithConfig)
    cachedTSConfigs.set(folder, result);
  return result;
}

const pathSeparator = process.platform === 'win32' ? ';' : ':';
const builtins = new Set(Module.builtinModules);

export function resolveHook(filename: string, specifier: string): string | undefined {
  if (specifier.startsWith('node:') || builtins.has(specifier))
    return;
  if (!shouldTransform(filename))
    return;

  if (isRelativeSpecifier(specifier))
    return resolveImportSpecifierAfterMapping(path.resolve(path.dirname(filename), specifier), false);

  /**
   * TypeScript discourages path-mapping into node_modules:
   * https://www.typescriptlang.org/docs/handbook/modules/reference.html#paths-should-not-point-to-monorepo-packages-or-node_modules-packages
   * However, if path-mapping doesn't yield a result, TypeScript falls back to the default resolution through node_modules.
   */
  const isTypeScript = filename.endsWith('.ts') || filename.endsWith('.tsx');
  const tsconfigs = loadAndValidateTsconfigsForFile(filename);
  for (const tsconfig of tsconfigs) {
    if (!isTypeScript && !tsconfig.allowJs)
      continue;
    let longestPrefixLength = -1;
    let pathMatchedByLongestPrefix: string | undefined;

    for (const { key, values } of tsconfig.paths) {
      let matchedPartOfSpecifier = specifier;

      const [keyPrefix, keySuffix] = key.split('*');
      if (key.includes('*')) {
        // * If pattern contains '*' then to match pattern "<prefix>*<suffix>" module name must start with the <prefix> and end with <suffix>.
        // * <MatchedStar> denotes part of the module name between <prefix> and <suffix>.
        // * If module name can be matches with multiple patterns then pattern with the longest prefix will be picked.
        // https://github.com/microsoft/TypeScript/blob/f82d0cb3299c04093e3835bc7e29f5b40475f586/src/compiler/moduleNameResolver.ts#L1049
        if (keyPrefix) {
          if (!specifier.startsWith(keyPrefix))
            continue;
          matchedPartOfSpecifier = matchedPartOfSpecifier.substring(keyPrefix.length, matchedPartOfSpecifier.length);
        }
        if (keySuffix) {
          if (!specifier.endsWith(keySuffix))
            continue;
          matchedPartOfSpecifier = matchedPartOfSpecifier.substring(0, matchedPartOfSpecifier.length - keySuffix.length);
        }
      } else {
        if (specifier !== key)
          continue;
        matchedPartOfSpecifier = specifier;
      }

      if (keyPrefix.length <= longestPrefixLength)
        continue;

      for (const value of values) {
        let candidate = value;
        if (value.includes('*'))
          candidate = candidate.replace('*', matchedPartOfSpecifier);
        candidate = path.resolve(tsconfig.pathsBase!, candidate);
        const existing = resolveImportSpecifierAfterMapping(candidate, true);
        if (existing) {
          longestPrefixLength = keyPrefix.length;
          pathMatchedByLongestPrefix = existing;
        }
      }
    }
    if (pathMatchedByLongestPrefix)
      return pathMatchedByLongestPrefix;
  }

  if (path.isAbsolute(specifier)) {
    // Handle absolute file paths like `import '/path/to/file'`
    // Do not handle module imports like `import 'fs'`
    return resolveImportSpecifierAfterMapping(specifier, false);
  }
}

export function shouldTransform(filename: string): boolean {
  if (_externalMatcher(filename))
    return false;
  return !belongsToNodeModules(filename);
}

let transformData: Map<string, any>;

export function setTransformData(pluginName: string, value: any) {
  transformData.set(pluginName, value);
}

export function transformHook(originalCode: string, filename: string, moduleUrl?: string): { code: string, serializedCache?: any } {
  const isTypeScript = filename.endsWith('.ts') || filename.endsWith('.tsx') || filename.endsWith('.mts') || filename.endsWith('.cts');
  const hasPreprocessor =
      process.env.PW_TEST_SOURCE_TRANSFORM &&
      process.env.PW_TEST_SOURCE_TRANSFORM_SCOPE &&
      process.env.PW_TEST_SOURCE_TRANSFORM_SCOPE.split(pathSeparator).some(f => filename.startsWith(f));
  const pluginsPrologue = _transformConfig.babelPlugins;
  const pluginsEpilogue = hasPreprocessor ? [[process.env.PW_TEST_SOURCE_TRANSFORM!]] as BabelPlugin[] : [];
  const hash = calculateHash(originalCode, filename, !!moduleUrl, pluginsPrologue, pluginsEpilogue);
  const { cachedCode, addToCache, serializedCache } = getFromCompilationCache(filename, hash, moduleUrl);
  if (cachedCode !== undefined)
    return { code: cachedCode, serializedCache };

  // We don't use any browserslist data, but babel checks it anyway.
  // Silence the annoying warning.
  process.env.BROWSERSLIST_IGNORE_OLD_DATA = 'true';

  const { babelTransform }: { babelTransform: BabelTransformFunction } = require('./babelBundle');
  transformData = new Map<string, any>();
  const { code, map } = babelTransform(originalCode, filename, isTypeScript, !!moduleUrl, pluginsPrologue, pluginsEpilogue);
  if (!code)
    return { code: '', serializedCache };
  const added = addToCache!(code, map, transformData);
  return { code, serializedCache: added.serializedCache };
}

function calculateHash(content: string, filePath: string, isModule: boolean, pluginsPrologue: BabelPlugin[], pluginsEpilogue: BabelPlugin[]): string {
  const hash = crypto.createHash('sha1')
      .update(isModule ? 'esm' : 'no_esm')
      .update(content)
      .update(filePath)
      .update(version)
      .update(pluginsPrologue.map(p => p[0]).join(','))
      .update(pluginsEpilogue.map(p => p[0]).join(','))
      .digest('hex');
  return hash;
}

export async function requireOrImport(file: string) {
  installTransformIfNeeded();
  const isModule = fileIsModule(file);
  const esmImport = () => eval(`import(${JSON.stringify(url.pathToFileURL(file))})`);
  if (isModule)
    return await esmImport();
  const result = require(file);
  const depsCollector = currentFileDepsCollector();
  if (depsCollector) {
    const module = require.cache[file];
    if (module)
      collectCJSDependencies(module, depsCollector);
  }
  return result;
}

let transformInstalled = false;

function installTransformIfNeeded() {
  if (transformInstalled)
    return;
  transformInstalled = true;

  installSourceMapSupport();

  const originalResolveFilename = (Module as any)._resolveFilename;
  function resolveFilename(this: any, specifier: string, parent: Module, ...rest: any[]) {
    if (parent) {
      const resolved = resolveHook(parent.filename, specifier);
      if (resolved !== undefined)
        specifier = resolved;
    }
    return originalResolveFilename.call(this, specifier, parent, ...rest);
  }
  (Module as any)._resolveFilename = resolveFilename;

  pirates.addHook((code: string, filename: string) => {
    if (!shouldTransform(filename))
      return code;
    return transformHook(code, filename).code;
  }, { exts: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.mts', '.cjs', '.cts'] });
}

const collectCJSDependencies = (module: Module, dependencies: Set<string>) => {
  module.children.forEach(child => {
    if (!belongsToNodeModules(child.filename) && !dependencies.has(child.filename)) {
      dependencies.add(child.filename);
      collectCJSDependencies(child, dependencies);
    }
  });
};

export function wrapFunctionWithLocation<A extends any[], R>(func: (location: Location, ...args: A) => R): (...args: A) => R {
  return (...args) => {
    const oldPrepareStackTrace = Error.prepareStackTrace;
    Error.prepareStackTrace = (error, stackFrames) => {
      const frame: NodeJS.CallSite = sourceMapSupport.wrapCallSite(stackFrames[1]);
      const fileName = frame.getFileName();
      // Node error stacks for modules use file:// urls instead of paths.
      const file = (fileName && fileName.startsWith('file://')) ? url.fileURLToPath(fileName) : fileName;
      return {
        file,
        line: frame.getLineNumber(),
        column: frame.getColumnNumber(),
      };
    };
    const oldStackTraceLimit = Error.stackTraceLimit;
    Error.stackTraceLimit = 2;
    const obj: { stack: Location } = {} as any;
    Error.captureStackTrace(obj);
    const location = obj.stack;
    Error.stackTraceLimit = oldStackTraceLimit;
    Error.prepareStackTrace = oldPrepareStackTrace;
    return func(location, ...args);
  };
}

function isRelativeSpecifier(specifier: string) {
  return specifier === '.' || specifier === '..' || specifier.startsWith('./') || specifier.startsWith('../');
}
