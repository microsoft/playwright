"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Watcher = void 0;
var _utilsBundle = require("./utilsBundle");
var _path = _interopRequireDefault(require("path"));
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

class Watcher {
  constructor(mode, onChange) {
    this._onChange = void 0;
    this._watchedFiles = [];
    this._ignoredFolders = [];
    this._collector = [];
    this._fsWatcher = void 0;
    this._throttleTimer = void 0;
    this._mode = void 0;
    this._mode = mode;
    this._onChange = onChange;
  }
  update(watchedFiles, ignoredFolders, reportPending) {
    var _this$_fsWatcher;
    if (JSON.stringify([this._watchedFiles, this._ignoredFolders]) === JSON.stringify(watchedFiles, ignoredFolders)) return;
    if (reportPending) this._reportEventsIfAny();
    this._watchedFiles = watchedFiles;
    this._ignoredFolders = ignoredFolders;
    void ((_this$_fsWatcher = this._fsWatcher) === null || _this$_fsWatcher === void 0 ? void 0 : _this$_fsWatcher.close());
    this._fsWatcher = undefined;
    this._collector.length = 0;
    clearTimeout(this._throttleTimer);
    this._throttleTimer = undefined;
    if (!this._watchedFiles.length) return;
    const ignored = [...this._ignoredFolders, name => name.includes(_path.default.sep + 'node_modules' + _path.default.sep)];
    this._fsWatcher = _utilsBundle.chokidar.watch(watchedFiles, {
      ignoreInitial: true,
      ignored
    }).on('all', async (event, file) => {
      if (this._throttleTimer) clearTimeout(this._throttleTimer);
      if (this._mode === 'flat' && event !== 'add' && event !== 'change') return;
      if (this._mode === 'deep' && event !== 'add' && event !== 'change' && event !== 'unlink' && event !== 'addDir' && event !== 'unlinkDir') return;
      this._collector.push({
        event,
        file
      });
      this._throttleTimer = setTimeout(() => this._reportEventsIfAny(), 250);
    });
  }
  async close() {
    var _this$_fsWatcher2;
    await ((_this$_fsWatcher2 = this._fsWatcher) === null || _this$_fsWatcher2 === void 0 ? void 0 : _this$_fsWatcher2.close());
  }
  _reportEventsIfAny() {
    if (this._collector.length) this._onChange(this._collector.slice());
    this._collector.length = 0;
  }
}
exports.Watcher = Watcher;