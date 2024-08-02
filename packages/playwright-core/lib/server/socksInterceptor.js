"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.SocksInterceptor = void 0;
var socks = _interopRequireWildcard(require("../common/socksProxy"));
var _events = _interopRequireDefault(require("events"));
var _validator = require("../protocol/validator");
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
function _getRequireWildcardCache(e) { if ("function" != typeof WeakMap) return null; var r = new WeakMap(), t = new WeakMap(); return (_getRequireWildcardCache = function (e) { return e ? t : r; })(e); }
function _interopRequireWildcard(e, r) { if (!r && e && e.__esModule) return e; if (null === e || "object" != typeof e && "function" != typeof e) return { default: e }; var t = _getRequireWildcardCache(r); if (t && t.has(e)) return t.get(e); var n = { __proto__: null }, a = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var u in e) if ("default" !== u && Object.prototype.hasOwnProperty.call(e, u)) { var i = a ? Object.getOwnPropertyDescriptor(e, u) : null; i && (i.get || i.set) ? Object.defineProperty(n, u, i) : n[u] = e[u]; } return n.default = e, t && t.set(e, n), n; }
/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License");
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

class SocksInterceptor {
  constructor(transport, pattern, redirectPortForTest) {
    this._handler = void 0;
    this._channel = void 0;
    this._socksSupportObjectGuid = void 0;
    this._ids = new Set();
    this._handler = new socks.SocksProxyHandler(pattern, redirectPortForTest);
    let lastId = -1;
    this._channel = new Proxy(new _events.default(), {
      get: (obj, prop) => {
        if (prop in obj || obj[prop] !== undefined || typeof prop !== 'string') return obj[prop];
        return params => {
          try {
            const id = --lastId;
            this._ids.add(id);
            const validator = (0, _validator.findValidator)('SocksSupport', prop, 'Params');
            params = validator(params, '', {
              tChannelImpl: tChannelForSocks,
              binary: 'toBase64'
            });
            transport.send({
              id,
              guid: this._socksSupportObjectGuid,
              method: prop,
              params,
              metadata: {
                stack: [],
                apiName: '',
                internal: true
              }
            });
          } catch (e) {}
        };
      }
    });
    this._handler.on(socks.SocksProxyHandler.Events.SocksConnected, payload => this._channel.socksConnected(payload));
    this._handler.on(socks.SocksProxyHandler.Events.SocksData, payload => this._channel.socksData(payload));
    this._handler.on(socks.SocksProxyHandler.Events.SocksError, payload => this._channel.socksError(payload));
    this._handler.on(socks.SocksProxyHandler.Events.SocksFailed, payload => this._channel.socksFailed(payload));
    this._handler.on(socks.SocksProxyHandler.Events.SocksEnd, payload => this._channel.socksEnd(payload));
    this._channel.on('socksRequested', payload => this._handler.socketRequested(payload));
    this._channel.on('socksClosed', payload => this._handler.socketClosed(payload));
    this._channel.on('socksData', payload => this._handler.sendSocketData(payload));
  }
  cleanup() {
    this._handler.cleanup();
  }
  interceptMessage(message) {
    if (this._ids.has(message.id)) {
      this._ids.delete(message.id);
      return true;
    }
    if (message.method === '__create__' && message.params.type === 'SocksSupport') {
      this._socksSupportObjectGuid = message.params.guid;
      return false;
    }
    if (this._socksSupportObjectGuid && message.guid === this._socksSupportObjectGuid) {
      const validator = (0, _validator.findValidator)('SocksSupport', message.method, 'Event');
      const params = validator(message.params, '', {
        tChannelImpl: tChannelForSocks,
        binary: 'fromBase64'
      });
      this._channel.emit(message.method, params);
      return true;
    }
    return false;
  }
}
exports.SocksInterceptor = SocksInterceptor;
function tChannelForSocks(names, arg, path, context) {
  throw new _validator.ValidationError(`${path}: channels are not expected in SocksSupport`);
}