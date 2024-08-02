"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.esmLoaderRegistered = void 0;
exports.incorporateCompilationCache = incorporateCompilationCache;
exports.initializeEsmLoader = initializeEsmLoader;
exports.registerESMLoader = registerESMLoader;
exports.startCollectingFileDeps = startCollectingFileDeps;
exports.stopCollectingFileDeps = stopCollectingFileDeps;
var _url = _interopRequireDefault(require("url"));
var _compilationCache = require("../transform/compilationCache");
var _transform = require("../transform/transform");
var _portTransport = require("../transform/portTransport");
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
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

let loaderChannel;
// Node.js < 20
if (globalThis.__esmLoaderPortPreV20) loaderChannel = createPortTransport(globalThis.__esmLoaderPortPreV20);

// Node.js >= 20
let esmLoaderRegistered = exports.esmLoaderRegistered = false;
function registerESMLoader() {
  const {
    port1,
    port2
  } = new MessageChannel();
  // register will wait until the loader is initialized.
  require('node:module').register(_url.default.pathToFileURL(require.resolve('../transform/esmLoader')), {
    parentURL: _url.default.pathToFileURL(__filename),
    data: {
      port: port2
    },
    transferList: [port2]
  });
  loaderChannel = createPortTransport(port1);
  exports.esmLoaderRegistered = esmLoaderRegistered = true;
}
function createPortTransport(port) {
  return new _portTransport.PortTransport(port, async (method, params) => {
    if (method === 'pushToCompilationCache') (0, _compilationCache.addToCompilationCache)(params.cache);
  });
}
async function startCollectingFileDeps() {
  if (!loaderChannel) return;
  await loaderChannel.send('startCollectingFileDeps', {});
}
async function stopCollectingFileDeps(file) {
  if (!loaderChannel) return;
  await loaderChannel.send('stopCollectingFileDeps', {
    file
  });
}
async function incorporateCompilationCache() {
  if (!loaderChannel) return;
  // This is needed to gather dependency information from the esm loader
  // that is populated from the resolve hook. We do not need to push
  // this information proactively during load, but gather it at the end.
  const result = await loaderChannel.send('getCompilationCache', {});
  (0, _compilationCache.addToCompilationCache)(result.cache);
}
async function initializeEsmLoader() {
  if (!loaderChannel) return;
  await loaderChannel.send('setTransformConfig', {
    config: (0, _transform.transformConfig)()
  });
  await loaderChannel.send('addToCompilationCache', {
    cache: (0, _compilationCache.serializeCompilationCache)()
  });
}