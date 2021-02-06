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
const InlineSource = require('../../injected/webpack-inline-source-plugin');

/** @type {import('webpack').Configuration} */
module.exports = {
  entry: path.join(__dirname, 'consoleApi.ts'),
  mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
  devtool: false,
  module: {
    rules: [
      {
        test: /\.(j|t)sx?$/,
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
    libraryTarget: 'var',
    library: 'pwExport',
    libraryExport: 'default',
    filename: 'consoleApiSource.js',
    path: path.resolve(__dirname, '../../../../lib/server/injected/packed')
  },
  plugins: [
    new InlineSource(path.join(__dirname, '..', '..', '..', 'generated', 'consoleApiSource.ts')),
  ]
};
