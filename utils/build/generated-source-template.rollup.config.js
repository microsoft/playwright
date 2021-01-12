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

import { config as baseConfig, projectRoot } from './common-template.rollup.config';
import { inlineSource } from './rollup-plugin-inline-source';
import path from 'path';

export function config(generatedFileName, pathToSource) {
  const base = baseConfig();
  return {
    ...base,
    plugins: [
      ...base.plugins,
      inlineSource(),
    ],
    input: {
      [generatedFileName]: path.join(projectRoot, ...pathToSource),
    },
    output: {
      entryFileNames: '[name].ts',
      dir: path.join(projectRoot, 'src', 'generated'),
      format: 'iife',
      exports: 'default',
    },
  };
}
