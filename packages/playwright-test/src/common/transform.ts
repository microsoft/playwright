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
import { sourceMapSupport, pirates } from '../utilsBundle';
import url from 'url';
import type { Location } from './types';
import type { TsConfigLoaderResult } from '../third_party/tsconfig-loader';
import { tsConfigLoader } from '../third_party/tsconfig-loader';
import Module from 'module';
import type { BabelTransformFunction } from './babelBundle';
import { fileIsModule } from '../util';
import { getFromCompilationCache, currentFileDepsCollector, belongsToNodeModules } from './compilationCache';

type ParsedTsConfigData = {
  absoluteBaseUrl: string;
  paths: { key: string, values: string[] }[];
  allowJs: boolean;
};
const cachedTSConfigs = new Map<string, ParsedTsConfigData | undefined>();

function validateTsConfig(tsconfig: TsConfigLoaderResult): ParsedTsConfigData | undefined {
  if (!tsconfig.tsConfigPath || !tsconfig.baseUrl)
    return;
  // Make 'baseUrl' absolute, because it is relative to the tsconfig.json, not to cwd.
  const absoluteBaseUrl = path.resolve(path.dirname(tsconfig.tsConfigPath), tsconfig.baseUrl);
  const paths = tsconfig.paths || { '*': ['*'] };
  return {
    allowJs: tsconfig.allowJs,
    absoluteBaseUrl,
    paths: Object.entries(paths).map(([key, values]) => ({ key, values }))
  };
}

function loadAndValidateTsconfigForFile(file: string): ParsedTsConfigData | undefined {
  const cwd = path.dirname(file);
  if (!cachedTSConfigs.has(cwd)) {
    const loaded = tsConfigLoader({
      cwd
    });
    cachedTSConfigs.set(cwd, validateTsConfig(loaded));
  }
  return cachedTSConfigs.get(cwd);
}

const pathSeparator = process.platform === 'win32' ? ';' : ':';
const scriptPreprocessor = process.env.PW_TEST_SOURCE_TRANSFORM ?
  require(process.env.PW_TEST_SOURCE_TRANSFORM) : undefined;
const builtins = new Set(Module.builtinModules);

export function resolveHook(filename: string, specifier: string): string | undefined {
  if (specifier.startsWith('node:') || builtins.has(specifier))
    return;
  if (belongsToNodeModules(filename))
    return;

  if (isRelativeSpecifier(specifier))
    return js2ts(path.resolve(path.dirname(filename), specifier));

  const isTypeScript = filename.endsWith('.ts') || filename.endsWith('.tsx');
  const tsconfig = loadAndValidateTsconfigForFile(filename);
  if (tsconfig && (isTypeScript || tsconfig.allowJs)) {
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
        let candidate: string = value;

        if (value.includes('*'))
          candidate = candidate.replace('*', matchedPartOfSpecifier);
        candidate = path.resolve(tsconfig.absoluteBaseUrl, candidate.replace(/\//g, path.sep));
        const ts = js2ts(candidate);
        if (ts) {
          longestPrefixLength = keyPrefix.length;
          pathMatchedByLongestPrefix = ts;
        } else {
          for (const ext of ['', '.js', '.ts', '.mjs', '.cjs', '.jsx', '.tsx', '.cjs', '.mts', '.cts']) {
            if (fs.existsSync(candidate + ext)) {
              longestPrefixLength = keyPrefix.length;
              pathMatchedByLongestPrefix = candidate + ext;
            }
          }
        }
      }
    }
    if (pathMatchedByLongestPrefix)
      return pathMatchedByLongestPrefix;
  }

  return js2ts(path.resolve(path.dirname(filename), specifier));
}

export function js2ts(resolved: string): string | undefined {
  const match = resolved.match(/(.*)(\.js|\.jsx|\.mjs)$/);
  if (!match || fs.existsSync(resolved))
    return;
  const tsResolved = match[1] + match[2].replace('js', 'ts');
  if (fs.existsSync(tsResolved))
    return tsResolved;
  const tsxResolved = match[1] + match[2].replace('js', 'tsx');
  if (fs.existsSync(tsxResolved))
    return tsxResolved;
}

export function transformHook(code: string, filename: string, moduleUrl?: string): string {
  // If we are not TypeScript and there is no applicable preprocessor - bail out.
  const { cachedCode, addToCache } = getFromCompilationCache(filename, code, moduleUrl);
  if (cachedCode)
    return cachedCode;

  const isTypeScript = filename.endsWith('.ts') || filename.endsWith('.tsx');
  const hasPreprocessor =
      process.env.PW_TEST_SOURCE_TRANSFORM &&
      process.env.PW_TEST_SOURCE_TRANSFORM_SCOPE &&
      process.env.PW_TEST_SOURCE_TRANSFORM_SCOPE.split(pathSeparator).some(f => filename.startsWith(f));

  // We don't use any browserslist data, but babel checks it anyway.
  // Silence the annoying warning.
  process.env.BROWSERSLIST_IGNORE_OLD_DATA = 'true';

  try {
    const { babelTransform }: { babelTransform: BabelTransformFunction } = require('./babelBundle');
    const { code, map } = babelTransform(filename, isTypeScript, !!moduleUrl, hasPreprocessor ? scriptPreprocessor : undefined, [require.resolve('./tsxTransform')]);
    if (code)
      addToCache!(code, map);
    return code || '';
  } catch (e) {
    // Re-throw error with a playwright-test stack
    // that could be filtered out.
    throw new Error(e.message);
  }
}

export async function requireOrImport(file: string) {
  const revertBabelRequire = installTransform();
  const isModule = fileIsModule(file);
  try {
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
  } finally {
    revertBabelRequire();
  }
}

function installTransform(): () => void {
  let reverted = false;

  const originalResolveFilename = (Module as any)._resolveFilename;
  function resolveFilename(this: any, specifier: string, parent: Module, ...rest: any[]) {
    if (!reverted && parent) {
      const resolved = resolveHook(parent.filename, specifier);
      if (resolved !== undefined)
        specifier = resolved;
    }
    return originalResolveFilename.call(this, specifier, parent, ...rest);
  }
  (Module as any)._resolveFilename = resolveFilename;

  const revertPirates = pirates.addHook((code: string, filename: string) => {
    if (belongsToNodeModules(filename))
      return code;
    return transformHook(code, filename);
  }, { exts: ['.ts', '.tsx', '.js', '.jsx', '.mjs'] });

  return () => {
    reverted = true;
    (Module as any)._resolveFilename = originalResolveFilename;
    revertPirates();
  };
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
