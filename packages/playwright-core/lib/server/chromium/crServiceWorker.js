"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.CRServiceWorker = void 0;
var _page = require("../page");
var _crExecutionContext = require("./crExecutionContext");
var _crNetworkManager = require("./crNetworkManager");
var network = _interopRequireWildcard(require("../network"));
var _browserContext = require("../browserContext");
function _getRequireWildcardCache(e) { if ("function" != typeof WeakMap) return null; var r = new WeakMap(), t = new WeakMap(); return (_getRequireWildcardCache = function (e) { return e ? t : r; })(e); }
function _interopRequireWildcard(e, r) { if (!r && e && e.__esModule) return e; if (null === e || "object" != typeof e && "function" != typeof e) return { default: e }; var t = _getRequireWildcardCache(r); if (t && t.has(e)) return t.get(e); var n = { __proto__: null }, a = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var u in e) if ("default" !== u && Object.prototype.hasOwnProperty.call(e, u)) { var i = a ? Object.getOwnPropertyDescriptor(e, u) : null; i && (i.get || i.set) ? Object.defineProperty(n, u, i) : n[u] = e[u]; } return n.default = e, t && t.set(e, n), n; }
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

class CRServiceWorker extends _page.Worker {
  constructor(browserContext, session, url) {
    super(browserContext, url);
    this._browserContext = void 0;
    this._networkManager = void 0;
    this._session = void 0;
    this._session = session;
    this._browserContext = browserContext;
    if (!!process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS) this._networkManager = new _crNetworkManager.CRNetworkManager(null, this);
    session.once('Runtime.executionContextCreated', event => {
      this._createExecutionContext(new _crExecutionContext.CRExecutionContext(session, event.context));
    });
    if (this._networkManager && this._isNetworkInspectionEnabled()) {
      this.updateRequestInterception();
      this.updateExtraHTTPHeaders();
      this.updateHttpCredentials();
      this.updateOffline();
      this._networkManager.addSession(session, undefined, true /* isMain */).catch(() => {});
    }
    session.send('Runtime.enable', {}).catch(e => {});
    session.send('Runtime.runIfWaitingForDebugger').catch(e => {});
    session.on('Inspector.targetReloadedAfterCrash', () => {
      // Resume service worker after restart.
      session._sendMayFail('Runtime.runIfWaitingForDebugger', {});
    });
  }
  didClose() {
    var _this$_networkManager;
    (_this$_networkManager = this._networkManager) === null || _this$_networkManager === void 0 || _this$_networkManager.removeSession(this._session);
    this._session.dispose();
    super.didClose();
  }
  async updateOffline() {
    var _this$_networkManager2;
    if (!this._isNetworkInspectionEnabled()) return;
    await ((_this$_networkManager2 = this._networkManager) === null || _this$_networkManager2 === void 0 ? void 0 : _this$_networkManager2.setOffline(!!this._browserContext._options.offline).catch(() => {}));
  }
  async updateHttpCredentials() {
    var _this$_networkManager3;
    if (!this._isNetworkInspectionEnabled()) return;
    await ((_this$_networkManager3 = this._networkManager) === null || _this$_networkManager3 === void 0 ? void 0 : _this$_networkManager3.authenticate(this._browserContext._options.httpCredentials || null).catch(() => {}));
  }
  async updateExtraHTTPHeaders() {
    var _this$_networkManager4;
    if (!this._isNetworkInspectionEnabled()) return;
    await ((_this$_networkManager4 = this._networkManager) === null || _this$_networkManager4 === void 0 ? void 0 : _this$_networkManager4.setExtraHTTPHeaders(this._browserContext._options.extraHTTPHeaders || []).catch(() => {}));
  }
  async updateRequestInterception() {
    var _this$_networkManager5;
    if (!this._isNetworkInspectionEnabled()) return;
    await ((_this$_networkManager5 = this._networkManager) === null || _this$_networkManager5 === void 0 ? void 0 : _this$_networkManager5.setRequestInterception(this.needsRequestInterception()).catch(() => {}));
  }
  needsRequestInterception() {
    return this._isNetworkInspectionEnabled() && !!this._browserContext._requestInterceptor;
  }
  reportRequestFinished(request, response) {
    this._browserContext.emit(_browserContext.BrowserContext.Events.RequestFinished, {
      request,
      response
    });
  }
  requestFailed(request, _canceled) {
    this._browserContext.emit(_browserContext.BrowserContext.Events.RequestFailed, request);
  }
  requestReceivedResponse(response) {
    this._browserContext.emit(_browserContext.BrowserContext.Events.Response, response);
  }
  requestStarted(request, route) {
    this._browserContext.emit(_browserContext.BrowserContext.Events.Request, request);
    if (route) {
      var _this$_browserContext, _this$_browserContext2;
      const r = new network.Route(request, route);
      if ((_this$_browserContext = (_this$_browserContext2 = this._browserContext)._requestInterceptor) !== null && _this$_browserContext !== void 0 && _this$_browserContext.call(_this$_browserContext2, r, request)) return;
      r.continue({
        isFallback: true
      }).catch(() => {});
    }
  }
  _isNetworkInspectionEnabled() {
    return this._browserContext._options.serviceWorkers !== 'block';
  }
}
exports.CRServiceWorker = CRServiceWorker;