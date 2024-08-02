"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Page = exports.BindingCall = void 0;
var _fs = _interopRequireDefault(require("fs"));
var _path = _interopRequireDefault(require("path"));
var _errors = require("./errors");
var _network = require("../utils/network");
var _timeoutSettings = require("../common/timeoutSettings");
var _utils = require("../utils");
var _fileUtils = require("../utils/fileUtils");
var _accessibility = require("./accessibility");
var _artifact = require("./artifact");
var _channelOwner = require("./channelOwner");
var _clientHelper = require("./clientHelper");
var _coverage = require("./coverage");
var _download = require("./download");
var _elementHandle = require("./elementHandle");
var _events = require("./events");
var _fileChooser = require("./fileChooser");
var _frame = require("./frame");
var _input = require("./input");
var _jsHandle = require("./jsHandle");
var _stringUtils = require("../utils/isomorphic/stringUtils");
var _network2 = require("./network");
var _video = require("./video");
var _waiter = require("./waiter");
var _worker = require("./worker");
var _harRouter = require("./harRouter");
let _Symbol$asyncDispose;
/**
 * Copyright 2017 Google Inc. All rights reserved.
 * Modifications copyright (c) Microsoft Corporation.
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
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
_Symbol$asyncDispose = Symbol.asyncDispose;
class Page extends _channelOwner.ChannelOwner {
  static from(page) {
    return page._object;
  }
  static fromNullable(page) {
    return page ? Page.from(page) : null;
  }
  constructor(parent, type, guid, initializer) {
    super(parent, type, guid, initializer);
    this._browserContext = void 0;
    this._ownedContext = void 0;
    this._mainFrame = void 0;
    this._frames = new Set();
    this._workers = new Set();
    this._closed = false;
    this._closedOrCrashedScope = new _utils.LongStandingScope();
    this._viewportSize = void 0;
    this._routes = [];
    this.accessibility = void 0;
    this.coverage = void 0;
    this.keyboard = void 0;
    this.mouse = void 0;
    this.request = void 0;
    this.touchscreen = void 0;
    this.clock = void 0;
    this._bindings = new Map();
    this._timeoutSettings = void 0;
    this._video = null;
    this._opener = void 0;
    this._closeReason = void 0;
    this._closeWasCalled = false;
    this._harRouters = [];
    this._locatorHandlers = new Map();
    this._browserContext = parent;
    this._timeoutSettings = new _timeoutSettings.TimeoutSettings(this._browserContext._timeoutSettings);
    this.accessibility = new _accessibility.Accessibility(this._channel);
    this.keyboard = new _input.Keyboard(this);
    this.mouse = new _input.Mouse(this);
    this.request = this._browserContext.request;
    this.touchscreen = new _input.Touchscreen(this);
    this.clock = this._browserContext.clock;
    this._mainFrame = _frame.Frame.from(initializer.mainFrame);
    this._mainFrame._page = this;
    this._frames.add(this._mainFrame);
    this._viewportSize = initializer.viewportSize || null;
    this._closed = initializer.isClosed;
    this._opener = Page.fromNullable(initializer.opener);
    this._channel.on('bindingCall', ({
      binding
    }) => this._onBinding(BindingCall.from(binding)));
    this._channel.on('close', () => this._onClose());
    this._channel.on('crash', () => this._onCrash());
    this._channel.on('download', ({
      url,
      suggestedFilename,
      artifact
    }) => {
      const artifactObject = _artifact.Artifact.from(artifact);
      this.emit(_events.Events.Page.Download, new _download.Download(this, url, suggestedFilename, artifactObject));
    });
    this._channel.on('fileChooser', ({
      element,
      isMultiple
    }) => this.emit(_events.Events.Page.FileChooser, new _fileChooser.FileChooser(this, _elementHandle.ElementHandle.from(element), isMultiple)));
    this._channel.on('frameAttached', ({
      frame
    }) => this._onFrameAttached(_frame.Frame.from(frame)));
    this._channel.on('frameDetached', ({
      frame
    }) => this._onFrameDetached(_frame.Frame.from(frame)));
    this._channel.on('locatorHandlerTriggered', ({
      uid
    }) => this._onLocatorHandlerTriggered(uid));
    this._channel.on('route', ({
      route
    }) => this._onRoute(_network2.Route.from(route)));
    this._channel.on('video', ({
      artifact
    }) => {
      const artifactObject = _artifact.Artifact.from(artifact);
      this._forceVideo()._artifactReady(artifactObject);
    });
    this._channel.on('webSocket', ({
      webSocket
    }) => this.emit(_events.Events.Page.WebSocket, _network2.WebSocket.from(webSocket)));
    this._channel.on('worker', ({
      worker
    }) => this._onWorker(_worker.Worker.from(worker)));
    this.coverage = new _coverage.Coverage(this._channel);
    this.once(_events.Events.Page.Close, () => this._closedOrCrashedScope.close(this._closeErrorWithReason()));
    this.once(_events.Events.Page.Crash, () => this._closedOrCrashedScope.close(new _errors.TargetClosedError()));
    this._setEventToSubscriptionMapping(new Map([[_events.Events.Page.Console, 'console'], [_events.Events.Page.Dialog, 'dialog'], [_events.Events.Page.Request, 'request'], [_events.Events.Page.Response, 'response'], [_events.Events.Page.RequestFinished, 'requestFinished'], [_events.Events.Page.RequestFailed, 'requestFailed'], [_events.Events.Page.FileChooser, 'fileChooser']]));
  }
  _onFrameAttached(frame) {
    frame._page = this;
    this._frames.add(frame);
    if (frame._parentFrame) frame._parentFrame._childFrames.add(frame);
    this.emit(_events.Events.Page.FrameAttached, frame);
  }
  _onFrameDetached(frame) {
    this._frames.delete(frame);
    frame._detached = true;
    if (frame._parentFrame) frame._parentFrame._childFrames.delete(frame);
    this.emit(_events.Events.Page.FrameDetached, frame);
  }
  async _onRoute(route) {
    route._context = this.context();
    const routeHandlers = this._routes.slice();
    for (const routeHandler of routeHandlers) {
      // If the page was closed we stall all requests right away.
      if (this._closeWasCalled || this._browserContext._closeWasCalled) return;
      if (!routeHandler.matches(route.request().url())) continue;
      const index = this._routes.indexOf(routeHandler);
      if (index === -1) continue;
      if (routeHandler.willExpire()) this._routes.splice(index, 1);
      const handled = await routeHandler.handle(route);
      if (!this._routes.length) this._wrapApiCall(() => this._updateInterceptionPatterns(), true).catch(() => {});
      if (handled) return;
    }
    await this._browserContext._onRoute(route);
  }
  async _onBinding(bindingCall) {
    const func = this._bindings.get(bindingCall._initializer.name);
    if (func) {
      await bindingCall.call(func);
      return;
    }
    await this._browserContext._onBinding(bindingCall);
  }
  _onWorker(worker) {
    this._workers.add(worker);
    worker._page = this;
    this.emit(_events.Events.Page.Worker, worker);
  }
  _onClose() {
    this._closed = true;
    this._browserContext._pages.delete(this);
    this._browserContext._backgroundPages.delete(this);
    this._disposeHarRouters();
    this.emit(_events.Events.Page.Close, this);
  }
  _onCrash() {
    this.emit(_events.Events.Page.Crash, this);
  }
  context() {
    return this._browserContext;
  }
  async opener() {
    if (!this._opener || this._opener.isClosed()) return null;
    return this._opener;
  }
  mainFrame() {
    return this._mainFrame;
  }
  frame(frameSelector) {
    const name = (0, _utils.isString)(frameSelector) ? frameSelector : frameSelector.name;
    const url = (0, _utils.isObject)(frameSelector) ? frameSelector.url : undefined;
    (0, _utils.assert)(name || url, 'Either name or url matcher should be specified');
    return this.frames().find(f => {
      if (name) return f.name() === name;
      return (0, _network.urlMatches)(this._browserContext._options.baseURL, f.url(), url);
    }) || null;
  }
  frames() {
    return [...this._frames];
  }
  setDefaultNavigationTimeout(timeout) {
    this._timeoutSettings.setDefaultNavigationTimeout(timeout);
    this._wrapApiCall(async () => {
      this._channel.setDefaultNavigationTimeoutNoReply({
        timeout
      }).catch(() => {});
    }, true);
  }
  setDefaultTimeout(timeout) {
    this._timeoutSettings.setDefaultTimeout(timeout);
    this._wrapApiCall(async () => {
      this._channel.setDefaultTimeoutNoReply({
        timeout
      }).catch(() => {});
    }, true);
  }
  _forceVideo() {
    if (!this._video) this._video = new _video.Video(this, this._connection);
    return this._video;
  }
  video() {
    // Note: we are creating Video object lazily, because we do not know
    // BrowserContextOptions when constructing the page - it is assigned
    // too late during launchPersistentContext.
    if (!this._browserContext._options.recordVideo) return null;
    return this._forceVideo();
  }
  async $(selector, options) {
    return await this._mainFrame.$(selector, options);
  }
  async waitForSelector(selector, options) {
    return await this._mainFrame.waitForSelector(selector, options);
  }
  async dispatchEvent(selector, type, eventInit, options) {
    return await this._mainFrame.dispatchEvent(selector, type, eventInit, options);
  }
  async evaluateHandle(pageFunction, arg) {
    (0, _jsHandle.assertMaxArguments)(arguments.length, 2);
    return await this._mainFrame.evaluateHandle(pageFunction, arg);
  }
  async $eval(selector, pageFunction, arg) {
    (0, _jsHandle.assertMaxArguments)(arguments.length, 3);
    return await this._mainFrame.$eval(selector, pageFunction, arg);
  }
  async $$eval(selector, pageFunction, arg) {
    (0, _jsHandle.assertMaxArguments)(arguments.length, 3);
    return await this._mainFrame.$$eval(selector, pageFunction, arg);
  }
  async $$(selector) {
    return await this._mainFrame.$$(selector);
  }
  async addScriptTag(options = {}) {
    return await this._mainFrame.addScriptTag(options);
  }
  async addStyleTag(options = {}) {
    return await this._mainFrame.addStyleTag(options);
  }
  async exposeFunction(name, callback) {
    await this._channel.exposeBinding({
      name
    });
    const binding = (source, ...args) => callback(...args);
    this._bindings.set(name, binding);
  }
  async exposeBinding(name, callback, options = {}) {
    await this._channel.exposeBinding({
      name,
      needsHandle: options.handle
    });
    this._bindings.set(name, callback);
  }
  async setExtraHTTPHeaders(headers) {
    (0, _network2.validateHeaders)(headers);
    await this._channel.setExtraHTTPHeaders({
      headers: (0, _utils.headersObjectToArray)(headers)
    });
  }
  url() {
    return this._mainFrame.url();
  }
  async content() {
    return await this._mainFrame.content();
  }
  async setContent(html, options) {
    return await this._mainFrame.setContent(html, options);
  }
  async goto(url, options) {
    return await this._mainFrame.goto(url, options);
  }
  async reload(options = {}) {
    const waitUntil = (0, _frame.verifyLoadState)('waitUntil', options.waitUntil === undefined ? 'load' : options.waitUntil);
    return _network2.Response.fromNullable((await this._channel.reload({
      ...options,
      waitUntil
    })).response);
  }
  async addLocatorHandler(locator, handler, options = {}) {
    if (locator._frame !== this._mainFrame) throw new Error(`Locator must belong to the main frame of this page`);
    if (options.times === 0) return;
    const {
      uid
    } = await this._channel.registerLocatorHandler({
      selector: locator._selector,
      noWaitAfter: options.noWaitAfter
    });
    this._locatorHandlers.set(uid, {
      locator,
      handler,
      times: options.times
    });
  }
  async _onLocatorHandlerTriggered(uid) {
    let remove = false;
    try {
      const handler = this._locatorHandlers.get(uid);
      if (handler && handler.times !== 0) {
        if (handler.times !== undefined) handler.times--;
        await handler.handler(handler.locator);
      }
      remove = (handler === null || handler === void 0 ? void 0 : handler.times) === 0;
    } finally {
      if (remove) this._locatorHandlers.delete(uid);
      this._wrapApiCall(() => this._channel.resolveLocatorHandlerNoReply({
        uid,
        remove
      }), true).catch(() => {});
    }
  }
  async removeLocatorHandler(locator) {
    for (const [uid, data] of this._locatorHandlers) {
      if (data.locator._equals(locator)) {
        this._locatorHandlers.delete(uid);
        await this._channel.unregisterLocatorHandler({
          uid
        }).catch(() => {});
      }
    }
  }
  async waitForLoadState(state, options) {
    return await this._mainFrame.waitForLoadState(state, options);
  }
  async waitForNavigation(options) {
    return await this._mainFrame.waitForNavigation(options);
  }
  async waitForURL(url, options) {
    return await this._mainFrame.waitForURL(url, options);
  }
  async waitForRequest(urlOrPredicate, options = {}) {
    const predicate = async request => {
      if ((0, _utils.isString)(urlOrPredicate) || (0, _utils.isRegExp)(urlOrPredicate)) return (0, _network.urlMatches)(this._browserContext._options.baseURL, request.url(), urlOrPredicate);
      return await urlOrPredicate(request);
    };
    const trimmedUrl = trimUrl(urlOrPredicate);
    const logLine = trimmedUrl ? `waiting for request ${trimmedUrl}` : undefined;
    return await this._waitForEvent(_events.Events.Page.Request, {
      predicate,
      timeout: options.timeout
    }, logLine);
  }
  async waitForResponse(urlOrPredicate, options = {}) {
    const predicate = async response => {
      if ((0, _utils.isString)(urlOrPredicate) || (0, _utils.isRegExp)(urlOrPredicate)) return (0, _network.urlMatches)(this._browserContext._options.baseURL, response.url(), urlOrPredicate);
      return await urlOrPredicate(response);
    };
    const trimmedUrl = trimUrl(urlOrPredicate);
    const logLine = trimmedUrl ? `waiting for response ${trimmedUrl}` : undefined;
    return await this._waitForEvent(_events.Events.Page.Response, {
      predicate,
      timeout: options.timeout
    }, logLine);
  }
  async waitForEvent(event, optionsOrPredicate = {}) {
    return await this._waitForEvent(event, optionsOrPredicate, `waiting for event "${event}"`);
  }
  _closeErrorWithReason() {
    return new _errors.TargetClosedError(this._closeReason || this._browserContext._effectiveCloseReason());
  }
  async _waitForEvent(event, optionsOrPredicate, logLine) {
    return await this._wrapApiCall(async () => {
      const timeout = this._timeoutSettings.timeout(typeof optionsOrPredicate === 'function' ? {} : optionsOrPredicate);
      const predicate = typeof optionsOrPredicate === 'function' ? optionsOrPredicate : optionsOrPredicate.predicate;
      const waiter = _waiter.Waiter.createForEvent(this, event);
      if (logLine) waiter.log(logLine);
      waiter.rejectOnTimeout(timeout, `Timeout ${timeout}ms exceeded while waiting for event "${event}"`);
      if (event !== _events.Events.Page.Crash) waiter.rejectOnEvent(this, _events.Events.Page.Crash, new Error('Page crashed'));
      if (event !== _events.Events.Page.Close) waiter.rejectOnEvent(this, _events.Events.Page.Close, () => this._closeErrorWithReason());
      const result = await waiter.waitForEvent(this, event, predicate);
      waiter.dispose();
      return result;
    });
  }
  async goBack(options = {}) {
    const waitUntil = (0, _frame.verifyLoadState)('waitUntil', options.waitUntil === undefined ? 'load' : options.waitUntil);
    return _network2.Response.fromNullable((await this._channel.goBack({
      ...options,
      waitUntil
    })).response);
  }
  async goForward(options = {}) {
    const waitUntil = (0, _frame.verifyLoadState)('waitUntil', options.waitUntil === undefined ? 'load' : options.waitUntil);
    return _network2.Response.fromNullable((await this._channel.goForward({
      ...options,
      waitUntil
    })).response);
  }
  async emulateMedia(options = {}) {
    await this._channel.emulateMedia({
      media: options.media === null ? 'no-override' : options.media,
      colorScheme: options.colorScheme === null ? 'no-override' : options.colorScheme,
      reducedMotion: options.reducedMotion === null ? 'no-override' : options.reducedMotion,
      forcedColors: options.forcedColors === null ? 'no-override' : options.forcedColors
    });
  }
  async setViewportSize(viewportSize) {
    this._viewportSize = viewportSize;
    await this._channel.setViewportSize({
      viewportSize
    });
  }
  viewportSize() {
    return this._viewportSize;
  }
  async evaluate(pageFunction, arg) {
    (0, _jsHandle.assertMaxArguments)(arguments.length, 2);
    return await this._mainFrame.evaluate(pageFunction, arg);
  }
  async addInitScript(script, arg) {
    const source = await (0, _clientHelper.evaluationScript)(script, arg);
    await this._channel.addInitScript({
      source
    });
  }
  async route(url, handler, options = {}) {
    this._routes.unshift(new _network2.RouteHandler(this._browserContext._options.baseURL, url, handler, options.times));
    await this._updateInterceptionPatterns();
  }
  async routeFromHAR(har, options = {}) {
    if (options.update) {
      await this._browserContext._recordIntoHAR(har, this, options);
      return;
    }
    const harRouter = await _harRouter.HarRouter.create(this._connection.localUtils(), har, options.notFound || 'abort', {
      urlMatch: options.url
    });
    this._harRouters.push(harRouter);
    await harRouter.addPageRoute(this);
  }
  _disposeHarRouters() {
    this._harRouters.forEach(router => router.dispose());
    this._harRouters = [];
  }
  async unrouteAll(options) {
    await this._unrouteInternal(this._routes, [], options === null || options === void 0 ? void 0 : options.behavior);
    this._disposeHarRouters();
  }
  async unroute(url, handler) {
    const removed = [];
    const remaining = [];
    for (const route of this._routes) {
      if ((0, _utils.urlMatchesEqual)(route.url, url) && (!handler || route.handler === handler)) removed.push(route);else remaining.push(route);
    }
    await this._unrouteInternal(removed, remaining, 'default');
  }
  async _unrouteInternal(removed, remaining, behavior) {
    this._routes = remaining;
    await this._updateInterceptionPatterns();
    if (!behavior || behavior === 'default') return;
    const promises = removed.map(routeHandler => routeHandler.stop(behavior));
    await Promise.all(promises);
  }
  async _updateInterceptionPatterns() {
    const patterns = _network2.RouteHandler.prepareInterceptionPatterns(this._routes);
    await this._channel.setNetworkInterceptionPatterns({
      patterns
    });
  }
  async screenshot(options = {}) {
    const copy = {
      ...options,
      mask: undefined
    };
    if (!copy.type) copy.type = (0, _elementHandle.determineScreenshotType)(options);
    if (options.mask) {
      copy.mask = options.mask.map(locator => ({
        frame: locator._frame._channel,
        selector: locator._selector
      }));
    }
    const result = await this._channel.screenshot(copy);
    if (options.path) {
      await (0, _fileUtils.mkdirIfNeeded)(options.path);
      await _fs.default.promises.writeFile(options.path, result.binary);
    }
    return result.binary;
  }
  async _expectScreenshot(options) {
    const mask = options !== null && options !== void 0 && options.mask ? options === null || options === void 0 ? void 0 : options.mask.map(locator => ({
      frame: locator._frame._channel,
      selector: locator._selector
    })) : undefined;
    const locator = options.locator ? {
      frame: options.locator._frame._channel,
      selector: options.locator._selector
    } : undefined;
    return await this._channel.expectScreenshot({
      ...options,
      isNot: !!options.isNot,
      locator,
      mask
    });
  }
  async title() {
    return await this._mainFrame.title();
  }
  async bringToFront() {
    await this._channel.bringToFront();
  }
  async [_Symbol$asyncDispose]() {
    await this.close();
  }
  async close(options = {}) {
    this._closeReason = options.reason;
    this._closeWasCalled = true;
    try {
      if (this._ownedContext) await this._ownedContext.close();else await this._channel.close(options);
    } catch (e) {
      if ((0, _errors.isTargetClosedError)(e) && !options.runBeforeUnload) return;
      throw e;
    }
  }
  isClosed() {
    return this._closed;
  }
  async click(selector, options) {
    return await this._mainFrame.click(selector, options);
  }
  async dragAndDrop(source, target, options) {
    return await this._mainFrame.dragAndDrop(source, target, options);
  }
  async dblclick(selector, options) {
    return await this._mainFrame.dblclick(selector, options);
  }
  async tap(selector, options) {
    return await this._mainFrame.tap(selector, options);
  }
  async fill(selector, value, options) {
    return await this._mainFrame.fill(selector, value, options);
  }
  locator(selector, options) {
    return this.mainFrame().locator(selector, options);
  }
  getByTestId(testId) {
    return this.mainFrame().getByTestId(testId);
  }
  getByAltText(text, options) {
    return this.mainFrame().getByAltText(text, options);
  }
  getByLabel(text, options) {
    return this.mainFrame().getByLabel(text, options);
  }
  getByPlaceholder(text, options) {
    return this.mainFrame().getByPlaceholder(text, options);
  }
  getByText(text, options) {
    return this.mainFrame().getByText(text, options);
  }
  getByTitle(text, options) {
    return this.mainFrame().getByTitle(text, options);
  }
  getByRole(role, options = {}) {
    return this.mainFrame().getByRole(role, options);
  }
  frameLocator(selector) {
    return this.mainFrame().frameLocator(selector);
  }
  async focus(selector, options) {
    return await this._mainFrame.focus(selector, options);
  }
  async textContent(selector, options) {
    return await this._mainFrame.textContent(selector, options);
  }
  async innerText(selector, options) {
    return await this._mainFrame.innerText(selector, options);
  }
  async innerHTML(selector, options) {
    return await this._mainFrame.innerHTML(selector, options);
  }
  async getAttribute(selector, name, options) {
    return await this._mainFrame.getAttribute(selector, name, options);
  }
  async inputValue(selector, options) {
    return await this._mainFrame.inputValue(selector, options);
  }
  async isChecked(selector, options) {
    return await this._mainFrame.isChecked(selector, options);
  }
  async isDisabled(selector, options) {
    return await this._mainFrame.isDisabled(selector, options);
  }
  async isEditable(selector, options) {
    return await this._mainFrame.isEditable(selector, options);
  }
  async isEnabled(selector, options) {
    return await this._mainFrame.isEnabled(selector, options);
  }
  async isHidden(selector, options) {
    return await this._mainFrame.isHidden(selector, options);
  }
  async isVisible(selector, options) {
    return await this._mainFrame.isVisible(selector, options);
  }
  async hover(selector, options) {
    return await this._mainFrame.hover(selector, options);
  }
  async selectOption(selector, values, options) {
    return await this._mainFrame.selectOption(selector, values, options);
  }
  async setInputFiles(selector, files, options) {
    return await this._mainFrame.setInputFiles(selector, files, options);
  }
  async type(selector, text, options) {
    return await this._mainFrame.type(selector, text, options);
  }
  async press(selector, key, options) {
    return await this._mainFrame.press(selector, key, options);
  }
  async check(selector, options) {
    return await this._mainFrame.check(selector, options);
  }
  async uncheck(selector, options) {
    return await this._mainFrame.uncheck(selector, options);
  }
  async setChecked(selector, checked, options) {
    return await this._mainFrame.setChecked(selector, checked, options);
  }
  async waitForTimeout(timeout) {
    return await this._mainFrame.waitForTimeout(timeout);
  }
  async waitForFunction(pageFunction, arg, options) {
    return await this._mainFrame.waitForFunction(pageFunction, arg, options);
  }
  workers() {
    return [...this._workers];
  }
  async pause() {
    var _this$_instrumentatio;
    if (require('inspector').url()) return;
    const defaultNavigationTimeout = this._browserContext._timeoutSettings.defaultNavigationTimeout();
    const defaultTimeout = this._browserContext._timeoutSettings.defaultTimeout();
    this._browserContext.setDefaultNavigationTimeout(0);
    this._browserContext.setDefaultTimeout(0);
    (_this$_instrumentatio = this._instrumentation) === null || _this$_instrumentatio === void 0 || _this$_instrumentatio.onWillPause();
    await this._closedOrCrashedScope.safeRace(this.context()._channel.pause());
    this._browserContext.setDefaultNavigationTimeout(defaultNavigationTimeout);
    this._browserContext.setDefaultTimeout(defaultTimeout);
  }
  async pdf(options = {}) {
    const transportOptions = {
      ...options
    };
    if (transportOptions.margin) transportOptions.margin = {
      ...transportOptions.margin
    };
    if (typeof options.width === 'number') transportOptions.width = options.width + 'px';
    if (typeof options.height === 'number') transportOptions.height = options.height + 'px';
    for (const margin of ['top', 'right', 'bottom', 'left']) {
      const index = margin;
      if (options.margin && typeof options.margin[index] === 'number') transportOptions.margin[index] = transportOptions.margin[index] + 'px';
    }
    const result = await this._channel.pdf(transportOptions);
    if (options.path) {
      await _fs.default.promises.mkdir(_path.default.dirname(options.path), {
        recursive: true
      });
      await _fs.default.promises.writeFile(options.path, result.pdf);
    }
    return result.pdf;
  }
}
exports.Page = Page;
class BindingCall extends _channelOwner.ChannelOwner {
  static from(channel) {
    return channel._object;
  }
  constructor(parent, type, guid, initializer) {
    super(parent, type, guid, initializer);
  }
  async call(func) {
    try {
      const frame = _frame.Frame.from(this._initializer.frame);
      const source = {
        context: frame._page.context(),
        page: frame._page,
        frame
      };
      let result;
      if (this._initializer.handle) result = await func(source, _jsHandle.JSHandle.from(this._initializer.handle));else result = await func(source, ...this._initializer.args.map(_jsHandle.parseResult));
      this._channel.resolve({
        result: (0, _jsHandle.serializeArgument)(result)
      }).catch(() => {});
    } catch (e) {
      this._channel.reject({
        error: (0, _errors.serializeError)(e)
      }).catch(() => {});
    }
  }
}
exports.BindingCall = BindingCall;
function trimUrl(param) {
  if ((0, _utils.isRegExp)(param)) return `/${(0, _stringUtils.trimStringWithEllipsis)(param.source, 50)}/${param.flags}`;
  if ((0, _utils.isString)(param)) return `"${(0, _stringUtils.trimStringWithEllipsis)(param, 50)}"`;
}