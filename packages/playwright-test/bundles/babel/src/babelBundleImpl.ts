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

import type { BabelFileResult, NodePath, PluginObj, TransformOptions } from '@babel/core';
import type { TSExportAssignment } from '@babel/types';
import type { TemplateBuilder } from '@babel/template';
import * as babel from '@babel/core';

export { codeFrameColumns } from '@babel/code-frame';
export { declare } from '@babel/helper-plugin-utils';
export { types } from '@babel/core';
export { parse } from '@babel/parser';
import traverseFunction from '@babel/traverse';
export const traverse = traverseFunction;

function babelTransformOptions(isTypeScript: boolean, isModule: boolean, pluginsPrologue: [string, any?][], pluginsEpilogue: [string, any?][]): TransformOptions {
  const plugins = [];

  if (isTypeScript) {
    plugins.push(
        [require('@babel/plugin-proposal-decorators'), { version: '2022-03' }],
        [require('@babel/plugin-proposal-class-properties')],
        [require('@babel/plugin-proposal-class-static-block')],
        [require('@babel/plugin-proposal-numeric-separator')],
        [require('@babel/plugin-proposal-logical-assignment-operators')],
        [require('@babel/plugin-proposal-nullish-coalescing-operator')],
        [require('@babel/plugin-proposal-optional-chaining')],
        [require('@babel/plugin-proposal-private-methods')],
        [require('@babel/plugin-syntax-json-strings')],
        [require('@babel/plugin-syntax-optional-catch-binding')],
        [require('@babel/plugin-syntax-async-generators')],
        [require('@babel/plugin-syntax-object-rest-spread')],
        [require('@babel/plugin-proposal-export-namespace-from')],
        [
          // From https://github.com/G-Rath/babel-plugin-replace-ts-export-assignment/blob/8dfdca32c8aa428574b0cae341444fc5822f2dc6/src/index.ts
          (
            { template }: { template: TemplateBuilder<TSExportAssignment> }
          ): PluginObj => ({
            name: 'replace-ts-export-assignment',
            visitor: {
              TSExportAssignment(path: NodePath<TSExportAssignment>) {
                path.replaceWith(template('module.exports = ASSIGNMENT;')({
                  ASSIGNMENT: path.node.expression
                }));
              }
            }
          })
        ]
    );
  }

  // Support JSX/TSX at all times, regardless of the file extension.
  plugins.push([require('@babel/plugin-transform-react-jsx'), {
    runtime: 'automatic',
    importSource: '@playwright/test'
  }]);

  if (!isModule) {
    plugins.push([require('@babel/plugin-transform-modules-commonjs')]);
    // This converts async imports to require() calls so that we can intercept them with pirates.
    plugins.push([require('@babel/plugin-proposal-dynamic-import')]);
  } else {
    plugins.push([require('@babel/plugin-syntax-import-assertions')]);
  }

  return {
    browserslistConfigFile: false,
    babelrc: false,
    configFile: false,
    assumptions: {
      // Without this, babel defines a top level function that
      // breaks playwright evaluates.
      setPublicClassFields: true,
    },
    presets: isTypeScript ? [
      [require('@babel/preset-typescript'), { onlyRemoveTypeImports: false }],
    ] : [],
    plugins: [
      ...pluginsPrologue.map(([name, options]) => [require(name), options]),
      ...plugins,
      ...pluginsEpilogue.map(([name, options]) => [require(name), options]),
    ],
    compact: false,
    sourceMaps: 'both',
  };
}

let isTransforming = false;

export function babelTransform(code: string, filename: string, isTypeScript: boolean, isModule: boolean, pluginsPrologue: [string, any?][], pluginsEpilogue: [string, any?][]): BabelFileResult {
  if (isTransforming)
    return {};

  // Prevent reentry while requiring plugins lazily.
  isTransforming = true;
  try {
    const options = babelTransformOptions(isTypeScript, isModule, pluginsPrologue, pluginsEpilogue);
    return babel.transform(code, { filename, ...options })!;
  } finally {
    isTransforming = false;
  }
}
