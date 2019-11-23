// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

const path = require('path');
const InlineSource = require('./webpack-inline-source-plugin.js');

module.exports = {
  entry: path.join(__dirname, 'xpathSelectorEngine.ts'),
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
    filename: 'xpathSelectorEngineSource.js',
    path: path.resolve(__dirname, '../../lib/injected/generated')
  },
  plugins: [
    new InlineSource(path.join(__dirname, '..', 'generated', 'xpathSelectorEngineSource.ts')),
  ]
};
