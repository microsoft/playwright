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

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as util from 'util';

export type Platform = {
  calculateSha1(text: string): Promise<string>;
  createGuid: () => string;
  fs: () => typeof fs;
  inspectCustom: symbol | undefined;
  path: () => typeof path;
  pathSeparator: string;
  ws?: (url: string) => WebSocket;
};

export const nodePlatform: Platform = {
  calculateSha1: (text: string) => {
    const sha1 = crypto.createHash('sha1');
    sha1.update(text);
    return Promise.resolve(sha1.digest('hex'));
  },

  createGuid: () => crypto.randomBytes(16).toString('hex'),

  fs: () => fs,

  inspectCustom: util.inspect.custom,

  path: () => path,

  pathSeparator: path.sep
};

export const webPlatform: Platform = {
  calculateSha1: async (text: string) => {
    const bytes = new TextEncoder().encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-1', bytes);
    return Array.from(new Uint8Array(hashBuffer), b => b.toString(16).padStart(2, '0')).join('');
  },

  createGuid: () => {
    return Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('');
  },

  fs: () => {
    throw new Error('File system is not available');
  },

  inspectCustom: undefined,

  path: () => {
    throw new Error('Path module is not available');
  },

  pathSeparator: '/',

  ws: (url: string) => new WebSocket(url),
};
