"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.WebSocket = exports.RouteHandler = exports.Route = exports.Response = exports.Request = exports.RawHeaders = void 0;
exports.validateHeaders = validateHeaders;
var _url = require("url");
var _channelOwner = require("./channelOwner");
var _frame = require("./frame");
var _worker = require("./worker");
var _fs = _interopRequireDefault(require("fs"));
var _utilsBundle = require("../utilsBundle");
var _utils = require("../utils");
var _manualPromise = require("../utils/manualPromise");
var _events = require("./events");
var _waiter = require("./waiter");
var _network = require("../utils/network");
var _multimap = require("../utils/multimap");
var _fetch = require("./fetch");
var _errors = require("./errors");
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

class Request extends _channelOwner.ChannelOwner {
  static from(request) {
    return request._object;
  }
  static fromNullable(request) {
    return request ? Request.from(request) : null;
  }
  constructor(parent, type, guid, initializer) {
    super(parent, type, guid, initializer);
    this._redirectedFrom = null;
    this._redirectedTo = null;
    this._failureText = null;
    this._provisionalHeaders = void 0;
    this._actualHeadersPromise = void 0;
    this._timing = void 0;
    this._fallbackOverrides = {};
    this._redirectedFrom = Request.fromNullable(initializer.redirectedFrom);
    if (this._redirectedFrom) this._redirectedFrom._redirectedTo = this;
    this._provisionalHeaders = new RawHeaders(initializer.headers);
    this._timing = {
      startTime: 0,
      domainLookupStart: -1,
      domainLookupEnd: -1,
      connectStart: -1,
      secureConnectionStart: -1,
      connectEnd: -1,
      requestStart: -1,
      responseStart: -1,
      responseEnd: -1
    };
  }
  url() {
    return this._fallbackOverrides.url || this._initializer.url;
  }
  resourceType() {
    return this._initializer.resourceType;
  }
  method() {
    return this._fallbackOverrides.method || this._initializer.method;
  }
  postData() {
    var _ref;
    return ((_ref = this._fallbackOverrides.postDataBuffer || this._initializer.postData) === null || _ref === void 0 ? void 0 : _ref.toString('utf-8')) || null;
  }
  postDataBuffer() {
    return this._fallbackOverrides.postDataBuffer || this._initializer.postData || null;
  }
  postDataJSON() {
    const postData = this.postData();
    if (!postData) return null;
    const contentType = this.headers()['content-type'];
    if (contentType !== null && contentType !== void 0 && contentType.includes('application/x-www-form-urlencoded')) {
      const entries = {};
      const parsed = new _url.URLSearchParams(postData);
      for (const [k, v] of parsed.entries()) entries[k] = v;
      return entries;
    }
    try {
      return JSON.parse(postData);
    } catch (e) {
      throw new Error('POST data is not a valid JSON object: ' + postData);
    }
  }

  /**
   * @deprecated
   */
  headers() {
    if (this._fallbackOverrides.headers) return RawHeaders._fromHeadersObjectLossy(this._fallbackOverrides.headers).headers();
    return this._provisionalHeaders.headers();
  }
  async _actualHeaders() {
    if (this._fallbackOverrides.headers) return RawHeaders._fromHeadersObjectLossy(this._fallbackOverrides.headers);
    if (!this._actualHeadersPromise) {
      this._actualHeadersPromise = this._wrapApiCall(async () => {
        return new RawHeaders((await this._channel.rawRequestHeaders()).headers);
      });
    }
    return await this._actualHeadersPromise;
  }
  async allHeaders() {
    return (await this._actualHeaders()).headers();
  }
  async headersArray() {
    return (await this._actualHeaders()).headersArray();
  }
  async headerValue(name) {
    return (await this._actualHeaders()).get(name);
  }
  async response() {
    return Response.fromNullable((await this._channel.response()).response);
  }
  async _internalResponse() {
    return await this._wrapApiCall(async () => {
      return Response.fromNullable((await this._channel.response()).response);
    }, true);
  }
  frame() {
    if (!this._initializer.frame) {
      (0, _utils.assert)(this.serviceWorker());
      throw new Error('Service Worker requests do not have an associated frame.');
    }
    const frame = _frame.Frame.from(this._initializer.frame);
    if (!frame._page) {
      throw new Error(['Frame for this navigation request is not available, because the request', 'was issued before the frame is created. You can check whether the request', 'is a navigation request by calling isNavigationRequest() method.'].join('\n'));
    }
    return frame;
  }
  _safePage() {
    var _Frame$fromNullable;
    return ((_Frame$fromNullable = _frame.Frame.fromNullable(this._initializer.frame)) === null || _Frame$fromNullable === void 0 ? void 0 : _Frame$fromNullable._page) || null;
  }
  serviceWorker() {
    return this._initializer.serviceWorker ? _worker.Worker.from(this._initializer.serviceWorker) : null;
  }
  isNavigationRequest() {
    return this._initializer.isNavigationRequest;
  }
  redirectedFrom() {
    return this._redirectedFrom;
  }
  redirectedTo() {
    return this._redirectedTo;
  }
  failure() {
    if (this._failureText === null) return null;
    return {
      errorText: this._failureText
    };
  }
  timing() {
    return this._timing;
  }
  async sizes() {
    const response = await this.response();
    if (!response) throw new Error('Unable to fetch sizes for failed request');
    return (await response._channel.sizes()).sizes;
  }
  _setResponseEndTiming(responseEndTiming) {
    this._timing.responseEnd = responseEndTiming;
    if (this._timing.responseStart === -1) this._timing.responseStart = responseEndTiming;
  }
  _finalRequest() {
    return this._redirectedTo ? this._redirectedTo._finalRequest() : this;
  }
  _applyFallbackOverrides(overrides) {
    if (overrides.url) this._fallbackOverrides.url = overrides.url;
    if (overrides.method) this._fallbackOverrides.method = overrides.method;
    if (overrides.headers) this._fallbackOverrides.headers = overrides.headers;
    if ((0, _utils.isString)(overrides.postData)) this._fallbackOverrides.postDataBuffer = Buffer.from(overrides.postData, 'utf-8');else if (overrides.postData instanceof Buffer) this._fallbackOverrides.postDataBuffer = overrides.postData;else if (overrides.postData) this._fallbackOverrides.postDataBuffer = Buffer.from(JSON.stringify(overrides.postData), 'utf-8');
  }
  _fallbackOverridesForContinue() {
    return this._fallbackOverrides;
  }
  _targetClosedScope() {
    var _this$serviceWorker, _this$_safePage;
    return ((_this$serviceWorker = this.serviceWorker()) === null || _this$serviceWorker === void 0 ? void 0 : _this$serviceWorker._closedScope) || ((_this$_safePage = this._safePage()) === null || _this$_safePage === void 0 ? void 0 : _this$_safePage._closedOrCrashedScope) || new _manualPromise.LongStandingScope();
  }
}
exports.Request = Request;
class Route extends _channelOwner.ChannelOwner {
  static from(route) {
    return route._object;
  }
  constructor(parent, type, guid, initializer) {
    super(parent, type, guid, initializer);
    this._handlingPromise = null;
    this._context = void 0;
    this._didThrow = false;
  }
  request() {
    return Request.from(this._initializer.request);
  }
  async _raceWithTargetClose(promise) {
    // When page closes or crashes, we catch any potential rejects from this Route.
    // Note that page could be missing when routing popup's initial request that
    // does not have a Page initialized just yet.
    return await this.request()._targetClosedScope().safeRace(promise);
  }
  async _startHandling() {
    this._handlingPromise = new _manualPromise.ManualPromise();
    return await this._handlingPromise;
  }
  async fallback(options = {}) {
    this._checkNotHandled();
    this.request()._applyFallbackOverrides(options);
    this._reportHandled(false);
  }
  async abort(errorCode) {
    await this._handleRoute(async () => {
      await this._raceWithTargetClose(this._channel.abort({
        requestUrl: this.request()._initializer.url,
        errorCode
      }));
    });
  }
  async _redirectNavigationRequest(url) {
    await this._handleRoute(async () => {
      await this._raceWithTargetClose(this._channel.redirectNavigationRequest({
        url
      }));
    });
  }
  async fetch(options = {}) {
    return await this._wrapApiCall(async () => {
      return await this._context.request._innerFetch({
        request: this.request(),
        data: options.postData,
        ...options
      });
    });
  }
  async fulfill(options = {}) {
    await this._handleRoute(async () => {
      await this._wrapApiCall(async () => {
        await this._innerFulfill(options);
      });
    });
  }
  async _handleRoute(callback) {
    this._checkNotHandled();
    try {
      await callback();
      this._reportHandled(true);
    } catch (e) {
      this._didThrow = true;
      throw e;
    }
  }
  async _innerFulfill(options = {}) {
    let fetchResponseUid;
    let {
      status: statusOption,
      headers: headersOption,
      body
    } = options;
    if (options.json !== undefined) {
      (0, _utils.assert)(options.body === undefined, 'Can specify either body or json parameters');
      body = JSON.stringify(options.json);
    }
    if (options.response instanceof _fetch.APIResponse) {
      var _statusOption, _headersOption;
      (_statusOption = statusOption) !== null && _statusOption !== void 0 ? _statusOption : statusOption = options.response.status();
      (_headersOption = headersOption) !== null && _headersOption !== void 0 ? _headersOption : headersOption = options.response.headers();
      if (body === undefined && options.path === undefined) {
        if (options.response._request._connection === this._connection) fetchResponseUid = options.response._fetchUid();else body = await options.response.body();
      }
    }
    let isBase64 = false;
    let length = 0;
    if (options.path) {
      const buffer = await _fs.default.promises.readFile(options.path);
      body = buffer.toString('base64');
      isBase64 = true;
      length = buffer.length;
    } else if ((0, _utils.isString)(body)) {
      isBase64 = false;
      length = Buffer.byteLength(body);
    } else if (body) {
      length = body.length;
      body = body.toString('base64');
      isBase64 = true;
    }
    const headers = {};
    for (const header of Object.keys(headersOption || {})) headers[header.toLowerCase()] = String(headersOption[header]);
    if (options.contentType) headers['content-type'] = String(options.contentType);else if (options.json) headers['content-type'] = 'application/json';else if (options.path) headers['content-type'] = _utilsBundle.mime.getType(options.path) || 'application/octet-stream';
    if (length && !('content-length' in headers)) headers['content-length'] = String(length);
    await this._raceWithTargetClose(this._channel.fulfill({
      requestUrl: this.request()._initializer.url,
      status: statusOption || 200,
      headers: (0, _utils.headersObjectToArray)(headers),
      body,
      isBase64,
      fetchResponseUid
    }));
  }
  async continue(options = {}) {
    await this._handleRoute(async () => {
      this.request()._applyFallbackOverrides(options);
      await this._innerContinue();
    });
  }
  _checkNotHandled() {
    if (!this._handlingPromise) throw new Error('Route is already handled!');
  }
  _reportHandled(done) {
    const chain = this._handlingPromise;
    this._handlingPromise = null;
    chain.resolve(done);
  }
  async _innerContinue(internal = false) {
    const options = this.request()._fallbackOverridesForContinue();
    return await this._wrapApiCall(async () => {
      await this._raceWithTargetClose(this._channel.continue({
        requestUrl: this.request()._initializer.url,
        url: options.url,
        method: options.method,
        headers: options.headers ? (0, _utils.headersObjectToArray)(options.headers) : undefined,
        postData: options.postDataBuffer,
        isFallback: internal
      }));
    }, !!internal);
  }
}
exports.Route = Route;
class Response extends _channelOwner.ChannelOwner {
  static from(response) {
    return response._object;
  }
  static fromNullable(response) {
    return response ? Response.from(response) : null;
  }
  constructor(parent, type, guid, initializer) {
    super(parent, type, guid, initializer);
    this._provisionalHeaders = void 0;
    this._actualHeadersPromise = void 0;
    this._request = void 0;
    this._finishedPromise = new _manualPromise.ManualPromise();
    this._provisionalHeaders = new RawHeaders(initializer.headers);
    this._request = Request.from(this._initializer.request);
    Object.assign(this._request._timing, this._initializer.timing);
  }
  url() {
    return this._initializer.url;
  }
  ok() {
    // Status 0 is for file:// URLs
    return this._initializer.status === 0 || this._initializer.status >= 200 && this._initializer.status <= 299;
  }
  status() {
    return this._initializer.status;
  }
  statusText() {
    return this._initializer.statusText;
  }
  fromServiceWorker() {
    return this._initializer.fromServiceWorker;
  }

  /**
   * @deprecated
   */
  headers() {
    return this._provisionalHeaders.headers();
  }
  async _actualHeaders() {
    if (!this._actualHeadersPromise) {
      this._actualHeadersPromise = (async () => {
        return new RawHeaders((await this._channel.rawResponseHeaders()).headers);
      })();
    }
    return await this._actualHeadersPromise;
  }
  async allHeaders() {
    return (await this._actualHeaders()).headers();
  }
  async headersArray() {
    return (await this._actualHeaders()).headersArray().slice();
  }
  async headerValue(name) {
    return (await this._actualHeaders()).get(name);
  }
  async headerValues(name) {
    return (await this._actualHeaders()).getAll(name);
  }
  async finished() {
    return await this.request()._targetClosedScope().race(this._finishedPromise);
  }
  async body() {
    return (await this._channel.body()).binary;
  }
  async text() {
    const content = await this.body();
    return content.toString('utf8');
  }
  async json() {
    const content = await this.text();
    return JSON.parse(content);
  }
  request() {
    return this._request;
  }
  frame() {
    return this._request.frame();
  }
  async serverAddr() {
    return (await this._channel.serverAddr()).value || null;
  }
  async securityDetails() {
    return (await this._channel.securityDetails()).value || null;
  }
}
exports.Response = Response;
class WebSocket extends _channelOwner.ChannelOwner {
  static from(webSocket) {
    return webSocket._object;
  }
  constructor(parent, type, guid, initializer) {
    super(parent, type, guid, initializer);
    this._page = void 0;
    this._isClosed = void 0;
    this._isClosed = false;
    this._page = parent;
    this._channel.on('frameSent', event => {
      if (event.opcode === 1) this.emit(_events.Events.WebSocket.FrameSent, {
        payload: event.data
      });else if (event.opcode === 2) this.emit(_events.Events.WebSocket.FrameSent, {
        payload: Buffer.from(event.data, 'base64')
      });
    });
    this._channel.on('frameReceived', event => {
      if (event.opcode === 1) this.emit(_events.Events.WebSocket.FrameReceived, {
        payload: event.data
      });else if (event.opcode === 2) this.emit(_events.Events.WebSocket.FrameReceived, {
        payload: Buffer.from(event.data, 'base64')
      });
    });
    this._channel.on('socketError', ({
      error
    }) => this.emit(_events.Events.WebSocket.Error, error));
    this._channel.on('close', () => {
      this._isClosed = true;
      this.emit(_events.Events.WebSocket.Close, this);
    });
  }
  url() {
    return this._initializer.url;
  }
  isClosed() {
    return this._isClosed;
  }
  async waitForEvent(event, optionsOrPredicate = {}) {
    return await this._wrapApiCall(async () => {
      const timeout = this._page._timeoutSettings.timeout(typeof optionsOrPredicate === 'function' ? {} : optionsOrPredicate);
      const predicate = typeof optionsOrPredicate === 'function' ? optionsOrPredicate : optionsOrPredicate.predicate;
      const waiter = _waiter.Waiter.createForEvent(this, event);
      waiter.rejectOnTimeout(timeout, `Timeout ${timeout}ms exceeded while waiting for event "${event}"`);
      if (event !== _events.Events.WebSocket.Error) waiter.rejectOnEvent(this, _events.Events.WebSocket.Error, new Error('Socket error'));
      if (event !== _events.Events.WebSocket.Close) waiter.rejectOnEvent(this, _events.Events.WebSocket.Close, new Error('Socket closed'));
      waiter.rejectOnEvent(this._page, _events.Events.Page.Close, () => this._page._closeErrorWithReason());
      const result = await waiter.waitForEvent(this, event, predicate);
      waiter.dispose();
      return result;
    });
  }
}
exports.WebSocket = WebSocket;
function validateHeaders(headers) {
  for (const key of Object.keys(headers)) {
    const value = headers[key];
    if (!Object.is(value, undefined) && !(0, _utils.isString)(value)) throw new Error(`Expected value of header "${key}" to be String, but "${typeof value}" is found.`);
  }
}
class RouteHandler {
  constructor(baseURL, url, handler, times = Number.MAX_SAFE_INTEGER) {
    this.handledCount = 0;
    this._baseURL = void 0;
    this._times = void 0;
    this.url = void 0;
    this.handler = void 0;
    this._ignoreException = false;
    this._activeInvocations = new Set();
    this._baseURL = baseURL;
    this._times = times;
    this.url = url;
    this.handler = handler;
  }
  static prepareInterceptionPatterns(handlers) {
    const patterns = [];
    let all = false;
    for (const handler of handlers) {
      if ((0, _utils.isString)(handler.url)) patterns.push({
        glob: handler.url
      });else if ((0, _utils.isRegExp)(handler.url)) patterns.push({
        regexSource: handler.url.source,
        regexFlags: handler.url.flags
      });else all = true;
    }
    if (all) return [{
      glob: '**/*'
    }];
    return patterns;
  }
  matches(requestURL) {
    return (0, _network.urlMatches)(this._baseURL, requestURL, this.url);
  }
  async handle(route) {
    const handlerInvocation = {
      complete: new _manualPromise.ManualPromise(),
      route
    };
    this._activeInvocations.add(handlerInvocation);
    try {
      return await this._handleInternal(route);
    } catch (e) {
      // If the handler was stopped (without waiting for completion), we ignore all exceptions.
      if (this._ignoreException) return false;
      if ((0, _errors.isTargetClosedError)(e)) {
        // We are failing in the handler because the target close closed.
        // Give user a hint!
        (0, _utils.rewriteErrorMessage)(e, `"${e.message}" while running route callback.\nConsider awaiting \`await page.unrouteAll({ behavior: 'ignoreErrors' })\`\nbefore the end of the test to ignore remaining routes in flight.`);
      }
      throw e;
    } finally {
      handlerInvocation.complete.resolve();
      this._activeInvocations.delete(handlerInvocation);
    }
  }
  async stop(behavior) {
    // When a handler is manually unrouted or its page/context is closed we either
    // - wait for the current handler invocations to finish
    // - or do not wait, if the user opted out of it, but swallow all exceptions
    //   that happen after the unroute/close.
    if (behavior === 'ignoreErrors') {
      this._ignoreException = true;
    } else {
      const promises = [];
      for (const activation of this._activeInvocations) {
        if (!activation.route._didThrow) promises.push(activation.complete);
      }
      await Promise.all(promises);
    }
  }
  async _handleInternal(route) {
    ++this.handledCount;
    const handledPromise = route._startHandling();
    // Extract handler into a variable to avoid [RouteHandler.handler] in the stack.
    const handler = this.handler;
    const [handled] = await Promise.all([handledPromise, handler(route, route.request())]);
    return handled;
  }
  willExpire() {
    return this.handledCount + 1 >= this._times;
  }
}
exports.RouteHandler = RouteHandler;
class RawHeaders {
  static _fromHeadersObjectLossy(headers) {
    const headersArray = Object.entries(headers).map(([name, value]) => ({
      name,
      value
    })).filter(header => header.value !== undefined);
    return new RawHeaders(headersArray);
  }
  constructor(headers) {
    this._headersArray = void 0;
    this._headersMap = new _multimap.MultiMap();
    this._headersArray = headers;
    for (const header of headers) this._headersMap.set(header.name.toLowerCase(), header.value);
  }
  get(name) {
    const values = this.getAll(name);
    if (!values || !values.length) return null;
    return values.join(name.toLowerCase() === 'set-cookie' ? '\n' : ', ');
  }
  getAll(name) {
    return [...this._headersMap.get(name.toLowerCase())];
  }
  headers() {
    const result = {};
    for (const name of this._headersMap.keys()) result[name] = this.get(name);
    return result;
  }
  headersArray() {
    return this._headersArray;
  }
}
exports.RawHeaders = RawHeaders;