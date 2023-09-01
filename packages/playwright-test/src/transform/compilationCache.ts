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
import os from 'os';
import path from 'path';
import { sourceMapSupport } from '../utilsBundle';

export type MemoryCache = {
  codePath: string;
  sourceMapPath: string;
  moduleUrl?: string;
};

const cacheDir = process.env.PWTEST_CACHE_DIR || (() => {
  if (process.platform === 'win32')
    return path.join(os.tmpdir(), `playwright-transform-cache`);
  // Use `geteuid()` instead of more natural `os.userInfo().username`
  // since `os.userInfo()` is not always available.
  // Note: `process.geteuid()` is not available on windows.
  // See https://github.com/microsoft/playwright/issues/22721
  return path.join(os.tmpdir(), `playwright-transform-cache-` + process.geteuid());
})();

const sourceMaps: Map<string, string> = new Map();
const memoryCache = new Map<string, MemoryCache>();
// Dependencies resolved by the loader.
const fileDependencies = new Map<string, Set<string>>();
// Dependencies resolved by the external bundler.
const externalDependencies = new Map<string, Set<string>>();

let sourceMapSupportInstalled = false;

export function installSourceMapSupportIfNeeded() {
  if (sourceMapSupportInstalled)
    return;
  sourceMapSupportInstalled = true;

  Error.stackTraceLimit = 200;

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
}

function _innerAddToCompilationCache(filename: string, options: { codePath: string, sourceMapPath: string, moduleUrl?: string }) {
  sourceMaps.set(options.moduleUrl || filename, options.sourceMapPath);
  memoryCache.set(filename, options);
}

// Each worker (and runner) process compiles and caches client code and source maps.
// There are 2 levels of caching:
// 1. Memory Cache: per-process, single threaded.
// 2. SHARED Disk Cache: helps to re-use caching across processes (worker re-starts).
//
// Now, SHARED Disk Cache might be accessed at the same time by different workers, trying
// to write/read concurrently to it. We tried to implement "atomic write" to disk cache, but
// failed to do so on Windows. See context: https://github.com/microsoft/playwright/issues/26769#issuecomment-1701870842
//
// Under further inspection, it turns out that our Disk Cache is append-only, so instead of a general-purpose
// "atomic write" it will suffice to have "atomic append". For "atomic append", it is sufficient to:
// - make sure there are no concurrent writes to the same file. This is implemented using the `wx` flag to the Node.js `fs.writeFile` calls.
// - have a signal that guarantees that file is actually finished writing. We use marker files for this.
//
// The following method implements the "atomic append" principles for the disk cache.
//
export function getFromCompilationCache(filename: string, hash: string, moduleUrl?: string): { cachedCode?: string, addToCache?: (code: string, map?: any) => void } {
  // First check the memory cache by filename, this cache will always work in the worker,
  // because we just compiled this file in the loader.
  const cache = memoryCache.get(filename);
  if (cache?.codePath)
    return { cachedCode: fs.readFileSync(cache.codePath, 'utf-8') };

  // Then do the disk cache, this cache works between the Playwright Test runs.
  const cachePath = calculateCachePath(filename, hash);
  const codePath = cachePath + '.js';
  const sourceMapPath = cachePath + '.map';
  const markerFile = codePath + '-marker';
  if (fs.existsSync(markerFile)) {
    _innerAddToCompilationCache(filename, { codePath, sourceMapPath, moduleUrl });
    return { cachedCode: fs.readFileSync(codePath, 'utf8') };
  }

  return {
    addToCache: (code: string, map: any) => {
      fs.mkdirSync(path.dirname(cachePath), { recursive: true });
      try {
        if (map)
          fs.writeFileSync(sourceMapPath, JSON.stringify(map), { encoding: 'utf8', flag: 'wx' });
        fs.writeFileSync(codePath, code, { encoding: 'utf8', flag: 'wx' });
        // NOTE: if the worker crashes RIGHT HERE, before creating a marker file, we will never be able to
        // create it later on. As a result, the entry will never be added to the disk cache.
        //
        // However, this scenario is EXTREMELY unlikely, so we accept this
        // limitation to reduce algorithm complexity.
        fs.closeSync(fs.openSync(markerFile, 'w'));
      } catch (error) {
        // Ignore error that is triggered by the `wx` flag.
      }
      _innerAddToCompilationCache(filename, { codePath, sourceMapPath, moduleUrl });
    }
  };
}

export function serializeCompilationCache(): any {
  return {
    sourceMaps: [...sourceMaps.entries()],
    memoryCache: [...memoryCache.entries()],
    fileDependencies: [...fileDependencies.entries()].map(([filename, deps]) => ([filename, [...deps]])),
    externalDependencies: [...externalDependencies.entries()].map(([filename, deps]) => ([filename, [...deps]])),
  };
}

export function clearCompilationCache() {
  sourceMaps.clear();
  memoryCache.clear();
}

export function addToCompilationCache(payload: any) {
  for (const entry of payload.sourceMaps)
    sourceMaps.set(entry[0], entry[1]);
  for (const entry of payload.memoryCache)
    memoryCache.set(entry[0], entry[1]);
  for (const entry of payload.fileDependencies)
    fileDependencies.set(entry[0], new Set(entry[1]));
  for (const entry of payload.externalDependencies)
    externalDependencies.set(entry[0], new Set(entry[1]));
}

function calculateCachePath(filePath: string, hash: string): string {
  const fileName = path.basename(filePath, path.extname(filePath)).replace(/\W/g, '') + '_' + hash;
  return path.join(cacheDir, hash[0] + hash[1], fileName);
}

// Since ESM and CJS collect dependencies differently,
// we go via the global state to collect them.
let depsCollector: Set<string> | undefined;

export function startCollectingFileDeps() {
  depsCollector = new Set();
}

export function stopCollectingFileDeps(filename: string) {
  if (!depsCollector)
    return;
  depsCollector.delete(filename);
  for (const dep of depsCollector) {
    if (belongsToNodeModules(dep))
      depsCollector.delete(dep);
  }
  fileDependencies.set(filename, depsCollector);
  depsCollector = undefined;
}

export function currentFileDepsCollector(): Set<string> | undefined {
  return depsCollector;
}

export function setExternalDependencies(filename: string, deps: string[]) {
  const depsSet = new Set(deps.filter(dep => !belongsToNodeModules(dep) && dep !== filename));
  externalDependencies.set(filename, depsSet);
}

export function fileDependenciesForTest() {
  return fileDependencies;
}

export function collectAffectedTestFiles(dependency: string, testFileCollector: Set<string>) {
  testFileCollector.add(dependency);
  for (const [testFile, deps] of fileDependencies) {
    if (deps.has(dependency))
      testFileCollector.add(testFile);
  }
  for (const [testFile, deps] of externalDependencies) {
    if (deps.has(dependency))
      testFileCollector.add(testFile);
  }
}

export function dependenciesForTestFile(filename: string): Set<string> {
  const result = new Set<string>();
  for (const dep of fileDependencies.get(filename) || [])
    result.add(dep);
  for (const dep of externalDependencies.get(filename) || [])
    result.add(dep);
  return result;
}

// These two are only used in the dev mode, they are specifically excluding
// files from packages/playwright*. In production mode, node_modules covers
// that.
const kPlaywrightInternalPrefix = path.resolve(__dirname, '../../../playwright');
const kPlaywrightCoveragePrefix = path.resolve(__dirname, '../../../../tests/config/coverage.js');

export function belongsToNodeModules(file: string) {
  if (file.includes(`${path.sep}node_modules${path.sep}`))
    return true;
  if (file.startsWith(kPlaywrightInternalPrefix) && file.endsWith('.js'))
    return true;
  if (file.startsWith(kPlaywrightCoveragePrefix) && file.endsWith('.js'))
    return true;
  return false;
}
