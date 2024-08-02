"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Download = void 0;
var _path = _interopRequireDefault(require("path"));
var _page = require("./page");
var _utils = require("../utils");
var _artifact = require("./artifact");
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
/**
 * Copyright (c) Microsoft Corporation.
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

class Download {
  constructor(page, downloadsPath, uuid, url, suggestedFilename) {
    this.artifact = void 0;
    this.url = void 0;
    this._page = void 0;
    this._suggestedFilename = void 0;
    const unaccessibleErrorMessage = page._browserContext._options.acceptDownloads === 'deny' ? 'Pass { acceptDownloads: true } when you are creating your browser context.' : undefined;
    this.artifact = new _artifact.Artifact(page, _path.default.join(downloadsPath, uuid), unaccessibleErrorMessage, () => {
      return this._page._browserContext.cancelDownload(uuid);
    });
    this._page = page;
    this.url = url;
    this._suggestedFilename = suggestedFilename;
    page._browserContext._downloads.add(this);
    if (suggestedFilename !== undefined) this._page.emit(_page.Page.Events.Download, this);
  }
  _filenameSuggested(suggestedFilename) {
    (0, _utils.assert)(this._suggestedFilename === undefined);
    this._suggestedFilename = suggestedFilename;
    this._page.emit(_page.Page.Events.Download, this);
  }
  suggestedFilename() {
    return this._suggestedFilename;
  }
}
exports.Download = Download;