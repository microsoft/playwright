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

import path from 'path';
import typescript from '@rollup/plugin-typescript';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import { terser } from 'rollup-plugin-terser';
import { bundleCss } from './rollup-plugin-bundle-css';

const projectRoot = path.join(__dirname, '..', '..');
const src = path.join(projectRoot, 'src');
const build = path.join(projectRoot, 'build');
const pkg = require(path.join(projectRoot, 'package.json'));

const template = {
  external: [
    ...Object.keys(pkg.dependencies || {}),
  ],
  plugins: [
    typescript({
      typescript: require('typescript'),
    }),
    nodeResolve(),
    commonjs({ extensions: ['.js', '.ts', '.tsx'] }),
    bundleCss('trace-viewer.css'),
    json(),
    ...(process.env.NODE_ENV === 'production' ? [terser()] : []),
  ],
};

export default [
  {
    ...template,
    input: {
      'trace-viewer': path.join(src, 'cli', 'traceViewer', 'web', 'index.tsx'),
    },
    output: {
      entryFileNames: '[name].js',
      dir: build,
      format: 'iife',
    },
  },
];
