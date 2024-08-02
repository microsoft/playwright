"use strict";

var _fs = _interopRequireDefault(require("fs"));
var _url = _interopRequireDefault(require("url"));
var _compilationCache = require("./compilationCache");
var _transform = require("./transform");
var _portTransport = require("./portTransport");
var _util = require("../util");
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

// Node < 18.6: defaultResolve takes 3 arguments.
// Node >= 18.6: nextResolve from the chain takes 2 arguments.
async function resolve(specifier, context, defaultResolve) {
  var _currentFileDepsColle;
  if (context.parentURL && context.parentURL.startsWith('file://')) {
    const filename = _url.default.fileURLToPath(context.parentURL);
    const resolved = (0, _transform.resolveHook)(filename, specifier);
    if (resolved !== undefined) specifier = _url.default.pathToFileURL(resolved).toString();
  }
  const result = await defaultResolve(specifier, context, defaultResolve);
  // Note: we collect dependencies here that will be sent to the main thread
  // (and optionally runner process) after the loading finishes.
  if (result !== null && result !== void 0 && result.url && result.url.startsWith('file://')) (_currentFileDepsColle = (0, _compilationCache.currentFileDepsCollector)()) === null || _currentFileDepsColle === void 0 || _currentFileDepsColle.add(_url.default.fileURLToPath(result.url));
  return result;
}

// Node < 18.6: defaultLoad takes 3 arguments.
// Node >= 18.6: nextLoad from the chain takes 2 arguments.
async function load(moduleUrl, context, defaultLoad) {
  var _transport;
  // Bail out for wasm, json, etc.
  // non-js files have context.format === undefined
  if (context.format !== 'commonjs' && context.format !== 'module' && context.format !== undefined) return defaultLoad(moduleUrl, context, defaultLoad);

  // Bail for built-in modules.
  if (!moduleUrl.startsWith('file://')) return defaultLoad(moduleUrl, context, defaultLoad);
  const filename = _url.default.fileURLToPath(moduleUrl);
  // Bail for node_modules.
  if (!(0, _transform.shouldTransform)(filename)) return defaultLoad(moduleUrl, context, defaultLoad);
  const code = _fs.default.readFileSync(filename, 'utf-8');
  const transformed = (0, _transform.transformHook)(code, filename, moduleUrl);

  // Flush the source maps to the main thread, so that errors during import() are source-mapped.
  if (transformed.serializedCache) await ((_transport = transport) === null || _transport === void 0 ? void 0 : _transport.send('pushToCompilationCache', {
    cache: transformed.serializedCache
  }));

  // Output format is required, so we determine it manually when unknown.
  // shortCircuit is required by Node >= 18.6 to designate no more loaders should be called.
  return {
    format: context.format || ((0, _util.fileIsModule)(filename) ? 'module' : 'commonjs'),
    source: transformed.code,
    shortCircuit: true
  };
}
let transport;

// Node.js < 20
function globalPreload(context) {
  transport = createTransport(context.port);
  return `
    globalThis.__esmLoaderPortPreV20 = port;
  `;
}

// Node.js >= 20
function initialize(data) {
  transport = createTransport(data === null || data === void 0 ? void 0 : data.port);
}
function createTransport(port) {
  return new _portTransport.PortTransport(port, async (method, params) => {
    if (method === 'setTransformConfig') {
      (0, _transform.setTransformConfig)(params.config);
      return;
    }
    if (method === 'addToCompilationCache') {
      (0, _compilationCache.addToCompilationCache)(params.cache);
      return;
    }
    if (method === 'getCompilationCache') return {
      cache: (0, _compilationCache.serializeCompilationCache)()
    };
    if (method === 'startCollectingFileDeps') {
      (0, _compilationCache.startCollectingFileDeps)();
      return;
    }
    if (method === 'stopCollectingFileDeps') {
      (0, _compilationCache.stopCollectingFileDeps)(params.file);
      return;
    }
  });
}
module.exports = {
  resolve,
  load,
  globalPreload,
  initialize
};