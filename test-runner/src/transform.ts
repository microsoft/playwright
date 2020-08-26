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

const version = 2;
const cacheDir = path.join(os.tmpdir(), 'playwright-transform-cache');
const sourceMaps: Map<string, string> = new Map();

sourceMapSupport.install({
  environment: 'node',
  handleUncaughtExceptions: false,
  retrieveSourceMap(source) {
    if (!sourceMaps.has(source))
      return null;
    const sourceMapPath = sourceMaps.get(source);
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

    const result = babel.transformFileSync(filename, {
      presets: [
        ['@babel/preset-env', { targets: {node: 'current'} }],
        ['@babel/preset-typescript', { onlyRemoveTypeImports: true }],
      ],
      sourceMaps: true,
    });
    if (result.code) {
      fs.mkdirSync(path.dirname(cachePath), {recursive: true});
      if (result.map)
        fs.writeFileSync(sourceMapPath, JSON.stringify(result.map), 'utf8');
      fs.writeFileSync(codePath, result.code, 'utf8');
    }
    return result.code;
  }, {
    exts: ['.ts']
  });
}
