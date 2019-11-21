// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

const fs = require('fs');
const path = require('path');

class InlineInjectedSource {
  apply(compiler) {
    compiler.hooks.emit.tapAsync('InlineInjectedSource', (compilation, callback) => {
      const source = compilation.assets['injectedSource.js'].source();
      const newSource = 'export const injectedSource = ' + JSON.stringify(source) + ';';
      fs.writeFileSync(path.join(__dirname, 'injectedSource.ts'), newSource);
      callback();
    });
  }
}

module.exports = {
  entry: path.join(__dirname, 'injected.ts'),
  devtool: 'source-map',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        loader: 'ts-loader',
        options: {
          transpileOnly: true
        },
        exclude: /node_modules/
      }
    ]
  },
  resolve: {
    extensions: [ '.tsx', '.ts', '.js' ]
  },
  output: {
    filename: 'injectedSource.js',
    path: path.resolve(__dirname, '../../lib/injected')
  },
  plugins: [
    new InlineInjectedSource(),
  ]
};
