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

export const yazl: typeof import('../bundles/zip/node_modules/@types/yazl') = require('./zipBundleImpl').yazl;
export type { ZipFile } from '../bundles/zip/node_modules/@types/yazl';
export const yauzl: typeof import('../bundles/zip/node_modules/@types/yauzl') = require('./zipBundleImpl').yauzl;
export type { Entry, ZipFile as UnzipFile } from '../bundles/zip/node_modules/@types/yauzl';
export const extract: typeof import('../bundles/zip/src/third_party/extract-zip.d.ts') = require('./zipBundleImpl').extract;
