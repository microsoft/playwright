// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

const path = require('path');
const InlineSource = require('./webpack-inline-source-plugin.js');

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
    path: path.resolve(__dirname, '../../lib/injected/packed')
  },
  plugins: [
    new InlineSource(path.join(__dirname, '..', 'generated', 'injectedSource.ts')),
  ]
};
