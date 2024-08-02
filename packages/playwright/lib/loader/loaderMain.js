"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.create = exports.LoaderMain = void 0;
var _configLoader = require("../common/configLoader");
var _process = require("../common/process");
var _testLoader = require("../common/testLoader");
var _compilationCache = require("../transform/compilationCache");
var _poolBuilder = require("../common/poolBuilder");
var _esmLoaderHost = require("../common/esmLoaderHost");
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

class LoaderMain extends _process.ProcessRunner {
  constructor(serializedConfig) {
    super();
    this._serializedConfig = void 0;
    this._configPromise = void 0;
    this._poolBuilder = _poolBuilder.PoolBuilder.createForLoader();
    this._serializedConfig = serializedConfig;
  }
  _config() {
    if (!this._configPromise) this._configPromise = (0, _configLoader.deserializeConfig)(this._serializedConfig);
    return this._configPromise;
  }
  async loadTestFile(params) {
    const testErrors = [];
    const config = await this._config();
    const fileSuite = await (0, _testLoader.loadTestFile)(params.file, config.config.rootDir, testErrors);
    this._poolBuilder.buildPools(fileSuite);
    return {
      fileSuite: fileSuite._deepSerialize(),
      testErrors
    };
  }
  async getCompilationCacheFromLoader() {
    await (0, _esmLoaderHost.incorporateCompilationCache)();
    return (0, _compilationCache.serializeCompilationCache)();
  }
}
exports.LoaderMain = LoaderMain;
const create = config => new LoaderMain(config);
exports.create = create;