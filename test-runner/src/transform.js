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
const crypto = require('crypto');
const os = require('os');
const path = require('path');
const fs = require('fs');
const pirates = require('pirates');
const babel = require('@babel/core');
const sourceMapSupport = require('source-map-support');

const version = 1;
const cacheDir = path.join(os.tmpdir(), 'playwright-transform-cache');
/** @type {Map<string, string>} */
const sourceMaps = new Map();

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

/**
 * @param {string} content 
 * @param {string} filePath 
 * @return {string}
 */
function calculateCachePath(content, filePath) {
  const hash = crypto.createHash('sha1').update(content).update(filePath).update(String(version)).digest('hex');
  const fileName = path.basename(filePath, path.extname(filePath)).replace(/\W/g, '') + '_' + hash;

  return path.join(cacheDir, hash[0] + hash[1], fileName);
}

function installTransform() {
  return pirates.addHook((code, filename) => {
    const cachePath = calculateCachePath(code, filename);
    const codePath = cachePath + '.js';
    const sourceMapPath = cachePath + '.map';
    sourceMaps.set(filename, sourceMapPath);
    if (fs.existsSync(codePath))
      return fs.readFileSync(codePath, 'utf8');
    
    const result = babel.transformFileSync(filename, {
      presets: [
        ['@babel/preset-env', {targets: {node: 'current'}}],
        '@babel/preset-typescript'],
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

module.exports = {installTransform};
