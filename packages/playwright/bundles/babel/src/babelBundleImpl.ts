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
import type { BabelFileResult, NodePath, PluginObj, TransformOptions } from '@babel/core';
import type { TSExportAssignment, ImportDeclaration } from '@babel/types';
import type { TemplateBuilder } from '@babel/template';
import * as babel from '@babel/core';

export { codeFrameColumns } from '@babel/code-frame';
export { declare } from '@babel/helper-plugin-utils';
export { types } from '@babel/core';
import traverseFunction from '@babel/traverse';
export const traverse = traverseFunction;

function babelTransformOptions(isTypeScript: boolean, isModule: boolean, pluginsPrologue: [string, any?][], pluginsEpilogue: [string, any?][]): TransformOptions {
  const plugins = [];

  if (isTypeScript) {
    plugins.push(
        [require('@babel/plugin-proposal-decorators'), { version: '2023-05' }],
        [require('@babel/plugin-proposal-explicit-resource-management')],
        [require('@babel/plugin-transform-class-properties')],
        [require('@babel/plugin-transform-class-static-block')],
        [require('@babel/plugin-transform-numeric-separator')],
        [require('@babel/plugin-transform-logical-assignment-operators')],
        [require('@babel/plugin-transform-nullish-coalescing-operator')],
        [require('@babel/plugin-transform-optional-chaining')],
        [require('@babel/plugin-transform-private-methods')],
        [require('@babel/plugin-syntax-json-strings')],
        [require('@babel/plugin-syntax-optional-catch-binding')],
        [require('@babel/plugin-syntax-async-generators')],
        [require('@babel/plugin-syntax-object-rest-spread')],
        [require('@babel/plugin-transform-export-namespace-from')],
        [require('@babel/plugin-syntax-import-attributes'), { deprecatedAssertSyntax: true }],
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
    throwIfNamespace: false,
    runtime: 'automatic',
    importSource: path.dirname(require.resolve('playwright')),
  }]);

  if (!isModule) {
    plugins.push([require('@babel/plugin-transform-modules-commonjs')]);
    // Note: we used to include '@babel/plugin-transform-dynamic-import' to convert async imports
    // into require(), so that pirates can intercept them. With the ESM loader enabled by default,
    // there is no need for this.
    plugins.push([
      (): PluginObj => ({
        name: 'css-to-identity-obj-proxy',
        visitor: {
          ImportDeclaration(path: NodePath<ImportDeclaration>) {
            if (path.node.source.value.match(/\.(css|less|scss)$/))
              path.remove();
          }
        }
      })
    ]);
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
