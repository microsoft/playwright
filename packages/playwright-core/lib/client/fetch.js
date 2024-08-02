"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.APIResponse = exports.APIRequestContext = exports.APIRequest = void 0;
var _fs = _interopRequireDefault(require("fs"));
var _path = _interopRequireDefault(require("path"));
var util = _interopRequireWildcard(require("util"));
var _utils = require("../utils");
var _fileUtils = require("../utils/fileUtils");
var _channelOwner = require("./channelOwner");
var _network = require("./network");
var _tracing = require("./tracing");
var _errors = require("./errors");
let _Symbol$asyncDispose, _Symbol$asyncDispose2, _util$inspect$custom;
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
function _getRequireWildcardCache(e) { if ("function" != typeof WeakMap) return null; var r = new WeakMap(), t = new WeakMap(); return (_getRequireWildcardCache = function (e) { return e ? t : r; })(e); }
function _interopRequireWildcard(e, r) { if (!r && e && e.__esModule) return e; if (null === e || "object" != typeof e && "function" != typeof e) return { default: e }; var t = _getRequireWildcardCache(r); if (t && t.has(e)) return t.get(e); var n = { __proto__: null }, a = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var u in e) if ("default" !== u && Object.prototype.hasOwnProperty.call(e, u)) { var i = a ? Object.getOwnPropertyDescriptor(e, u) : null; i && (i.get || i.set) ? Object.defineProperty(n, u, i) : n[u] = e[u]; } return n.default = e, t && t.set(e, n), n; }
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
class APIRequest {
  constructor(playwright) {
    this._playwright = void 0;
    this._contexts = new Set();
    // Instrumentation.
    this._defaultContextOptions = void 0;
    this._playwright = playwright;
  }
  async newContext(options = {}) {
    var _this$_defaultContext;
    options = {
      ...this._defaultContextOptions,
      ...options
    };
    const storageState = typeof options.storageState === 'string' ? JSON.parse(await _fs.default.promises.readFile(options.storageState, 'utf8')) : options.storageState;
    // We do not expose tracesDir in the API, so do not allow options to accidentally override it.
    const tracesDir = (_this$_defaultContext = this._defaultContextOptions) === null || _this$_defaultContext === void 0 ? void 0 : _this$_defaultContext.tracesDir;
    const context = APIRequestContext.from((await this._playwright._channel.newRequest({
      ...options,
      extraHTTPHeaders: options.extraHTTPHeaders ? (0, _utils.headersObjectToArray)(options.extraHTTPHeaders) : undefined,
      storageState,
      tracesDir
    })).request);
    this._contexts.add(context);
    context._request = this;
    context._tracing._tracesDir = tracesDir;
    await context._instrumentation.runAfterCreateRequestContext(context);
    return context;
  }
}
exports.APIRequest = APIRequest;
_Symbol$asyncDispose = Symbol.asyncDispose;
class APIRequestContext extends _channelOwner.ChannelOwner {
  static from(channel) {
    return channel._object;
  }
  constructor(parent, type, guid, initializer) {
    super(parent, type, guid, initializer);
    this._request = void 0;
    this._tracing = void 0;
    this._closeReason = void 0;
    this._tracing = _tracing.Tracing.from(initializer.tracing);
  }
  async [_Symbol$asyncDispose]() {
    await this.dispose();
  }
  async dispose(options = {}) {
    var _this$_request;
    this._closeReason = options.reason;
    await this._instrumentation.runBeforeCloseRequestContext(this);
    try {
      await this._channel.dispose(options);
    } catch (e) {
      if ((0, _errors.isTargetClosedError)(e)) return;
      throw e;
    }
    this._tracing._resetStackCounter();
    (_this$_request = this._request) === null || _this$_request === void 0 || _this$_request._contexts.delete(this);
  }
  async delete(url, options) {
    return await this.fetch(url, {
      ...options,
      method: 'DELETE'
    });
  }
  async head(url, options) {
    return await this.fetch(url, {
      ...options,
      method: 'HEAD'
    });
  }
  async get(url, options) {
    return await this.fetch(url, {
      ...options,
      method: 'GET'
    });
  }
  async patch(url, options) {
    return await this.fetch(url, {
      ...options,
      method: 'PATCH'
    });
  }
  async post(url, options) {
    return await this.fetch(url, {
      ...options,
      method: 'POST'
    });
  }
  async put(url, options) {
    return await this.fetch(url, {
      ...options,
      method: 'PUT'
    });
  }
  async fetch(urlOrRequest, options = {}) {
    const url = (0, _utils.isString)(urlOrRequest) ? urlOrRequest : undefined;
    const request = (0, _utils.isString)(urlOrRequest) ? undefined : urlOrRequest;
    return await this._innerFetch({
      url,
      request,
      ...options
    });
  }
  async _innerFetch(options = {}) {
    return await this._wrapApiCall(async () => {
      var _options$request, _options$request2, _options$request3;
      if (this._closeReason) throw new _errors.TargetClosedError(this._closeReason);
      (0, _utils.assert)(options.request || typeof options.url === 'string', 'First argument must be either URL string or Request');
      (0, _utils.assert)((options.data === undefined ? 0 : 1) + (options.form === undefined ? 0 : 1) + (options.multipart === undefined ? 0 : 1) <= 1, `Only one of 'data', 'form' or 'multipart' can be specified`);
      (0, _utils.assert)(options.maxRedirects === undefined || options.maxRedirects >= 0, `'maxRedirects' should be greater than or equal to '0'`);
      const url = options.url !== undefined ? options.url : options.request.url();
      const params = objectToArray(options.params);
      const method = options.method || ((_options$request = options.request) === null || _options$request === void 0 ? void 0 : _options$request.method());
      const maxRedirects = options.maxRedirects;
      // Cannot call allHeaders() here as the request may be paused inside route handler.
      const headersObj = options.headers || ((_options$request2 = options.request) === null || _options$request2 === void 0 ? void 0 : _options$request2.headers());
      const headers = headersObj ? (0, _utils.headersObjectToArray)(headersObj) : undefined;
      let jsonData;
      let formData;
      let multipartData;
      let postDataBuffer;
      if (options.data !== undefined) {
        if ((0, _utils.isString)(options.data)) {
          if (isJsonContentType(headers)) jsonData = isJsonParsable(options.data) ? options.data : JSON.stringify(options.data);else postDataBuffer = Buffer.from(options.data, 'utf8');
        } else if (Buffer.isBuffer(options.data)) {
          postDataBuffer = options.data;
        } else if (typeof options.data === 'object' || typeof options.data === 'number' || typeof options.data === 'boolean') {
          jsonData = JSON.stringify(options.data);
        } else {
          throw new Error(`Unexpected 'data' type`);
        }
      } else if (options.form) {
        formData = objectToArray(options.form);
      } else if (options.multipart) {
        multipartData = [];
        if (globalThis.FormData && options.multipart instanceof FormData) {
          const form = options.multipart;
          for (const [name, value] of form.entries()) {
            if ((0, _utils.isString)(value)) {
              multipartData.push({
                name,
                value
              });
            } else {
              const file = {
                name: value.name,
                mimeType: value.type,
                buffer: Buffer.from(await value.arrayBuffer())
              };
              multipartData.push({
                name,
                file
              });
            }
          }
        } else {
          // Convert file-like values to ServerFilePayload structs.
          for (const [name, value] of Object.entries(options.multipart)) multipartData.push(await toFormField(name, value));
        }
      }
      if (postDataBuffer === undefined && jsonData === undefined && formData === undefined && multipartData === undefined) postDataBuffer = ((_options$request3 = options.request) === null || _options$request3 === void 0 ? void 0 : _options$request3.postDataBuffer()) || undefined;
      const fixtures = {
        __testHookLookup: options.__testHookLookup
      };
      const result = await this._channel.fetch({
        url,
        params,
        method,
        headers,
        postData: postDataBuffer,
        jsonData,
        formData,
        multipartData,
        timeout: options.timeout,
        failOnStatusCode: options.failOnStatusCode,
        ignoreHTTPSErrors: options.ignoreHTTPSErrors,
        maxRedirects: maxRedirects,
        ...fixtures
      });
      return new APIResponse(this, result.response);
    });
  }
  async storageState(options = {}) {
    const state = await this._channel.storageState();
    if (options.path) {
      await (0, _fileUtils.mkdirIfNeeded)(options.path);
      await _fs.default.promises.writeFile(options.path, JSON.stringify(state, undefined, 2), 'utf8');
    }
    return state;
  }
}
exports.APIRequestContext = APIRequestContext;
async function toFormField(name, value) {
  if (isFilePayload(value)) {
    const payload = value;
    if (!Buffer.isBuffer(payload.buffer)) throw new Error(`Unexpected buffer type of 'data.${name}'`);
    return {
      name,
      file: filePayloadToJson(payload)
    };
  } else if (value instanceof _fs.default.ReadStream) {
    return {
      name,
      file: await readStreamToJson(value)
    };
  } else {
    return {
      name,
      value: String(value)
    };
  }
}
function isJsonParsable(value) {
  if (typeof value !== 'string') return false;
  try {
    JSON.parse(value);
    return true;
  } catch (e) {
    if (e instanceof SyntaxError) return false;else throw e;
  }
}
_Symbol$asyncDispose2 = Symbol.asyncDispose;
_util$inspect$custom = util.inspect.custom;
class APIResponse {
  constructor(context, initializer) {
    this._initializer = void 0;
    this._headers = void 0;
    this._request = void 0;
    this._request = context;
    this._initializer = initializer;
    this._headers = new _network.RawHeaders(this._initializer.headers);
  }
  ok() {
    return this._initializer.status >= 200 && this._initializer.status <= 299;
  }
  url() {
    return this._initializer.url;
  }
  status() {
    return this._initializer.status;
  }
  statusText() {
    return this._initializer.statusText;
  }
  headers() {
    return this._headers.headers();
  }
  headersArray() {
    return this._headers.headersArray();
  }
  async body() {
    try {
      const result = await this._request._channel.fetchResponseBody({
        fetchUid: this._fetchUid()
      });
      if (result.binary === undefined) throw new Error('Response has been disposed');
      return result.binary;
    } catch (e) {
      if ((0, _errors.isTargetClosedError)(e)) throw new Error('Response has been disposed');
      throw e;
    }
  }
  async text() {
    const content = await this.body();
    return content.toString('utf8');
  }
  async json() {
    const content = await this.text();
    return JSON.parse(content);
  }
  async [_Symbol$asyncDispose2]() {
    await this.dispose();
  }
  async dispose() {
    await this._request._channel.disposeAPIResponse({
      fetchUid: this._fetchUid()
    });
  }
  [_util$inspect$custom]() {
    const headers = this.headersArray().map(({
      name,
      value
    }) => `  ${name}: ${value}`);
    return `APIResponse: ${this.status()} ${this.statusText()}\n${headers.join('\n')}`;
  }
  _fetchUid() {
    return this._initializer.fetchUid;
  }
  async _fetchLog() {
    const {
      log
    } = await this._request._channel.fetchLog({
      fetchUid: this._fetchUid()
    });
    return log;
  }
}
exports.APIResponse = APIResponse;
function filePayloadToJson(payload) {
  return {
    name: payload.name,
    mimeType: payload.mimeType,
    buffer: payload.buffer
  };
}
async function readStreamToJson(stream) {
  const buffer = await new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', chunk => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', err => reject(err));
  });
  const streamPath = Buffer.isBuffer(stream.path) ? stream.path.toString('utf8') : stream.path;
  return {
    name: _path.default.basename(streamPath),
    buffer
  };
}
function isJsonContentType(headers) {
  if (!headers) return false;
  for (const {
    name,
    value
  } of headers) {
    if (name.toLocaleLowerCase() === 'content-type') return value === 'application/json';
  }
  return false;
}
function objectToArray(map) {
  if (!map) return undefined;
  const result = [];
  for (const [name, value] of Object.entries(map)) result.push({
    name,
    value: String(value)
  });
  return result;
}
function isFilePayload(value) {
  return typeof value === 'object' && value['name'] && value['mimeType'] && value['buffer'];
}