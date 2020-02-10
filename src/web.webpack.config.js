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

module.exports = {
  entry: path.join(__dirname, 'web.ts'),
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
    filename: 'web.js',
    library: 'playwrightweb',
    libraryTarget: 'window',
    path: path.resolve(__dirname, '../')
  },
  externals: {
    'events': 'dummy',
    'fs': 'dummy',
    'path': 'dummy',
    'debug': 'dummy',
    'buffer': 'dummy',
    'jpeg-js': 'dummy',
    'pngjs': 'dummy',
    'http': 'dummy',
    'https': 'dummy',
    'ws': 'dummy',
  }
};
