"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.HarRecorder = void 0;
var _fs = _interopRequireDefault(require("fs"));
var _path = _interopRequireDefault(require("path"));
var _artifact = require("../artifact");
var _harTracer = require("./harTracer");
var _zipBundle = require("../../zipBundle");
var _manualPromise = require("../../utils/manualPromise");
var _utils = require("../../utils");
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

class HarRecorder {
  constructor(context, page, options) {
    this._artifact = void 0;
    this._isFlushed = false;
    this._tracer = void 0;
    this._entries = [];
    this._zipFile = null;
    this._writtenZipEntries = new Set();
    this._artifact = new _artifact.Artifact(context, _path.default.join(context._browser.options.artifactsDir, `${(0, _utils.createGuid)()}.har`));
    const urlFilterRe = options.urlRegexSource !== undefined && options.urlRegexFlags !== undefined ? new RegExp(options.urlRegexSource, options.urlRegexFlags) : undefined;
    const expectsZip = options.path.endsWith('.zip');
    const content = options.content || (expectsZip ? 'attach' : 'embed');
    this._tracer = new _harTracer.HarTracer(context, page, this, {
      content,
      slimMode: options.mode === 'minimal',
      includeTraceInfo: false,
      recordRequestOverrides: true,
      waitForContentOnStop: true,
      urlFilter: urlFilterRe !== null && urlFilterRe !== void 0 ? urlFilterRe : options.urlGlob
    });
    this._zipFile = content === 'attach' || expectsZip ? new _zipBundle.yazl.ZipFile() : null;
    this._tracer.start({
      omitScripts: false
    });
  }
  onEntryStarted(entry) {
    this._entries.push(entry);
  }
  onEntryFinished(entry) {}
  onContentBlob(sha1, buffer) {
    if (!this._zipFile || this._writtenZipEntries.has(sha1)) return;
    this._writtenZipEntries.add(sha1);
    this._zipFile.addBuffer(buffer, sha1);
  }
  async flush() {
    if (this._isFlushed) return;
    this._isFlushed = true;
    await this._tracer.flush();
    const log = this._tracer.stop();
    log.entries = this._entries;
    const harFileContent = jsonStringify({
      log
    });
    if (this._zipFile) {
      const result = new _manualPromise.ManualPromise();
      this._zipFile.on('error', error => result.reject(error));
      this._zipFile.addBuffer(Buffer.from(harFileContent, 'utf-8'), 'har.har');
      this._zipFile.end();
      this._zipFile.outputStream.pipe(_fs.default.createWriteStream(this._artifact.localPath())).on('close', () => {
        result.resolve();
      });
      await result;
    } else {
      await _fs.default.promises.writeFile(this._artifact.localPath(), harFileContent);
    }
  }
  async export() {
    await this.flush();
    this._artifact.reportFinished();
    return this._artifact;
  }
}
exports.HarRecorder = HarRecorder;
function jsonStringify(object) {
  const tokens = [];
  innerJsonStringify(object, tokens, '', false, undefined);
  return tokens.join('');
}
function innerJsonStringify(object, tokens, indent, flat, parentKey) {
  if (typeof object !== 'object' || object === null) {
    tokens.push(JSON.stringify(object));
    return;
  }
  const isArray = Array.isArray(object);
  if (!isArray && object.constructor.name !== 'Object') {
    tokens.push(JSON.stringify(object));
    return;
  }
  const entries = isArray ? object : Object.entries(object).filter(e => e[1] !== undefined);
  if (!entries.length) {
    tokens.push(isArray ? `[]` : `{}`);
    return;
  }
  const childIndent = `${indent}  `;
  let brackets;
  if (isArray) brackets = flat ? {
    open: '[',
    close: ']'
  } : {
    open: `[\n${childIndent}`,
    close: `\n${indent}]`
  };else brackets = flat ? {
    open: '{ ',
    close: ' }'
  } : {
    open: `{\n${childIndent}`,
    close: `\n${indent}}`
  };
  tokens.push(brackets.open);
  for (let i = 0; i < entries.length; ++i) {
    const entry = entries[i];
    if (i) tokens.push(flat ? `, ` : `,\n${childIndent}`);
    if (!isArray) tokens.push(`${JSON.stringify(entry[0])}: `);
    const key = isArray ? undefined : entry[0];
    const flatten = flat || key === 'timings' || parentKey === 'headers';
    innerJsonStringify(isArray ? entry : entry[1], tokens, childIndent, flatten, key);
  }
  tokens.push(brackets.close);
}