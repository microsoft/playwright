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
    commonjs({ extensions: ['.js', '.ts'] }),
    json(),
    ...(process.env.NODE_ENV === 'production' ? [terser()] : []),
  ],
};

export default [
  {
    ...template,
    input: {
      events: path.join(src, 'client', 'events.ts'),
      api: path.join(src, 'client', 'api.ts'),
      index: path.join(src, 'inprocess.ts'),
      testExports: path.join(src, 'testExports.ts'),
      service: path.join(src, 'service.ts'),
      cliTestExports: path.join(src, 'cli', 'cliTestExports.ts'),
      cli: path.join(src, 'cli', 'cli.ts'),
      installer: path.join(src, 'install', 'installer.ts'),
    },
    output: {
      entryFileNames: '[name].js',
      dir: build,
      format: 'cjs',
      exports: 'default',
    },
  },
];
