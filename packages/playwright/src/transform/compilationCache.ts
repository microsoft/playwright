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

import { isWorkerProcess } from '../common/globals';
import { sourceMapSupport } from '../utilsBundle';

export type MemoryCache = {
  codePath: string;
  sourceMapPath: string;
  dataPath: string;
  moduleUrl?: string;
};

export type SerializedCompilationCache = {
  sourceMaps: [string, string][],
  memoryCache: [string, MemoryCache][],
  fileDependencies: [string, string[]][],
  externalDependencies: [string, string[]][],
};

// Assumptions for the compilation cache:
// - Files in the temp directory we work with can disappear at any moment, either some of them or all together.
// - Multiple workers can be trying to read from the compilation cache at the same time.
// - There is a single invocation of the test runner at a time.
//
// Therefore, we implement the following logic:
// - Never assume that file is present, always try to read it to determine whether it's actually present.
// - Never write to the cache from worker processes to avoid "multiple writers" races.
// - Since we perform all static imports in the runner beforehand, most of the time
//   workers should be able to read from the cache.
// - For workers-only dynamic imports or some cache problems, we will re-transpile files in
//   each worker anew.

export const cacheDir = process.env.PWTEST_CACHE_DIR || (() => {
  if (process.platform === 'win32')
    return path.join(os.tmpdir(), `playwright-transform-cache`);
  // Use `geteuid()` instead of more natural `os.userInfo().username`
  // since `os.userInfo()` is not always available.
  // Note: `process.geteuid()` is not available on windows.
  // See https://github.com/microsoft/playwright/issues/22721
  return path.join(os.tmpdir(), `playwright-transform-cache-` + process.geteuid?.());
})();

const sourceMaps: Map<string, string> = new Map();
const memoryCache = new Map<string, MemoryCache>();
// Dependencies resolved by the loader.
const fileDependencies = new Map<string, Set<string>>();
// Dependencies resolved by the external bundler.
const externalDependencies = new Map<string, Set<string>>();

export function installSourceMapSupport() {
  Error.stackTraceLimit = 200;

  sourceMapSupport.install({
    environment: 'node',
    handleUncaughtExceptions: false,
    retrieveSourceMap(source) {
      if (!sourceMaps.has(source))
        return null;
      const sourceMapPath = sourceMaps.get(source)!;
      try {
        return {
          map: JSON.parse(fs.readFileSync(sourceMapPath, 'utf-8')),
          url: source,
        };
      } catch {
        return null;
      }
    }
  });
}

function _innerAddToCompilationCacheAndSerialize(filename: string, entry: MemoryCache) {
  sourceMaps.set(entry.moduleUrl || filename, entry.sourceMapPath);
  memoryCache.set(filename, entry);
  return {
    sourceMaps: [[entry.moduleUrl || filename, entry.sourceMapPath]],
    memoryCache: [[filename, entry]],
    fileDependencies: [],
    externalDependencies: [],
  };
}

type CompilationCacheLookupResult = {
  serializedCache?: any;
  cachedCode?: string;
  addToCache?: (code: string, map: any | undefined | null, data: Map<string, any>) => { serializedCache?: any };
};

export function getFromCompilationCache(filename: string, hash: string, moduleUrl?: string): CompilationCacheLookupResult {
  // First check the memory cache by filename, this cache will always work in the worker,
  // because we just compiled this file in the loader.
  const cache = memoryCache.get(filename);
  if (cache?.codePath) {
    try {
      return { cachedCode: fs.readFileSync(cache.codePath, 'utf-8') };
    } catch {
      // Not able to read the file - fall through.
    }
  }

  // Then do the disk cache, this cache works between the Playwright Test runs.
  const cachePath = calculateCachePath(filename, hash);
  const codePath = cachePath + '.js';
  const sourceMapPath = cachePath + '.map';
  const dataPath = cachePath + '.data';
  try {
    const cachedCode = fs.readFileSync(codePath, 'utf8');
    const serializedCache = _innerAddToCompilationCacheAndSerialize(filename, { codePath, sourceMapPath, dataPath, moduleUrl });
    return { cachedCode, serializedCache };
  } catch {
  }

  return {
    addToCache: (code: string, map: any | undefined | null, data: Map<string, any>) => {
      if (isWorkerProcess())
        return {};
      fs.mkdirSync(path.dirname(cachePath), { recursive: true });
      if (map)
        fs.writeFileSync(sourceMapPath, JSON.stringify(map), 'utf8');
      if (data.size)
        fs.writeFileSync(dataPath, JSON.stringify(Object.fromEntries(data.entries()), undefined, 2), 'utf8');
      fs.writeFileSync(codePath, code, 'utf8');
      const serializedCache = _innerAddToCompilationCacheAndSerialize(filename, { codePath, sourceMapPath, dataPath, moduleUrl });
      return { serializedCache };
    }
  };
}

export function serializeCompilationCache(): SerializedCompilationCache {
  return {
    sourceMaps: [...sourceMaps.entries()],
    memoryCache: [...memoryCache.entries()],
    fileDependencies: [...fileDependencies.entries()].map(([filename, deps]) => ([filename, [...deps]])),
    externalDependencies: [...externalDependencies.entries()].map(([filename, deps]) => ([filename, [...deps]])),
  };
}

export function addToCompilationCache(payload: SerializedCompilationCache) {
  for (const entry of payload.sourceMaps)
    sourceMaps.set(entry[0], entry[1]);
  for (const entry of payload.memoryCache)
    memoryCache.set(entry[0], entry[1]);
  for (const entry of payload.fileDependencies) {
    const existing = fileDependencies.get(entry[0]) || [];
    fileDependencies.set(entry[0], new Set([...entry[1], ...existing]));
  }
  for (const entry of payload.externalDependencies) {
    const existing = externalDependencies.get(entry[0]) || [];
    externalDependencies.set(entry[0], new Set([...entry[1], ...existing]));
  }
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

export function collectAffectedTestFiles(changedFile: string, testFileCollector: Set<string>) {
  const isTestFile = (file: string) => fileDependencies.has(file);

  if (isTestFile(changedFile))
    testFileCollector.add(changedFile);

  for (const [testFile, deps] of fileDependencies) {
    if (deps.has(changedFile))
      testFileCollector.add(testFile);
  }

  for (const [importingFile, depsOfImportingFile] of externalDependencies) {
    if (depsOfImportingFile.has(changedFile)) {
      if (isTestFile(importingFile))
        testFileCollector.add(importingFile);

      for (const [testFile, depsOfTestFile] of fileDependencies) {
        if (depsOfTestFile.has(importingFile))
          testFileCollector.add(testFile);
      }
    }
  }
}

export function affectedTestFiles(changes: string[]): string[] {
  const result = new Set<string>();
  for (const change of changes)
    collectAffectedTestFiles(change, result);
  return [...result];
}

export function internalDependenciesForTestFile(filename: string): Set<string> | undefined{
  return fileDependencies.get(filename);
}

export function dependenciesForTestFile(filename: string): Set<string> {
  const result = new Set<string>();
  for (const testDependency of fileDependencies.get(filename) || []) {
    result.add(testDependency);
    for (const externalDependency of externalDependencies.get(testDependency) || [])
      result.add(externalDependency);
  }
  for (const dep of externalDependencies.get(filename) || [])
    result.add(dep);
  return result;
}

// This is only used in the dev mode, specifically excluding
// files from packages/playwright*. In production mode, node_modules covers
// that.
const kPlaywrightInternalPrefix = path.resolve(__dirname, '../../../playwright');

export function belongsToNodeModules(file: string) {
  if (file.includes(`${path.sep}node_modules${path.sep}`))
    return true;
  if (file.startsWith(kPlaywrightInternalPrefix) && (file.endsWith('.js') || file.endsWith('.mjs')))
    return true;
  return false;
}

export async function getUserData(pluginName: string): Promise<Map<string, any>> {
  const result = new Map<string, any>();
  for (const [fileName, cache] of memoryCache) {
    if (!cache.dataPath)
      continue;
    if (!fs.existsSync(cache.dataPath))
      continue;
    const data = JSON.parse(await fs.promises.readFile(cache.dataPath, 'utf8'));
    if (data[pluginName])
      result.set(fileName, data[pluginName]);
  }
  return result;
}
