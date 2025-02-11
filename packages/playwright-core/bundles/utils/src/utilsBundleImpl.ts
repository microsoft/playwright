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

/* eslint-disable import/order */

import colorsLibrary from 'colors/safe';
export const colors = colorsLibrary;

import debugLibrary from 'debug';
export const debug = debugLibrary;

import * as diffLibrary from 'diff';
export const diff = diffLibrary;

import dotenvLibrary from 'dotenv';
export const dotenv = dotenvLibrary;

export { getProxyForUrl } from 'proxy-from-env';

export { HttpsProxyAgent } from 'https-proxy-agent';

import jpegLibrary from 'jpeg-js';
export const jpegjs = jpegLibrary;

const lockfileLibrary = require('./third_party/lockfile');
export const lockfile = lockfileLibrary;

import mimeLibrary from 'mime';
export const mime = mimeLibrary;

import minimatchLibrary from 'minimatch';
export const minimatch = minimatchLibrary;

import openLibrary from 'open';
export const open = openLibrary;

export { PNG } from 'pngjs';

export { program } from 'commander';

import progressLibrary from 'progress';
export const progress = progressLibrary;

export { SocksProxyAgent } from 'socks-proxy-agent';

import yamlLibrary from 'yaml';
export const yaml = yamlLibrary;

// @ts-ignore
import wsLibrary, { WebSocketServer, Receiver, Sender } from 'ws';
export const ws = wsLibrary;
export const wsServer = WebSocketServer;
export const wsReceiver = Receiver;
export const wsSender = Sender;
