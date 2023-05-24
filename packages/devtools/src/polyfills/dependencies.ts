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
import colors from 'colors/safe';
import debug from 'debug';
import { getProxyForUrl } from 'proxy-from-env';
import { HttpsProxyAgent } from 'https-proxy-agent';
import jpegjs from 'jpeg-js';
import mime from 'mime';
import minimatch from 'minimatch';
import { PNG } from 'pngjs';
import { program } from 'commander';
import progress from 'progress';
import rimraf from 'rimraf';
import { SocksProxyAgent } from 'socks-proxy-agent';
// @ts-ignore
import StackUtils from 'stack-utils';
// @ts-ignore
import ws, { WebSocketServer as wsServer, Receiver as wsReceiver, Sender as wsSender } from 'ws';

import './process-shim';

// @ts-ignore
self.setImmediate = function(fn: Function) {
  return setTimeout(fn, 0);
};

// @ts-ignore
self.utilsBundle = {
  colors,
  debug,
  getProxyForUrl,
  HttpsProxyAgent,
  jpegjs,
  lockfile: {},
  mime,
  minimatch,
  PNG,
  program,
  progress,
  rimraf,
  SocksProxyAgent,
  StackUtils,
  ws,
  // @ts-ignore
  wsServer, wsReceiver, wsSender,
  setImmediate
};
