"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.WorkerHost = void 0;
var _fs = _interopRequireDefault(require("fs"));
var _path = _interopRequireDefault(require("path"));
var _ipc = require("../common/ipc");
var _processHost = require("./processHost");
var _folders = require("../isomorphic/folders");
var _utils = require("playwright-core/lib/utils");
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

let lastWorkerIndex = 0;
class WorkerHost extends _processHost.ProcessHost {
  constructor(testGroup, parallelIndex, config, extraEnv, outputDir) {
    const workerIndex = lastWorkerIndex++;
    super(require.resolve('../worker/workerMain.js'), `worker-${workerIndex}`, {
      ...extraEnv,
      FORCE_COLOR: '1',
      DEBUG_COLORS: '1'
    });
    this.parallelIndex = void 0;
    this.workerIndex = void 0;
    this._hash = void 0;
    this._params = void 0;
    this._didFail = false;
    this.workerIndex = workerIndex;
    this.parallelIndex = parallelIndex;
    this._hash = testGroup.workerHash;
    this._params = {
      workerIndex: this.workerIndex,
      parallelIndex,
      repeatEachIndex: testGroup.repeatEachIndex,
      projectId: testGroup.projectId,
      config,
      artifactsDir: _path.default.join(outputDir, (0, _folders.artifactsFolderName)(workerIndex))
    };
  }
  async start() {
    await _fs.default.promises.mkdir(this._params.artifactsDir, {
      recursive: true
    });
    return await this.startRunner(this._params, {
      onStdOut: chunk => this.emit('stdOut', (0, _ipc.stdioChunkToParams)(chunk)),
      onStdErr: chunk => this.emit('stdErr', (0, _ipc.stdioChunkToParams)(chunk))
    });
  }
  async onExit() {
    await (0, _utils.removeFolders)([this._params.artifactsDir]);
  }
  async stop(didFail) {
    if (didFail) this._didFail = true;
    await super.stop();
  }
  runTestGroup(runPayload) {
    this.sendMessageNoReply({
      method: 'runTestGroup',
      params: runPayload
    });
  }
  hash() {
    return this._hash;
  }
  didFail() {
    return this._didFail;
  }
}
exports.WorkerHost = WorkerHost;