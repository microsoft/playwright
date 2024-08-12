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
import path from 'path';
import url from 'url';
import { sourceMapSupport, pirates } from '../utilsBundle';
import type { Location } from '../../types/testReporter';
import type { LoadedTsConfig } from '../third_party/tsconfig-loader';
import { tsConfigLoader } from '../third_party/tsconfig-loader';
import Module from 'module';
import type { BabelPlugin, BabelTransformFunction } from './babelBundle';
import { createFileMatcher, fileIsModule, resolveImportSpecifierExtension } from '../util';
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

let _singleTSConfig: string | undefined;

export function setSingleTSConfig(value: string | undefined) {
  _singleTSConfig = value;
}

export function singleTSConfig(): string | undefined {
  return _singleTSConfig;
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
  const tsconfigPathOrDirecotry = _singleTSConfig || path.dirname(file);
  if (!cachedTSConfigs.has(tsconfigPathOrDirecotry)) {
    const loaded = tsConfigLoader(tsconfigPathOrDirecotry);
    cachedTSConfigs.set(tsconfigPathOrDirecotry, loaded.map(validateTsConfig));
  }
  return cachedTSConfigs.get(tsconfigPathOrDirecotry)!;
}

const pathSeparator = process.platform === 'win32' ? ';' : ':';
const builtins = new Set(Module.builtinModules);

export function resolveHook(filename: string, specifier: string, isESM: boolean): string | undefined {
  if (specifier.startsWith('node:') || builtins.has(specifier))
    return;
  if (!shouldTransform(filename))
    return;

  if (isRelativeSpecifier(specifier))
    return resolveImportSpecifierExtension(path.resolve(path.dirname(filename), specifier), false, isESM);

  /**
   * TypeScript discourages path-mapping into node_modules
   *    (https://www.typescriptlang.org/docs/handbook/modules/reference.html#paths-should-not-point-to-monorepo-packages-or-node_modules-packages).
   * It seems like TypeScript tries path-mapping first, but does not look at the `package.json` or `index.js` files in ESM.
   * If path-mapping doesn't yield a result, TypeScript falls back to the default resolution (typically node_modules).
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
        const existing = resolveImportSpecifierExtension(candidate, true, isESM);
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
    return resolveImportSpecifierExtension(specifier, false, isESM);
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
      const resolved = resolveHook(parent.filename, specifier, false);
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
