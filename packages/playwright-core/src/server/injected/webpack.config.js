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

const path = require('path');
const fs = require('fs');

class InlineSource {
  /**
   * @param {string[]} outFiles 
   */
  constructor(outFiles) {
    this.outFiles = outFiles;
  }

  /**
   * @param {import('webpack').Compiler} compiler
   */
  apply(compiler) {
    compiler.hooks.emit.tapAsync('InlineSource', (compilation, callback) => {
      for (const outFile of this.outFiles) {
        const source = compilation.assets[path.basename(outFile).replace('.ts', '.js')].source();
        fs.mkdirSync(path.dirname(outFile), { recursive: true });
        const newSource = 'export const source = ' + JSON.stringify(source) + ';';
        fs.writeFileSync(outFile, newSource);
      }
      callback();
    });
  }
}

const entry = {
  utilityScriptSource: path.join(__dirname, 'utilityScript.ts'),
  injectedScriptSource: path.join(__dirname, 'injectedScript.ts'),
  consoleApiSource: path.join(__dirname, '..', 'supplements', 'injected', 'consoleApi.ts'),
  recorderSource: path.join(__dirname, '..', 'supplements', 'injected', 'recorder.ts'),
}

/** @type {import('webpack').Configuration} */
module.exports = {
  entry,
  mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
  devtool: false,
  module: {
    rules: [
      {
        test: /\.(j|t)sx?$/,
        loader: 'babel-loader',
        exclude: /node_modules/
      }
    ]
  },
  resolve: {
    extensions: [ '.tsx', '.ts', '.js' ]
  },
  output: {
    libraryTarget: 'var',
    library: 'pwExport',
    libraryExport: 'default',
    filename: '[name].js',
    path: path.resolve(__dirname, '../../../lib/server/injected/packed')
  },
  plugins: [
    new InlineSource(
      Object.keys(entry).map(x => path.join(__dirname, '..', '..', 'generated', x + '.ts'))
    ),
  ]
};
