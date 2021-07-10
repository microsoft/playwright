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
import * as babel from '@babel/core';
export const process: import('./jestTransformTypes').Transformer['process'] = (sourceText, sourcePath, options) => {
  // We don't use any browserslist data, but babel checks it anyway.
  // Silence the annoying warning.
  global.process.env.BROWSERSLIST_IGNORE_OLD_DATA = 'true';
  const {code, map} = babel.transformFileSync(sourcePath, {
    babelrc: false,
    configFile: false,
    assumptions: {
      // Without this, babel defines a top level function that
      // breaks playwright evaluates.
      setPublicClassFields: true,
    },
    presets: [
      [require.resolve('@babel/preset-typescript'), { onlyRemoveTypeImports: true }],
    ],
    plugins: [
      [require.resolve('@babel/plugin-proposal-class-properties')],
      [require.resolve('@babel/plugin-proposal-numeric-separator')],
      [require.resolve('@babel/plugin-proposal-logical-assignment-operators')],
      [require.resolve('@babel/plugin-proposal-nullish-coalescing-operator')],
      [require.resolve('@babel/plugin-proposal-optional-chaining')],
      [require.resolve('@babel/plugin-syntax-json-strings')],
      [require.resolve('@babel/plugin-syntax-optional-catch-binding')],
      [require.resolve('@babel/plugin-syntax-async-generators')],
      [require.resolve('@babel/plugin-syntax-object-rest-spread')],
      [require.resolve('@babel/plugin-proposal-export-namespace-from')],
      [require.resolve('@babel/plugin-transform-modules-commonjs')],
      [require.resolve('@babel/plugin-proposal-dynamic-import')],
    ],
    sourceMaps: 'both',
  } as babel.TransformOptions)!;
  return {
    code: code || '',
    map
  };
};