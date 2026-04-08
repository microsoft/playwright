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

import { libPath } from '../package';

import type { BabelFileResult, ParseResult } from '../../bundles/babel/node_modules/@types/babel__core';
const babelBundleImpl = require(libPath('transform', 'babelBundleImpl'));
export const codeFrameColumns: typeof import('../../bundles/babel/node_modules/@types/babel__code-frame').codeFrameColumns = babelBundleImpl.codeFrameColumns;
export const declare: typeof import('../../bundles/babel/node_modules/@types/babel__helper-plugin-utils').declare = babelBundleImpl.declare;
export const types: typeof import('../../bundles/babel/node_modules/@types/babel__core').types = babelBundleImpl.types;
export const traverse: typeof import('../../bundles/babel/node_modules/@types/babel__traverse').default = babelBundleImpl.traverse;
export type BabelPlugin = [string, any?];
export type BabelTransformFunction = (code: string, filename: string, isModule: boolean, pluginsPrefix: BabelPlugin[], pluginsSuffix: BabelPlugin[]) => BabelFileResult | null;
export const babelTransform: BabelTransformFunction = babelBundleImpl.babelTransform;
export type BabelParseFunction = (code: string, filename: string, isModule: boolean) => ParseResult;
export const babelParse: BabelParseFunction = babelBundleImpl.babelParse;
export type { NodePath, PluginObj, types as T } from '../../bundles/babel/node_modules/@types/babel__core';
export type { BabelAPI } from '../../bundles/babel/node_modules/@types/babel__helper-plugin-utils';
