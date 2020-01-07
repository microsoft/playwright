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

const fs = require('fs');
const path = require('path');

module.exports = class InlineSource {
  constructor(outFile) {
    this.outFile = outFile;
  }

  apply(compiler) {
    compiler.hooks.emit.tapAsync('InlineSource', (compilation, callback) => {
      let source = compilation.assets[path.basename(this.outFile).replace('.ts', '.js')].source();
      const lastLine = source.split('\n').pop();
      if (lastLine.startsWith('//# sourceMappingURL'))
        source = source.substring(0, source.length - lastLine.length - 1);
      if (source.endsWith(';'))
        source = source.substring(0, source.length - 1);
      source = '(' + source + ').default';
      fs.mkdirSync(path.dirname(this.outFile), { recursive: true });
      const newSource = 'export const source = ' + JSON.stringify(source) + ';';
      fs.writeFileSync(this.outFile, newSource);
      callback();
    });
  }
};
