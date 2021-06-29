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
import * as babel from '@babel/core';
import * as sourceMapSupport from 'source-map-support';
import * as url from 'url';
import type { Location } from './types';

const version = 4;
const cacheDir = process.env.PWTEST_CACHE_DIR || path.join(os.tmpdir(), 'playwright-transform-cache');
const sourceMaps: Map<string, string> = new Map();

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
  const hash = crypto.createHash('sha1').update(content).update(filePath).update(String(version)).digest('hex');
  const fileName = path.basename(filePath, path.extname(filePath)).replace(/\W/g, '') + '_' + hash;
  return path.join(cacheDir, hash[0] + hash[1], fileName);
}

export function installTransform(): () => void {
  return pirates.addHook((code, filename) => {
    const cachePath = calculateCachePath(code, filename);
    const codePath = cachePath + '.js';
    const sourceMapPath = cachePath + '.map';
    sourceMaps.set(filename, sourceMapPath);
    if (fs.existsSync(codePath))
      return fs.readFileSync(codePath, 'utf8');
    // We don't use any browserslist data, but babel checks it anyway.
    // Silence the annoying warning.
    process.env.BROWSERSLIST_IGNORE_OLD_DATA = 'true';
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
      plugins: [
        [require.resolve('@babel/plugin-proposal-class-properties')],
        [require.resolve('@babel/plugin-proposal-numeric-separator')],
        [require.resolve('@babel/plugin-proposal-logical-assignment-operators')],
        [require.resolve('@babel/plugin-proposal-nullish-coalescing-operator')],
        [require.resolve('@babel/plugin-proposal-optional-chaining')],
        [require.resolve('@babel/plugin-syntax-json-strings')],
        [require.resolve('@babel/plugin-syntax-optional-catch-binding')],
        [require.resolve('@babel/plugin-syntax-async-generators')],
        [require.resolve('@babel/plugin-syntax-object-rest-spread')],
        [require.resolve('@babel/plugin-proposal-export-namespace-from')],
        [require.resolve('@babel/plugin-transform-modules-commonjs')],
        [require.resolve('@babel/plugin-proposal-dynamic-import')],
      ],
      sourceMaps: 'both',
    } as babel.TransformOptions)!;
    if (result.code) {
      fs.mkdirSync(path.dirname(cachePath), {recursive: true});
      if (result.map)
        fs.writeFileSync(sourceMapPath, JSON.stringify(result.map), 'utf8');
      fs.writeFileSync(codePath, result.code, 'utf8');
    }
    return result.code || '';
  }, {
    exts: ['.ts']
  });
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
