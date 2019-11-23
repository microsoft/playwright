// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

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
