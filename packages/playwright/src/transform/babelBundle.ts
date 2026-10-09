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
import traverseFunction from '@babel/traverse';

import type { BabelFileResult, NodePath, PluginObj, TransformOptions } from '@babel/core';
import type { TemplateBuilder } from '@babel/template';
import type { ImportDeclaration, TSExportAssignment } from '@babel/types';

export { codeFrameColumns } from '@babel/code-frame';
export { declare } from '@babel/helper-plugin-utils';
export { types } from '@babel/core';
export const traverse = traverseFunction;

export type { NodePath, PluginObj, types as T } from '@babel/core';
export type { BabelAPI } from '@babel/helper-plugin-utils';

export type BabelPlugin = [string, any?];
export type JsxOptions = {
  jsx: string;
  jsxFactory?: string;
  jsxFragmentFactory?: string;
  jsxImportSource?: string;
};
export type BabelTransformFunction = (code: string, filename: string, isModule: boolean, pluginsSuffix: BabelPlugin[], useDefineForClassFields: boolean, jsx?: JsxOptions) => BabelFileResult | null;

const nodeMajorVersion = +process.versions.node.split('.')[0];

function jsxPlugin(jsx: JsxOptions | undefined): [any, any] {
  if (jsx?.jsx === 'react') {
    return [require('@babel/plugin-transform-react-jsx'), {
      throwIfNamespace: false,
      runtime: 'classic',
      pragma: jsx.jsxFactory,
      pragmaFrag: jsx.jsxFragmentFactory,
    }];
  }
  const plugin = jsx?.jsx === 'react-jsxdev' ? require('@babel/plugin-transform-react-jsx/lib/development') : require('@babel/plugin-transform-react-jsx');
  return [plugin, {
    throwIfNamespace: false,
    runtime: 'automatic',
    importSource: jsx?.jsxImportSource,
  }];
}

function babelTransformOptions(isTypeScript: boolean, isModule: boolean, pluginsEpilogue: [string, any?][], useDefineForClassFields: boolean, jsx?: JsxOptions): TransformOptions {
  const plugins = [
    [require('@babel/plugin-syntax-import-attributes'), { deprecatedAssertSyntax: true }],
  ];

  if (isTypeScript) {
    plugins.push(
        // Strip "declare" class fields, and uninitialized ones that tsc omits without
        // "useDefineForClassFields", before these plugins run:
        // - plugin-proposal-decorators
        // - plugin-transform-class-properties
        // - plugin-transform-private-methods
        // See https://github.com/microsoft/playwright/issues/38586
        [
          (): PluginObj => ({
            name: 'strip-type-only-class-fields',
            visitor: {
              Class(path) {
                for (const member of path.get('body.body')) {
                  if (!member.isClassProperty())
                    continue;
                  const { declare, value, decorators } = member.node;
                  if (declare || (!useDefineForClassFields && !value && !decorators?.length))
                    member.remove();
                }
              }
            }
          })
        ],
        [require('@babel/plugin-proposal-decorators'), { version: '2023-05' }],
    );
    // With "useDefineForClassFields", Node defines class fields natively.
    if (!useDefineForClassFields) {
      plugins.push(
          [require('@babel/plugin-transform-class-properties')],
          [require('@babel/plugin-transform-private-methods')],
      );
    }
    plugins.push(
        [require('@babel/plugin-transform-class-static-block')],
        [require('@babel/plugin-transform-numeric-separator')],
        [require('@babel/plugin-transform-logical-assignment-operators')],
        [require('@babel/plugin-transform-nullish-coalescing-operator')],
        [require('@babel/plugin-transform-optional-chaining')],
        [require('@babel/plugin-syntax-json-strings')],
        [require('@babel/plugin-syntax-optional-catch-binding')],
        [require('@babel/plugin-syntax-async-generators')],
        [require('@babel/plugin-syntax-object-rest-spread')],
        [require('@babel/plugin-transform-export-namespace-from')],
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

    if (nodeMajorVersion < 24)
      plugins.push([require('@babel/plugin-transform-explicit-resource-management')]);
  }

  // Support JSX/TSX at all times, regardless of the file extension.
  plugins.push(jsxPlugin(jsx));

  if (!isModule) {
    plugins.push([require('@babel/plugin-transform-modules-commonjs')]);
    plugins.push([
      (): PluginObj => ({
        name: 'map-interop-calls-to-callee-start',
        visitor: {},
        post(file) {
          // Otherwise V8 reports test('foo') in (0, _test.test)('foo') at the paren instead of the callee.
          file.path.traverse({
            CallExpression(path) {
              const callee = path.node.callee;
              if (callee.type === 'SequenceExpression' && !callee.loc)
                callee.expressions[callee.expressions.length - 1].loc = null;
            }
          });
        }
      })
    ]);
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
      [require('@babel/preset-typescript'), { onlyRemoveTypeImports: false, allowDeclareFields: useDefineForClassFields }],
    ] : [],
    plugins: [
      ...plugins,
      ...pluginsEpilogue.map(([name, options]) => [require(name), options]),
    ],
    compact: false,
    sourceMaps: 'both',
  };
}

let isTransforming = false;

function isTypeScript(filename: string) {
  return filename.endsWith('.ts') || filename.endsWith('.tsx') || filename.endsWith('.mts') || filename.endsWith('.cts');
}

export function babelTransform(code: string, filename: string, isModule: boolean, pluginsEpilogue: [string, any?][], useDefineForClassFields: boolean, jsx?: JsxOptions): BabelFileResult | null {
  if (isTransforming)
    return null;

  // Prevent reentry while requiring plugins lazily.
  isTransforming = true;
  try {
    const options = babelTransformOptions(isTypeScript(filename), isModule, pluginsEpilogue, useDefineForClassFields, jsx);
    return babel.transform(code, { filename, ...options });
  } finally {
    isTransforming = false;
  }
}

export function babelParse(code: string, filename: string, isModule: boolean): babel.ParseResult {
  const options = babelTransformOptions(isTypeScript(filename), isModule, [], true);
  return babel.parse(code, { filename, ...options })!;
}
