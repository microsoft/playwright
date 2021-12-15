/*
  Copyright (c) Microsoft Corporation.

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

      http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/

const path = require('path');
const HtmlWebPackPlugin = require('html-webpack-plugin');
const BundleJsPlugin = require('./bundleJsPlugin');

const mode = process.env.NODE_ENV === 'production' ? 'production' : 'development';

module.exports = {
  mode,
  entry: {
    zip: require.resolve('@zip.js/zip.js/dist/zip-no-worker-inflate.min.js'),
    app: path.join(__dirname, 'src', 'index.tsx'),
    playwright: path.join(__dirname, 'playwright.components.tsx'),
  },
  resolve: {
    extensions: ['.ts', '.js', '.tsx', '.jsx']
  },
  devtool: mode === 'production' ? false : 'source-map',
  output: {
    globalObject: 'self',
    filename: '[name].bundle.js',
    path: path.resolve(__dirname, '..', 'playwright-core', 'lib', 'webpack', 'htmlReport')
  },
  module: {
    rules: [
      {
        test: /\.(j|t)sx?$/,
        loader: 'babel-loader',
        options: {
          presets: [
            "@babel/preset-typescript",
            "@babel/preset-react"
          ]
        },
        exclude: /node_modules/
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      },
    ]
  },
  plugins: [
    new HtmlWebPackPlugin({
      title: 'Playwright Test Report',
      template: path.join(__dirname, 'src', 'index.html'),
      inject: true,
      excludeChunks: ['playwright'],
    }),
    new BundleJsPlugin(),
  ]
};
