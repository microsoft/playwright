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

// from playwright-core

import colorsLibrary from '../../../playwright-core/bundles/utils/node_modules/colors/safe';
export const colors = colorsLibrary;

import debugLibrary from '../../../playwright-core/bundles/utils/node_modules/debug';
export const debug = debugLibrary;

import * as diffMatchPatch from '../../../playwright-core/bundles/utils/src/third_party/diff_match_patch';
export * from '../../../playwright-core/bundles/utils/src/third_party/diff_match_patch';

import jpegLibrary from '../../../playwright-core/bundles/utils/node_modules/jpeg-js';
export const jpegjs = jpegLibrary;

import mimeLibrary from '../../../playwright-core/bundles/utils/node_modules/mime';
export const mime = mimeLibrary;

import minimatchLibrary from '../../../playwright-core/bundles/utils/node_modules/minimatch';
export const minimatch = minimatchLibrary;

// @ts-ignore
import pixelmatchLibrary from '../../../playwright-core/bundles/utils/src/third_party/pixelmatch';
export const pixelmatch = pixelmatchLibrary;

import { PNG } from '../../../playwright-core/bundles/utils/node_modules/pngjs/browser';
export { PNG } from '../../../playwright-core/bundles/utils/node_modules/pngjs/browser';

import StackUtilsLibrary from '../../../playwright-core/bundles/utils/node_modules/stack-utils';
export const StackUtils = StackUtilsLibrary;

// from playwright-test

import json5Library from '../../../playwright-test/bundles/utils/node_modules/json5';
export const json5 = json5Library;

import sourceMapSupportLibrary from '../../../playwright-test/bundles/utils/node_modules/source-map-support';
export const sourceMapSupport = sourceMapSupportLibrary;

export default {
  // playwright-core
  debug,
  ...diffMatchPatch,
  jpegjs,
  mime,
  minimatch,
  pixelmatch,
  PNG,
  StackUtils,
  // playwright-test
};
