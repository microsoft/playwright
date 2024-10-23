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

import type { BabelFileResult } from '../../bundles/babel/node_modules/@types/babel__core';
export const codeFrameColumns: typeof import('../../bundles/babel/node_modules/@types/babel__code-frame').codeFrameColumns = require('./babelBundleImpl').codeFrameColumns;
export const declare: typeof import('../../bundles/babel/node_modules/@types/babel__helper-plugin-utils').declare = require('./babelBundleImpl').declare;
export const types: typeof import('../../bundles/babel/node_modules/@types/babel__core').types = require('./babelBundleImpl').types;
export const parse: typeof import('../../bundles/babel/node_modules/@babel/parser/typings/babel-parser').parse = require('./babelBundleImpl').parse;
export const traverse: typeof import('../../bundles/babel/node_modules/@types/babel__traverse').default = require('./babelBundleImpl').traverse;
export type BabelPlugin = [string, any?];
export type BabelTransformFunction = (code: string, filename: string, isTypeScript: boolean, isModule: boolean, pluginsPrefix: BabelPlugin[], pluginsSuffix: BabelPlugin[]) => BabelFileResult;
export const babelTransform: BabelTransformFunction = require('./babelBundleImpl').babelTransform;
export type { NodePath, types as T, PluginObj } from '../../bundles/babel/node_modules/@types/babel__core';
export type { BabelAPI } from '../../bundles/babel/node_modules/@types/babel__helper-plugin-utils';
