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

import rimrafLibrary from 'rimraf';
export const rimraf = rimrafLibrary;

import lockfileLibrary from 'proper-lockfile';
export const lockfile = lockfileLibrary;

import StackUtilsLibrary from 'stack-utils';
export const StackUtils = StackUtilsLibrary;

export { HttpsProxyAgent } from 'https-proxy-agent';
export { SocksProxyAgent } from 'socks-proxy-agent';
export { getProxyForUrl } from 'proxy-from-env';
