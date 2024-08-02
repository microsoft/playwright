"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.MultipartFormData = void 0;
var _utilsBundle = require("../utilsBundle");
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

class MultipartFormData {
  constructor() {
    this._boundary = void 0;
    this._chunks = [];
    this._boundary = generateUniqueBoundaryString();
  }
  contentTypeHeader() {
    return `multipart/form-data; boundary=${this._boundary}`;
  }
  addField(name, value) {
    this._beginMultiPartHeader(name);
    this._finishMultiPartHeader();
    this._chunks.push(Buffer.from(value));
    this._finishMultiPartField();
  }
  addFileField(name, value) {
    this._beginMultiPartHeader(name);
    this._chunks.push(Buffer.from(`; filename="${value.name}"`));
    this._chunks.push(Buffer.from(`\r\ncontent-type: ${value.mimeType || _utilsBundle.mime.getType(value.name) || 'application/octet-stream'}`));
    this._finishMultiPartHeader();
    this._chunks.push(value.buffer);
    this._finishMultiPartField();
  }
  finish() {
    this._addBoundary(true);
    return Buffer.concat(this._chunks);
  }
  _beginMultiPartHeader(name) {
    this._addBoundary();
    this._chunks.push(Buffer.from(`content-disposition: form-data; name="${name}"`));
  }
  _finishMultiPartHeader() {
    this._chunks.push(Buffer.from(`\r\n\r\n`));
  }
  _finishMultiPartField() {
    this._chunks.push(Buffer.from(`\r\n`));
  }
  _addBoundary(isLastBoundary) {
    this._chunks.push(Buffer.from('--' + this._boundary));
    if (isLastBoundary) this._chunks.push(Buffer.from('--'));
    this._chunks.push(Buffer.from('\r\n'));
  }
}
exports.MultipartFormData = MultipartFormData;
const alphaNumericEncodingMap = [0x41, 0x42, 0x43, 0x44, 0x45, 0x46, 0x47, 0x48, 0x49, 0x4A, 0x4B, 0x4C, 0x4D, 0x4E, 0x4F, 0x50, 0x51, 0x52, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59, 0x5A, 0x61, 0x62, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69, 0x6A, 0x6B, 0x6C, 0x6D, 0x6E, 0x6F, 0x70, 0x71, 0x72, 0x73, 0x74, 0x75, 0x76, 0x77, 0x78, 0x79, 0x7A, 0x30, 0x31, 0x32, 0x33, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x41, 0x42];

// See generateUniqueBoundaryString() in WebKit
function generateUniqueBoundaryString() {
  const charCodes = [];
  for (let i = 0; i < 16; i++) charCodes.push(alphaNumericEncodingMap[Math.floor(Math.random() * alphaNumericEncodingMap.length)]);
  return '----WebKitFormBoundary' + String.fromCharCode(...charCodes);
}