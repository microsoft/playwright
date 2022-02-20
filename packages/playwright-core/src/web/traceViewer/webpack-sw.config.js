const path = require('path');

const mode = process.env.NODE_ENV === 'production' ? 'production' : 'development';
module.exports = {
  mode,
  entry: {
    sw: path.join(__dirname, 'sw.ts'),
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  devtool: mode === 'production' ? false : 'source-map',
  output: {
    globalObject: 'self',
    filename: '[name].bundle.js',
    path: path.resolve(__dirname, '../../../lib/webpack/traceViewer'),
  },
  module: {
    rules: [
      {
        test: /\.(j|t)sx?$/,
        loader: 'babel-loader',
        options: {
          presets: ['@babel/preset-typescript'],
        },
        exclude: /node_modules/,
      },
    ],
  },
};
