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

import FS from '../../bundles/crxdeps/node_modules/@isomorphic-git/lightning-fs';
import { errorProxy } from './error';

const fs = new FS('crx');

export const promises = fs.promises;

// we don't want these calls to appear
export const createWriteStream = /* @__PURE__ */ errorProxy('fs.createWriteStream not allowed in CRX');
export const existsSync = /* @__PURE__ */ () => false;
export const readFileSync = /* @__PURE__ */ errorProxy('fs.readFileSync not allowed in CRX');
export const statSync = /* @__PURE__ */ errorProxy('fs.statSync not allowed in CRX');
export const mkdirSync = /* @__PURE__ */ errorProxy('fs.mkdirSync not allowed in CRX');
export const writeFileSync = /* @__PURE__ */ errorProxy('fs.writeFileSync not allowed in CRX');

export default fs;
