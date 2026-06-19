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
import Module from 'module';
import path from 'path';
import url from 'url';
import crypto from 'crypto';
import sourceMapSupport from 'source-map-support';
import { loadTsConfig } from './tsconfig-loader';
import { libPath, packageJSON } from '../package';
import { createFileMatcher, debugTest, fileIsModule, resolveImportSpecifierAfterMapping } from '../util';
import * as cc from './compilationCache';
import * as esmLoaderSync from './esmLoaderSync';
import { addHook } from './pirates';
import { PortTransport } from './portTransport';

import type { BabelPlugin, BabelTransformFunction } from './babelBundle';
import type { Location } from '../../types/testReporter';
import type { LoadedTsConfig } from './tsconfig-loader';
import type { Matcher } from '../util';


const version = packageJSON.version;

type ParsedTsConfigData = {
  pathsBase?: string;
  paths: { key: string, values: string[] }[];
  allowJs: boolean;
};
const cachedTSConfigs = new Map<string, ParsedTsConfigData[]>();

export type TransformConfig = {
  babelPlugins: [string, any?][];
  external: string[];
  jsxImportSource?: string;
};

let _transformConfig: TransformConfig = {
  babelPlugins: [],
  external: [],
};

let _externalMatcher: Matcher = () => false;

export async function setTransformConfig(config: TransformConfig) {
  _transformConfig = config;
  _externalMatcher = createFileMatcher(_transformConfig.external);
  if (loaderChannel)
    await loaderChannel.send('setTransformConfig', { config });
}

let _singleTSConfigPath: string | undefined;
let _singleTSConfig: ParsedTsConfigData[] | undefined;

export async function setSingleTSConfig(value: string | undefined) {
  _singleTSConfigPath = value;
  if (loaderChannel)
    await loaderChannel.send('setSingleTSConfig', { tsconfig: value });
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

function resolvePackageSubpathImport(filename: string, specifier: string): string | undefined {
  if (specifier.startsWith('#'))
    return;

  const tokens = specifier.split('/');
  const packageName = specifier.startsWith('@') ? tokens.slice(0, 2).join('/') : tokens[0];
  const subpath = specifier.startsWith('@') ? tokens.slice(2).join('/') : tokens.slice(1).join('/');
  if (!packageName || !subpath)
    return;

  let currentFolder = path.dirname(filename);
  while (true) {
    const packageJsonPath = path.join(currentFolder, 'node_modules', packageName, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = readPackageJson(packageJsonPath);
      if (!packageJson)
        return;
      if (packageJson.exports !== undefined)
        return;
      const resolved = resolveImportSpecifierAfterMapping(path.join(path.dirname(packageJsonPath), subpath), true);
      return resolved ? fs.realpathSync(resolved) : undefined;
    }

    const parentFolder = path.dirname(currentFolder);
    if (currentFolder === parentFolder)
      break;
    currentFolder = parentFolder;
  }
}

type PackageJsonWithExports = {
  exports?: unknown;
};

const packageJsonCache = new Map<string, PackageJsonWithExports | undefined>();

function readPackageJson(packageJsonPath: string): PackageJsonWithExports | undefined {
  if (!packageJsonCache.has(packageJsonPath)) {
    let packageJson;
    try {
      packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    } catch {
    }
    packageJsonCache.set(packageJsonPath, packageJson);
  }
  return packageJsonCache.get(packageJsonPath);
}

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

  const packageSubpath = resolvePackageSubpathImport(filename, specifier);
  if (packageSubpath)
    return packageSubpath;

  if (path.isAbsolute(specifier)) {
    // Handle absolute file paths like `import '/path/to/file'`
    // Do not handle module imports like `import 'fs'`
    return resolveImportSpecifierAfterMapping(specifier, false);
  }
}

export function shouldTransform(filename: string): boolean {
  if (_externalMatcher(filename))
    return false;
  return !cc.belongsToNodeModules(filename);
}

let transformData: Map<string, any>;

export function setTransformData(pluginName: string, value: any) {
  transformData.set(pluginName, value);
}

export function transformHook(originalCode: string, filename: string, moduleUrl?: string): { code: string, serializedCache?: any } {
  const hasPreprocessor =
    process.env.PW_TEST_SOURCE_TRANSFORM &&
    process.env.PW_TEST_SOURCE_TRANSFORM_SCOPE &&
    process.env.PW_TEST_SOURCE_TRANSFORM_SCOPE.split(pathSeparator).some(f => filename.startsWith(f));
  const pluginsPrologue = _transformConfig.babelPlugins;
  const pluginsEpilogue = hasPreprocessor ? [[process.env.PW_TEST_SOURCE_TRANSFORM!]] as BabelPlugin[] : [];
  const hash = calculateHash(originalCode, filename, !!moduleUrl, pluginsPrologue, pluginsEpilogue);
  const { cachedCode, addToCache, serializedCache } = cc.getFromCompilationCache(filename, hash, moduleUrl);
  if (cachedCode !== undefined)
    return { code: cachedCode, serializedCache };

  // We don't use any browserslist data, but babel checks it anyway.
  // Silence the annoying warning.
  process.env.BROWSERSLIST_IGNORE_OLD_DATA = 'true';

  const { babelTransform }: { babelTransform: BabelTransformFunction } = require(libPath('transform', 'babelBundle'));
  transformData = new Map<string, any>();
  // Pass `setTransformData` to plugins via plugin options instead of having
  // them import it. The bundled esmLoader inlines its own copy of this file,
  // so an import-based approach would close over the wrong `transformData`
  // module-level variable. The closure here always references the bundle copy
  // currently driving the transform.
  const setTransformDataForPlugin = (key: string, value: any) => transformData.set(key, value);
  const wrappedPrologue: BabelPlugin[] = pluginsPrologue.map(([name, opts]) => [
    name,
    { ...(opts || {}), setTransformData: setTransformDataForPlugin },
  ]);
  const babelResult = babelTransform(originalCode, filename, !!moduleUrl, wrappedPrologue, pluginsEpilogue, _transformConfig.jsxImportSource);
  if (!babelResult?.code)
    return { code: originalCode, serializedCache };
  const { code, map } = babelResult;
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
  if (isModule) {
    const fileName = url.pathToFileURL(file);
    const esmImport = () => eval(`import(${JSON.stringify(fileName)})`);

    // For ESM imports handled by the asynchronous loader, issue a preflight to populate
    // the compilation cache with the source maps. This allows inline test() calls to
    // resolve wrapFunctionWithLocation. The synchronous loader populates the cache
    // in-process, so no preflight is needed.
    if (loaderChannel) {
      await eval(`import(${JSON.stringify(fileName + '.esm.preflight')})`)
          .catch((error: any) => debugTest('Failed to load preflight for ' + file + ', source maps may be missing for errors thrown during loading.', error))
          .finally(nextTask);
    }

    // Compilation cache, which includes source maps, is populated in a post task.
    // When importing a module results in an error, the very next access to `error.stack`
    // will need source maps. To make sure source maps have arrived, we insert a task
    // that will be processed after compilation cache and guarantee that
    // source maps are available, before `error.stack` is accessed.
    return await esmImport().finally(nextTask);
  }
  const result = require(file);
  const depsCollector = cc.currentFileDepsCollector();
  if (depsCollector) {
    const module = require.cache[file];
    if (module) {
      // Walk the CJS module tree into a fresh set, then merge into the global
      // collector. We can't pass `depsCollector` directly: the sync loader's
      // resolve hook pre-populates it, and Node short-circuits that hook for
      // already-resolved (parent_dir, request) pairs via its relativeResolveCache,
      // so the walker would skip transitive deps the hook missed.
      const cjsDeps = new Set<string>();
      collectCJSDependencies(module, cjsDeps);
      for (const dep of cjsDeps)
        depsCollector.add(dep);
    }
  }
  return result;
}

let transformInstalled = false;

function installTransformIfNeeded() {
  if (transformInstalled)
    return;
  transformInstalled = true;

  registerESMLoader();
  cc.installSourceMapSupport();

  // Async ESM loader ony covers "import", so install CJS hooks to cover "require".
  if (loaderChannel) {
    installCJSHooks();
    return;
  }

  // Sync hooks intercept `require()`, but not the `require.resolve(id, { paths })` form.
  // The mere presence of these dummy loaders teaches the default resolver that our extensions
  // should be considered.
  // Hopefully, one day `registerHooks({ resolve })` will also handle `require.resolve()`.
  const extensions = (Module as any)._extensions;
  for (const ext of ['.ts', '.cts', '.tsx', '.jsx'])
    extensions[ext] = extensions['.js'];
}

function installCJSHooks() {
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

  addHook((code, filename) => {
    return transformHook(code, filename).code;
  }, shouldTransform, ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.mts', '.cjs', '.cts']);
}

const collectCJSDependencies = (module: Module, dependencies: Set<string>) => {
  module.children.forEach(child => {
    if (!cc.belongsToNodeModules(child.filename) && !dependencies.has(child.filename)) {
      dependencies.add(child.filename);
      collectCJSDependencies(child, dependencies);
    }
  });
};

export function wrapFunctionWithLocation<A extends any[], R>(func: (location: Location, ...args: A) => R): (...args: A) => R {
  return (...args) => {
    const oldPrepareStackTrace = Error.prepareStackTrace;
    Error.prepareStackTrace = (error, stackFrames) => {
      const frame = sourceMapSupport.wrapCallSite(stackFrames[1] as any) as NodeJS.CallSite;
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

async function nextTask() {
  return new Promise(resolve => setTimeout(resolve, 0));
}

let loaderChannel: PortTransport | undefined;

function registerESMLoader() {
  // Opt-out switch.
  if (process.env.PW_DISABLE_TS_ESM)
    return;

  // Transpilation in `bun` is not necessary, and trying to register a hook would cause issues.
  // https://github.com/oven-sh/bun/issues/8222#issuecomment-3665364677
  if ('Bun' in globalThis)
    return;

  const nodeModule = require('node:module');

  if (nodeModule.registerHooks && !process.env.PLAYWRIGHT_FORCE_ASYNC_LOADER) {
    nodeModule.registerHooks({ resolve: esmLoaderSync.resolve, load: esmLoaderSync.load });
    return;
  }

  if (!nodeModule.register)
    return;

  const { port1, port2 } = new MessageChannel();
  // register will wait until the loader is initialized. The path is relative to
  // the bundle output layout (lib/common/index.js → ../transform/esmLoader.js),
  // not the source layout — esmLoader.js is its own esbuild entry point.
  nodeModule.register(url.pathToFileURL(require.resolve('../transform/esmLoader.js')), {
    data: { port: port2 },
    transferList: [port2],
  });
  loaderChannel = new PortTransport(port1, async (method, params) => {
    if (method === 'pushToCompilationCache')
      cc.addToCompilationCache(params.cache);
  });
  // Seed the loader thread with the state accumulated so far. Subsequent updates
  // are pushed by setSingleTSConfig() / setTransformConfig() / startCollectingFileDeps().
  void loaderChannel.send('setSingleTSConfig', { tsconfig: _singleTSConfigPath });
  void loaderChannel.send('setTransformConfig', { config: _transformConfig });
  void loaderChannel.send('addToCompilationCache', { cache: cc.serializeCompilationCache() });
}

export async function startCollectingFileDeps() {
  cc.startCollectingFileDeps();
  if (loaderChannel)
    await loaderChannel.send('startCollectingFileDeps', {});
}

export async function stopCollectingFileDeps(file: string) {
  cc.stopCollectingFileDeps(file);
  if (loaderChannel)
    await loaderChannel.send('stopCollectingFileDeps', { file });
}

export async function incorporateCompilationCache() {
  if (!loaderChannel)
    return;
  // Gather dependency information from the esm loader that was populated by
  // its resolve hook. We don't push this proactively during load — only at end.
  const result = await loaderChannel.send('getCompilationCache', {});
  cc.addToCompilationCache(result.cache);
}
