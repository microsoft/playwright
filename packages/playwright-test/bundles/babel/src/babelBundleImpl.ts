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

import type { BabelFileResult, NodePath, PluginObj } from '@babel/core';
import type { TSExportAssignment } from '@babel/types';
import type { TemplateBuilder } from '@babel/template';
import * as babel from '@babel/core';

export { codeFrameColumns } from '@babel/code-frame';
export { declare } from '@babel/helper-plugin-utils';
export { types } from '@babel/core';
export { parse } from '@babel/parser';
import traverseFunction from '@babel/traverse';
export const traverse = traverseFunction;

export function babelTransform(filename: string, isTypeScript: boolean, isModule: boolean, scriptPreprocessor: string | undefined, additionalPlugin: babel.PluginObj): BabelFileResult {
  const plugins = [];

  if (isTypeScript) {
    plugins.push(
        [require('@babel/plugin-proposal-class-properties')],
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
  plugins.push([require('@babel/plugin-transform-react-jsx')]);

  if (!isModule) {
    plugins.push([require('@babel/plugin-transform-modules-commonjs')]);
    plugins.push([require('@babel/plugin-proposal-dynamic-import')]);
  } else {
    plugins.push([require('@babel/plugin-syntax-import-assertions')]);
  }

  plugins.unshift(additionalPlugin);

  if (scriptPreprocessor)
    plugins.push([scriptPreprocessor]);

  return babel.transformFileSync(filename, {
    babelrc: false,
    configFile: false,
    assumptions: {
      // Without this, babel defines a top level function that
      // breaks playwright evaluates.
      setPublicClassFields: true,
    },
    presets: [
      [require('@babel/preset-typescript'), { onlyRemoveTypeImports: false }],
    ],
    plugins,
    sourceMaps: 'both',
  } as babel.TransformOptions)!;
}
