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

import colorsLibrary from 'colors/safe';
export const colors = colorsLibrary;

import debugLibrary from 'debug';
export const debug = debugLibrary;

export { getProxyForUrl } from 'proxy-from-env';

export { HttpsProxyAgent } from 'https-proxy-agent';

import jpegLibrary from 'jpeg-js';
export const jpegjs = jpegLibrary;

import lockfileLibrary from 'proper-lockfile';
export const lockfile = lockfileLibrary;

import mimeLibrary from 'mime';
export const mime = mimeLibrary;

import minimatchLibrary from 'minimatch';
export const minimatch = minimatchLibrary;

import msLibrary from 'ms';
export const ms = msLibrary;

export { PNG } from 'pngjs';

export { program } from 'commander';

import progressLibrary from 'progress';
export const progress = progressLibrary;

import rimrafLibrary from 'rimraf';
export const rimraf = rimrafLibrary;

export { SocksProxyAgent } from 'socks-proxy-agent';

import StackUtilsLibrary from 'stack-utils';
export const StackUtils = StackUtilsLibrary;

// @ts-ignore
import wsLibrary, { WebSocketServer, Receiver, Sender } from 'ws';
export const ws = wsLibrary;
export const wsServer = WebSocketServer;
export const wsReceiver = Receiver;
export const wsSender = Sender;
