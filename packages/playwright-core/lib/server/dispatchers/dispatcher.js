"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.dispatcherSymbol = exports.RootDispatcher = exports.DispatcherConnection = exports.Dispatcher = void 0;
exports.existingDispatcher = existingDispatcher;
exports.setMaxDispatchersForTest = setMaxDispatchersForTest;
var _events = require("events");
var _validator = require("../../protocol/validator");
var _utils = require("../../utils");
var _errors = require("../errors");
var _instrumentation = require("../instrumentation");
var _eventsHelper = require("../..//utils/eventsHelper");
var _protocolError = require("../protocolError");
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

const dispatcherSymbol = exports.dispatcherSymbol = Symbol('dispatcher');
const metadataValidator = (0, _validator.createMetadataValidator)();
function existingDispatcher(object) {
  return object[dispatcherSymbol];
}
let maxDispatchersOverride;
function setMaxDispatchersForTest(value) {
  maxDispatchersOverride = value;
}
function maxDispatchersForBucket(gcBucket) {
  var _ref, _maxDispatchersOverri;
  return (_ref = (_maxDispatchersOverri = maxDispatchersOverride) !== null && _maxDispatchersOverri !== void 0 ? _maxDispatchersOverri : {
    'JSHandle': 100000,
    'ElementHandle': 100000
  }[gcBucket]) !== null && _ref !== void 0 ? _ref : 10000;
}
class Dispatcher extends _events.EventEmitter {
  constructor(parent, object, type, initializer, gcBucket) {
    super();
    this._connection = void 0;
    // Parent is always "isScope".
    this._parent = void 0;
    // Only "isScope" channel owners have registered dispatchers inside.
    this._dispatchers = new Map();
    this._disposed = false;
    this._eventListeners = [];
    this._guid = void 0;
    this._type = void 0;
    this._gcBucket = void 0;
    this._object = void 0;
    this._openScope = new _utils.LongStandingScope();
    this._connection = parent instanceof DispatcherConnection ? parent : parent._connection;
    this._parent = parent instanceof DispatcherConnection ? undefined : parent;
    const guid = object.guid;
    this._guid = guid;
    this._type = type;
    this._object = object;
    this._gcBucket = gcBucket !== null && gcBucket !== void 0 ? gcBucket : type;
    object[dispatcherSymbol] = this;
    this._connection.registerDispatcher(this);
    if (this._parent) {
      (0, _utils.assert)(!this._parent._dispatchers.has(guid));
      this._parent._dispatchers.set(guid, this);
    }
    if (this._parent) this._connection.sendCreate(this._parent, type, guid, initializer);
    this._connection.maybeDisposeStaleDispatchers(this._gcBucket);
  }
  parentScope() {
    return this._parent;
  }
  addObjectListener(eventName, handler) {
    this._eventListeners.push(_eventsHelper.eventsHelper.addEventListener(this._object, eventName, handler));
  }
  adopt(child) {
    if (child._parent === this) return;
    const oldParent = child._parent;
    oldParent._dispatchers.delete(child._guid);
    this._dispatchers.set(child._guid, child);
    child._parent = this;
    this._connection.sendAdopt(this, child);
  }
  async _handleCommand(callMetadata, method, validParams) {
    const commandPromise = this[method](validParams, callMetadata);
    try {
      return await this._openScope.race(commandPromise);
    } catch (e) {
      if (callMetadata.potentiallyClosesScope && (0, _errors.isTargetClosedError)(e)) return await commandPromise;
      throw e;
    }
  }
  _dispatchEvent(method, params) {
    if (this._disposed) {
      if ((0, _utils.isUnderTest)()) throw new Error(`${this._guid} is sending "${String(method)}" event after being disposed`);
      // Just ignore this event outside of tests.
      return;
    }
    this._connection.sendEvent(this, method, params);
  }
  _dispose(reason) {
    this._disposeRecursively(new _errors.TargetClosedError());
    this._connection.sendDispose(this, reason);
  }
  _onDispose() {}
  _disposeRecursively(error) {
    var _this$_parent;
    (0, _utils.assert)(!this._disposed, `${this._guid} is disposed more than once`);
    this._onDispose();
    this._disposed = true;
    _eventsHelper.eventsHelper.removeEventListeners(this._eventListeners);

    // Clean up from parent and connection.
    (_this$_parent = this._parent) === null || _this$_parent === void 0 || _this$_parent._dispatchers.delete(this._guid);
    const list = this._connection._dispatchersByBucket.get(this._gcBucket);
    list === null || list === void 0 || list.delete(this._guid);
    this._connection._dispatchers.delete(this._guid);

    // Dispose all children.
    for (const dispatcher of [...this._dispatchers.values()]) dispatcher._disposeRecursively(error);
    this._dispatchers.clear();
    delete this._object[dispatcherSymbol];
    this._openScope.close(error);
  }
  _debugScopeState() {
    return {
      _guid: this._guid,
      objects: Array.from(this._dispatchers.values()).map(o => o._debugScopeState())
    };
  }
  async waitForEventInfo() {
    // Instrumentation takes care of this.
  }
}
exports.Dispatcher = Dispatcher;
class RootDispatcher extends Dispatcher {
  constructor(connection, createPlaywright) {
    super(connection, {
      guid: ''
    }, 'Root', {});
    this._initialized = false;
    this.createPlaywright = createPlaywright;
  }
  async initialize(params) {
    (0, _utils.assert)(this.createPlaywright);
    (0, _utils.assert)(!this._initialized);
    this._initialized = true;
    return {
      playwright: await this.createPlaywright(this, params)
    };
  }
}
exports.RootDispatcher = RootDispatcher;
class DispatcherConnection {
  constructor(isLocal) {
    this._dispatchers = new Map();
    this._dispatchersByBucket = new Map();
    this.onmessage = message => {};
    this._waitOperations = new Map();
    this._isLocal = void 0;
    this._isLocal = !!isLocal;
  }
  sendEvent(dispatcher, event, params) {
    const validator = (0, _validator.findValidator)(dispatcher._type, event, 'Event');
    params = validator(params, '', {
      tChannelImpl: this._tChannelImplToWire.bind(this),
      binary: this._isLocal ? 'buffer' : 'toBase64'
    });
    this.onmessage({
      guid: dispatcher._guid,
      method: event,
      params
    });
  }
  sendCreate(parent, type, guid, initializer) {
    const validator = (0, _validator.findValidator)(type, '', 'Initializer');
    initializer = validator(initializer, '', {
      tChannelImpl: this._tChannelImplToWire.bind(this),
      binary: this._isLocal ? 'buffer' : 'toBase64'
    });
    this.onmessage({
      guid: parent._guid,
      method: '__create__',
      params: {
        type,
        initializer,
        guid
      }
    });
  }
  sendAdopt(parent, dispatcher) {
    this.onmessage({
      guid: parent._guid,
      method: '__adopt__',
      params: {
        guid: dispatcher._guid
      }
    });
  }
  sendDispose(dispatcher, reason) {
    this.onmessage({
      guid: dispatcher._guid,
      method: '__dispose__',
      params: {
        reason
      }
    });
  }
  _tChannelImplFromWire(names, arg, path, context) {
    if (arg && typeof arg === 'object' && typeof arg.guid === 'string') {
      const guid = arg.guid;
      const dispatcher = this._dispatchers.get(guid);
      if (!dispatcher) throw new _validator.ValidationError(`${path}: no object with guid ${guid}`);
      if (names !== '*' && !names.includes(dispatcher._type)) throw new _validator.ValidationError(`${path}: object with guid ${guid} has type ${dispatcher._type}, expected ${names.toString()}`);
      return dispatcher;
    }
    throw new _validator.ValidationError(`${path}: expected guid for ${names.toString()}`);
  }
  _tChannelImplToWire(names, arg, path, context) {
    if (arg instanceof Dispatcher) {
      if (names !== '*' && !names.includes(arg._type)) throw new _validator.ValidationError(`${path}: dispatcher with guid ${arg._guid} has type ${arg._type}, expected ${names.toString()}`);
      return {
        guid: arg._guid
      };
    }
    throw new _validator.ValidationError(`${path}: expected dispatcher ${names.toString()}`);
  }
  registerDispatcher(dispatcher) {
    (0, _utils.assert)(!this._dispatchers.has(dispatcher._guid));
    this._dispatchers.set(dispatcher._guid, dispatcher);
    let list = this._dispatchersByBucket.get(dispatcher._gcBucket);
    if (!list) {
      list = new Set();
      this._dispatchersByBucket.set(dispatcher._gcBucket, list);
    }
    list.add(dispatcher._guid);
  }
  maybeDisposeStaleDispatchers(gcBucket) {
    const maxDispatchers = maxDispatchersForBucket(gcBucket);
    const list = this._dispatchersByBucket.get(gcBucket);
    if (!list || list.size <= maxDispatchers) return;
    const dispatchersArray = [...list];
    const disposeCount = maxDispatchers / 10 | 0;
    this._dispatchersByBucket.set(gcBucket, new Set(dispatchersArray.slice(disposeCount)));
    for (let i = 0; i < disposeCount; ++i) {
      const d = this._dispatchers.get(dispatchersArray[i]);
      if (!d) continue;
      d._dispose('gc');
    }
  }
  async dispatch(message) {
    var _sdkObject$attributio, _sdkObject$attributio2, _params$info;
    const {
      id,
      guid,
      method,
      params,
      metadata
    } = message;
    const dispatcher = this._dispatchers.get(guid);
    if (!dispatcher) {
      this.onmessage({
        id,
        error: (0, _errors.serializeError)(new _errors.TargetClosedError())
      });
      return;
    }
    let validParams;
    let validMetadata;
    try {
      const validator = (0, _validator.findValidator)(dispatcher._type, method, 'Params');
      validParams = validator(params, '', {
        tChannelImpl: this._tChannelImplFromWire.bind(this),
        binary: this._isLocal ? 'buffer' : 'fromBase64'
      });
      validMetadata = metadataValidator(metadata, '', {
        tChannelImpl: this._tChannelImplFromWire.bind(this),
        binary: this._isLocal ? 'buffer' : 'fromBase64'
      });
      if (typeof dispatcher[method] !== 'function') throw new Error(`Mismatching dispatcher: "${dispatcher._type}" does not implement "${method}"`);
    } catch (e) {
      this.onmessage({
        id,
        error: (0, _errors.serializeError)(e)
      });
      return;
    }
    const sdkObject = dispatcher._object instanceof _instrumentation.SdkObject ? dispatcher._object : undefined;
    const callMetadata = {
      id: `call@${id}`,
      location: validMetadata.location,
      apiName: validMetadata.apiName,
      internal: validMetadata.internal,
      stepId: validMetadata.stepId,
      objectId: sdkObject === null || sdkObject === void 0 ? void 0 : sdkObject.guid,
      pageId: sdkObject === null || sdkObject === void 0 || (_sdkObject$attributio = sdkObject.attribution) === null || _sdkObject$attributio === void 0 || (_sdkObject$attributio = _sdkObject$attributio.page) === null || _sdkObject$attributio === void 0 ? void 0 : _sdkObject$attributio.guid,
      frameId: sdkObject === null || sdkObject === void 0 || (_sdkObject$attributio2 = sdkObject.attribution) === null || _sdkObject$attributio2 === void 0 || (_sdkObject$attributio2 = _sdkObject$attributio2.frame) === null || _sdkObject$attributio2 === void 0 ? void 0 : _sdkObject$attributio2.guid,
      startTime: (0, _utils.monotonicTime)(),
      endTime: 0,
      type: dispatcher._type,
      method,
      params: params || {},
      log: []
    };
    if (sdkObject && params !== null && params !== void 0 && (_params$info = params.info) !== null && _params$info !== void 0 && _params$info.waitId) {
      // Process logs for waitForNavigation/waitForLoadState/etc.
      const info = params.info;
      switch (info.phase) {
        case 'before':
          {
            this._waitOperations.set(info.waitId, callMetadata);
            await sdkObject.instrumentation.onBeforeCall(sdkObject, callMetadata);
            this.onmessage({
              id
            });
            return;
          }
        case 'log':
          {
            const originalMetadata = this._waitOperations.get(info.waitId);
            originalMetadata.log.push(info.message);
            sdkObject.instrumentation.onCallLog(sdkObject, originalMetadata, 'api', info.message);
            this.onmessage({
              id
            });
            return;
          }
        case 'after':
          {
            const originalMetadata = this._waitOperations.get(info.waitId);
            originalMetadata.endTime = (0, _utils.monotonicTime)();
            originalMetadata.error = info.error ? {
              error: {
                name: 'Error',
                message: info.error
              }
            } : undefined;
            this._waitOperations.delete(info.waitId);
            await sdkObject.instrumentation.onAfterCall(sdkObject, originalMetadata);
            this.onmessage({
              id
            });
            return;
          }
      }
    }
    await (sdkObject === null || sdkObject === void 0 ? void 0 : sdkObject.instrumentation.onBeforeCall(sdkObject, callMetadata));
    const response = {
      id
    };
    try {
      const result = await dispatcher._handleCommand(callMetadata, method, validParams);
      const validator = (0, _validator.findValidator)(dispatcher._type, method, 'Result');
      response.result = validator(result, '', {
        tChannelImpl: this._tChannelImplToWire.bind(this),
        binary: this._isLocal ? 'buffer' : 'toBase64'
      });
      callMetadata.result = result;
    } catch (e) {
      if ((0, _errors.isTargetClosedError)(e) && sdkObject) {
        const reason = closeReason(sdkObject);
        if (reason) (0, _utils.rewriteErrorMessage)(e, reason);
      } else if ((0, _protocolError.isProtocolError)(e)) {
        if (e.type === 'closed') {
          const reason = sdkObject ? closeReason(sdkObject) : undefined;
          e = new _errors.TargetClosedError(reason, e.browserLogMessage());
        } else if (e.type === 'crashed') {
          (0, _utils.rewriteErrorMessage)(e, 'Target crashed ' + e.browserLogMessage());
        }
      }
      response.error = (0, _errors.serializeError)(e);
      // The command handler could have set error in the metadata, do not reset it if there was no exception.
      callMetadata.error = response.error;
    } finally {
      callMetadata.endTime = (0, _utils.monotonicTime)();
      await (sdkObject === null || sdkObject === void 0 ? void 0 : sdkObject.instrumentation.onAfterCall(sdkObject, callMetadata));
    }
    if (response.error) response.log = callMetadata.log;
    this.onmessage(response);
  }
}
exports.DispatcherConnection = DispatcherConnection;
function closeReason(sdkObject) {
  var _sdkObject$attributio3, _sdkObject$attributio4, _sdkObject$attributio5;
  return ((_sdkObject$attributio3 = sdkObject.attribution.page) === null || _sdkObject$attributio3 === void 0 ? void 0 : _sdkObject$attributio3._closeReason) || ((_sdkObject$attributio4 = sdkObject.attribution.context) === null || _sdkObject$attributio4 === void 0 ? void 0 : _sdkObject$attributio4._closeReason) || ((_sdkObject$attributio5 = sdkObject.attribution.browser) === null || _sdkObject$attributio5 === void 0 ? void 0 : _sdkObject$attributio5._closeReason);
}