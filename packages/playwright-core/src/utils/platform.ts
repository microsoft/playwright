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

import * as fs from 'fs';
import * as path from 'path';
import * as util from 'util';

export type Platform = {
  fs: () => typeof fs;
  path: () => typeof path;
  inspectCustom: symbol | undefined;
  ws?: (url: string) => WebSocket;
};

export const emptyPlatform: Platform = {
  fs: () => {
    throw new Error('File system is not available');
  },

  path: () => {
    throw new Error('Path module is not available');
  },

  inspectCustom: undefined,
};

export const nodePlatform: Platform = {
  fs: () => fs,
  path: () => path,
  inspectCustom: util.inspect.custom,
};

export const webPlatform: Platform = {
  ...emptyPlatform,
  ws: (url: string) => new WebSocket(url),
};
