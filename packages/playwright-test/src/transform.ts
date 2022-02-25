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

import * as crypto from 'crypto';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import * as pirates from 'pirates';
import * as sourceMapSupport from 'source-map-support';
import * as url from 'url';
import type { Location } from './types';
import { tsConfigLoader, TsConfigLoaderResult } from './third_party/tsconfig-loader';
import Module from 'module';

const version = 7;
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

function calculateCachePath(content: string, filePath: string): string {
  const hash = crypto.createHash('sha1')
      .update(process.env.PW_TEST_SOURCE_TRANSFORM || '')
      .update(process.env.PW_EXPERIMENTAL_TS_ESM ? 'esm' : 'no_esm')
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
  if (!tsconfig)
    return;
  for (const { key, values } of tsconfig.paths) {
    const keyHasStar = key[key.length - 1] === '*';
    const matches = specifier.startsWith(keyHasStar ? key.substring(0, key.length - 1) : key);
    if (!matches)
      continue;
    for (const value of values) {
      const valueHasStar = value[value.length - 1] === '*';
      let candidate = valueHasStar ? value.substring(0, value.length - 1) : value;
      if (valueHasStar && keyHasStar)
        candidate += specifier.substring(key.length - 1);
      candidate = path.resolve(tsconfig.absoluteBaseUrl, candidate.replace(/\//g, path.sep));
      for (const ext of ['', '.js', '.ts', '.mjs', '.cjs', '.jsx', '.tsx']) {
        if (fs.existsSync(candidate + ext))
          return candidate;
      }
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

  const cachePath = calculateCachePath(code, filename);
  const codePath = cachePath + '.js';
  const sourceMapPath = cachePath + '.map';
  sourceMaps.set(filename, sourceMapPath);
  if (!process.env.PW_IGNORE_COMPILE_CACHE && fs.existsSync(codePath))
    return fs.readFileSync(codePath, 'utf8');
  // We don't use any browserslist data, but babel checks it anyway.
  // Silence the annoying warning.
  process.env.BROWSERSLIST_IGNORE_OLD_DATA = 'true';
  const babel: typeof import('@babel/core') = require('@babel/core');
  const plugins = [];

  if (isTypeScript) {
    plugins.push(
        [require.resolve('@babel/plugin-proposal-class-properties')],
        [require.resolve('@babel/plugin-proposal-numeric-separator')],
        [require.resolve('@babel/plugin-proposal-logical-assignment-operators')],
        [require.resolve('@babel/plugin-proposal-nullish-coalescing-operator')],
        [require.resolve('@babel/plugin-proposal-optional-chaining')],
        [require.resolve('@babel/plugin-proposal-private-methods')],
        [require.resolve('@babel/plugin-syntax-json-strings')],
        [require.resolve('@babel/plugin-syntax-optional-catch-binding')],
        [require.resolve('@babel/plugin-syntax-async-generators')],
        [require.resolve('@babel/plugin-syntax-object-rest-spread')],
        [require.resolve('@babel/plugin-proposal-export-namespace-from')]
    );

    if (!isModule) {
      plugins.push([require.resolve('@babel/plugin-transform-modules-commonjs')]);
      plugins.push([require.resolve('@babel/plugin-proposal-dynamic-import')]);
    }
  }

  plugins.unshift([require.resolve('./tsxTransform')]);

  if (hasPreprocessor)
    plugins.push([scriptPreprocessor]);

  try {
    const result = babel.transformFileSync(filename, {
      babelrc: false,
      configFile: false,
      assumptions: {
        // Without this, babel defines a top level function that
        // breaks playwright evaluates.
        setPublicClassFields: true,
      },
      presets: [
        [require.resolve('@babel/preset-typescript'), { onlyRemoveTypeImports: true }],
      ],
      plugins,
      sourceMaps: 'both',
    } as babel.TransformOptions)!;
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
