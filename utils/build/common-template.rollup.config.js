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
import replace from '@rollup/plugin-replace';
import { bundleCss } from './rollup-plugin-bundle-css';
import { shebang } from './rollup-plugin-shebang';

export const projectRoot = path.join(__dirname, '..', '..');

export function config(options = {}) {
  return {
    external: ['bufferutil', 'utf-8-validate'],  // https://github.com/websockets/ws#opt-in-for-performance-and-spec-compliance
    plugins: [
      typescript({
        typescript: require('typescript'),
        include: options.typescriptInclude,
      }),
      nodeResolve(),
      commonjs({ extensions: ['.js', '.ts', '.tsx'] }),
      replace({
        'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
        "require('bufferutil')": 'null',
        "require('utf-8-validate')": 'null',
        delimiters: ['', '']
      }),
      json(),
      ...(process.env.NODE_ENV === 'production' ? [terser()] : []),
      ...(options.bundleCss ? [bundleCss(options.bundleCss)] : []),
      ...(options.shebangs ? [shebang(options.shebangs)] : []),
    ],
    output: {
      entryFileNames: '[name].js',
      dir: path.join(projectRoot, 'build'),
      format: 'cjs',
      exports: 'default',
    },
  };
}
