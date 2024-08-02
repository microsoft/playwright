"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.defaultTimeout = void 0;
exports.loadTestFile = loadTestFile;
var _path = _interopRequireDefault(require("path"));
var _util = _interopRequireDefault(require("util"));
var _globals = require("./globals");
var _test = require("./test");
var _transform = require("../transform/transform");
var _util2 = require("../util");
var _compilationCache = require("../transform/compilationCache");
var esmLoaderHost = _interopRequireWildcard(require("./esmLoaderHost"));
function _getRequireWildcardCache(e) { if ("function" != typeof WeakMap) return null; var r = new WeakMap(), t = new WeakMap(); return (_getRequireWildcardCache = function (e) { return e ? t : r; })(e); }
function _interopRequireWildcard(e, r) { if (!r && e && e.__esModule) return e; if (null === e || "object" != typeof e && "function" != typeof e) return { default: e }; var t = _getRequireWildcardCache(r); if (t && t.has(e)) return t.get(e); var n = { __proto__: null }, a = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var u in e) if ("default" !== u && Object.prototype.hasOwnProperty.call(e, u)) { var i = a ? Object.getOwnPropertyDescriptor(e, u) : null; i && (i.get || i.set) ? Object.defineProperty(n, u, i) : n[u] = e[u]; } return n.default = e, t && t.set(e, n), n; }
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
/**
 * Copyright Microsoft Corporation. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const defaultTimeout = exports.defaultTimeout = 30000;

// To allow multiple loaders in the same process without clearing require cache,
// we make these maps global.
const cachedFileSuites = new Map();
async function loadTestFile(file, rootDir, testErrors) {
  if (cachedFileSuites.has(file)) return cachedFileSuites.get(file);
  const suite = new _test.Suite(_path.default.relative(rootDir, file) || _path.default.basename(file), 'file');
  suite._requireFile = file;
  suite.location = {
    file,
    line: 0,
    column: 0
  };
  (0, _globals.setCurrentlyLoadingFileSuite)(suite);
  if (!(0, _globals.isWorkerProcess)()) {
    (0, _compilationCache.startCollectingFileDeps)();
    await esmLoaderHost.startCollectingFileDeps();
  }
  try {
    await (0, _transform.requireOrImport)(file);
    cachedFileSuites.set(file, suite);
  } catch (e) {
    if (!testErrors) throw e;
    testErrors.push(serializeLoadError(file, e));
  } finally {
    (0, _globals.setCurrentlyLoadingFileSuite)(undefined);
    if (!(0, _globals.isWorkerProcess)()) {
      (0, _compilationCache.stopCollectingFileDeps)(file);
      await esmLoaderHost.stopCollectingFileDeps(file);
    }
  }
  {
    // Test locations that we discover potentially have different file name.
    // This could be due to either
    //   a) use of source maps or due to
    //   b) require of one file from another.
    // Try fixing (a) w/o regressing (b).

    const files = new Set();
    suite.allTests().map(t => files.add(t.location.file));
    if (files.size === 1) {
      // All tests point to one file.
      const mappedFile = files.values().next().value;
      if (suite.location.file !== mappedFile) {
        // The file is different, check for a likely source map case.
        if (_path.default.extname(mappedFile) !== _path.default.extname(suite.location.file)) suite.location.file = mappedFile;
      }
    }
  }
  return suite;
}
function serializeLoadError(file, error) {
  if (error instanceof Error) {
    const result = (0, _util2.filterStackTrace)(error);
    // Babel parse errors have location.
    const loc = error.loc;
    result.location = loc ? {
      file,
      line: loc.line || 0,
      column: loc.column || 0
    } : undefined;
    return result;
  }
  return {
    value: _util.default.inspect(error)
  };
}