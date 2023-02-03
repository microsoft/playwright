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
import os from 'os';
import path from 'path';
import { sourceMapSupport } from '../utilsBundle';
import { isWorkerProcess } from './globals';

export type MemoryCache = {
  codePath: string;
  sourceMapPath: string;
  moduleUrl?: string;
};

const version = 13;
const cacheDir = process.env.PWTEST_CACHE_DIR || path.join(os.tmpdir(), 'playwright-transform-cache');

const sourceMaps: Map<string, string> = new Map();
const memoryCache = new Map<string, MemoryCache>();

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

function _innerAddToCompilationCache(filename: string, options: { codePath: string, sourceMapPath: string, moduleUrl?: string }) {
  sourceMaps.set(options.moduleUrl || filename, options.sourceMapPath);
  memoryCache.set(filename, options);
}

export function getFromCompilationCache(filename: string, code: string, moduleUrl?: string): { cachedCode?: string, addToCache?: (code: string, map?: any) => void } {
  // First check the memory cache by filename, this cache will always work in the worker,
  // because we just compiled this file in the loader.
  const cache = memoryCache.get(filename);
  if (cache?.codePath)
    return { cachedCode: fs.readFileSync(cache.codePath, 'utf-8') };

  if (isWorkerProcess())
    throw new Error('Internal error: unexpected file imported in the worker: ' + filename);

  // Then do the disk cache, this cache works between the Playwright Test runs.
  const isModule = !!moduleUrl;
  const cachePath = calculateCachePath(code, filename, isModule);
  const codePath = cachePath + '.js';
  const sourceMapPath = cachePath + '.map';
  if (fs.existsSync(codePath)) {
    _innerAddToCompilationCache(filename, { codePath, sourceMapPath, moduleUrl });
    return { cachedCode: fs.readFileSync(codePath, 'utf8') };
  }

  return {
    addToCache: (code: string, map: any) => {
      fs.mkdirSync(path.dirname(cachePath), { recursive: true });
      if (map)
        fs.writeFileSync(sourceMapPath, JSON.stringify(map), 'utf8');
      fs.writeFileSync(codePath, code, 'utf8');
      _innerAddToCompilationCache(filename, { codePath, sourceMapPath, moduleUrl });
    }
  };
}

export function serializeCompilationCache(): any {
  return {
    sourceMaps: [...sourceMaps.entries()],
    memoryCache: [...memoryCache.entries()],
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
}

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
