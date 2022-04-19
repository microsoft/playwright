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
import os from 'os';
import path from 'path';
import fs from 'fs';
import { sourceMapSupport, pirates } from './utilsBundle';
import url from 'url';
import type { Location } from './types';
import type { TsConfigLoaderResult } from './third_party/tsconfig-loader';
import { tsConfigLoader } from './third_party/tsconfig-loader';
import Module from 'module';
import type { BabelTransformFunction } from './babelBundle';

const version = 8;
const cacheDir = process.env.PWTEST_CACHE_DIR || path.join(os.tmpdir(), 'playwright-transform-cache');
const sourceMaps: Map<string, string> = new Map();

type ParsedTsConfigData = {
  absoluteBaseUrl: string;
  paths: { key: string, values: string[] }[];
};
const cachedTSConfigs = new Map<string, ParsedTsConfigData | undefined>();

const kStackTraceLimit = 15;
Error.stackTraceLimit = kStackTraceLimit;

sourceMapSupport.install({
  environment: 'node',
  handleUncaughtExceptions: false,
  retrieveSourceMap(source) {
    if (!sourceMaps.has(source))
      return null;
    const sourceMapPath = sourceMaps.get(source)!;
    if (!fs.existsSync(sourceMapPath))
      return null;
    return {
      map: JSON.parse(fs.readFileSync(sourceMapPath, 'utf-8')),
      url: source
    };
  }
});

function calculateCachePath(content: string, filePath: string, isModule: boolean): string {
  const hash = crypto.createHash('sha1')
      .update(process.env.PW_TEST_SOURCE_TRANSFORM || '')
      .update(isModule ? 'esm' : 'no_esm')
      .update(content)
      .update(filePath)
      .update(String(version))
      .digest('hex');
  const fileName = path.basename(filePath, path.extname(filePath)).replace(/\W/g, '') + '_' + hash;
  return path.join(cacheDir, hash[0] + hash[1], fileName);
}

function validateTsConfig(tsconfig: TsConfigLoaderResult): ParsedTsConfigData | undefined {
  if (!tsconfig.tsConfigPath || !tsconfig.baseUrl)
    return;
  // Make 'baseUrl' absolute, because it is relative to the tsconfig.json, not to cwd.
  const absoluteBaseUrl = path.resolve(path.dirname(tsconfig.tsConfigPath), tsconfig.baseUrl);
  const paths = tsconfig.paths || { '*': ['*'] };
  return { absoluteBaseUrl, paths: Object.entries(paths).map(([key, values]) => ({ key, values })) };
}

function loadAndValidateTsconfigForFile(file: string): ParsedTsConfigData | undefined {
  const cwd = path.dirname(file);
  if (!cachedTSConfigs.has(cwd)) {
    const loaded = tsConfigLoader({
      getEnv: (name: string) => process.env[name],
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
  if (builtins.has(specifier))
    return;
  const isTypeScript = filename.endsWith('.ts') || filename.endsWith('.tsx');
  if (!isTypeScript)
    return;
  const tsconfig = loadAndValidateTsconfigForFile(filename);
  if (tsconfig) {
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

      for (const value of values) {
        let candidate: string = value;

        if (value.includes('*'))
          candidate = candidate.replace('*', matchedPartOfSpecifier);
        candidate = path.resolve(tsconfig.absoluteBaseUrl, candidate.replace(/\//g, path.sep));
        for (const ext of ['', '.js', '.ts', '.mjs', '.cjs', '.jsx', '.tsx']) {
          if (fs.existsSync(candidate + ext)) {
            if (keyPrefix.length > longestPrefixLength) {
              longestPrefixLength = keyPrefix.length;
              pathMatchedByLongestPrefix = candidate;
            }
          }
        }
      }
    }
    if (pathMatchedByLongestPrefix)
      return pathMatchedByLongestPrefix;
  }
  if (specifier.endsWith('.js')) {
    const resolved = path.resolve(path.dirname(filename), specifier);
    if (resolved.endsWith('.js')) {
      const tsResolved = resolved.substring(0, resolved.length - 3) + '.ts';
      if (!fs.existsSync(resolved) && fs.existsSync(tsResolved))
        return tsResolved;
    }
  }
}

export function transformHook(code: string, filename: string, isModule = false): string {
  if (isComponentImport(filename))
    return componentStub();

  // If we are not TypeScript and there is no applicable preprocessor - bail out.
  const isTypeScript = filename.endsWith('.ts') || filename.endsWith('.tsx');
  const hasPreprocessor =
      process.env.PW_TEST_SOURCE_TRANSFORM &&
      process.env.PW_TEST_SOURCE_TRANSFORM_SCOPE &&
      process.env.PW_TEST_SOURCE_TRANSFORM_SCOPE.split(pathSeparator).some(f => filename.startsWith(f));

  if (!isTypeScript && !hasPreprocessor)
    return code;

  const cachePath = calculateCachePath(code, filename, isModule);
  const codePath = cachePath + '.js';
  const sourceMapPath = cachePath + '.map';
  sourceMaps.set(filename, sourceMapPath);
  if (!process.env.PW_IGNORE_COMPILE_CACHE && fs.existsSync(codePath))
    return fs.readFileSync(codePath, 'utf8');
  // We don't use any browserslist data, but babel checks it anyway.
  // Silence the annoying warning.
  process.env.BROWSERSLIST_IGNORE_OLD_DATA = 'true';

  try {
    const { babelTransform }: { babelTransform: BabelTransformFunction } = require('./babelBundle');
    const result = babelTransform(filename, isTypeScript, isModule, hasPreprocessor ? scriptPreprocessor : undefined, [require.resolve('./tsxTransform')]);
    if (result.code) {
      fs.mkdirSync(path.dirname(cachePath), { recursive: true });
      if (result.map)
        fs.writeFileSync(sourceMapPath, JSON.stringify(result.map), 'utf8');
      fs.writeFileSync(codePath, result.code, 'utf8');
    }
    return result.code || '';
  } catch (e) {
    // Re-throw error with a playwright-test stack
    // that could be filtered out.
    throw new Error(e.message);
  }
}

export function installTransform(): () => void {
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

  const exts = ['.ts', '.tsx'];
  // When script preprocessor is engaged, we transpile JS as well.
  if (scriptPreprocessor)
    exts.push('.js', '.mjs');
  const revertPirates = pirates.addHook((code: string, filename: string) => transformHook(code, filename), { exts });

  return () => {
    reverted = true;
    (Module as any)._resolveFilename = originalResolveFilename;
    revertPirates();
  };
}

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
    Error.stackTraceLimit = 2;
    const obj: { stack: Location } = {} as any;
    Error.captureStackTrace(obj);
    const location = obj.stack;
    Error.stackTraceLimit = kStackTraceLimit;
    Error.prepareStackTrace = oldPrepareStackTrace;
    return func(location, ...args);
  };
}


let currentlyLoadingTestFile: string | null = null;

export function setCurrentlyLoadingTestFile(file: string | null) {
  currentlyLoadingTestFile = file;
}

function isComponentImport(filename: string): boolean {
  if (filename === currentlyLoadingTestFile)
    return false;
  return filename.endsWith('.tsx') || filename.endsWith('.jsx');
}

function componentStub(): string {
  return `module.exports = new Proxy({}, {
    get: (obj, prop) => prop
  });`;
}
