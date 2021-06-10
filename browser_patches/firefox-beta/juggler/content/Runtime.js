/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";
// Note: this file should be loadabale with eval() into worker environment.
// Avoid Components.*, ChromeUtils and global const variables.

if (!this.Debugger) {
  // Worker has a Debugger defined already.
  const {addDebuggerToGlobal} = ChromeUtils.import("resource://gre/modules/jsdebugger.jsm", {});
  addDebuggerToGlobal(Components.utils.getGlobalForObject(this));
}

let lastId = 0;
function generateId() {
  return 'id-' + (++lastId);
}

const consoleLevelToProtocolType = {
  'dir': 'dir',
  'log': 'log',
  'debug': 'debug',
  'info': 'info',
  'error': 'error',
  'warn': 'warning',
  'dirxml': 'dirxml',
  'table': 'table',
  'trace': 'trace',
  'clear': 'clear',
  'group': 'startGroup',
  'groupCollapsed': 'startGroupCollapsed',
  'groupEnd': 'endGroup',
  'assert': 'assert',
  'profile': 'profile',
  'profileEnd': 'profileEnd',
  'count': 'count',
  'countReset': 'countReset',
  'time': null,
  'timeLog': 'timeLog',
  'timeEnd': 'timeEnd',
  'timeStamp': 'timeStamp',
};

const disallowedMessageCategories = new Set([
  'XPConnect JavaScript',
  'component javascript',
  'chrome javascript',
  'chrome registration',
  'XBL',
  'XBL Prototype Handler',
  'XBL Content Sink',
  'xbl javascript',
]);

class Runtime {
  constructor(isWorker = false) {
    this._debugger = new Debugger();
    this._pendingPromises = new Map();
    this._executionContexts = new Map();
    this._windowToExecutionContext = new Map();
    this._eventListeners = [];
    if (isWorker) {
      this._registerWorkerConsoleHandler();
    } else {
      const {Services} = ChromeUtils.import("resource://gre/modules/Services.jsm");
      this._registerConsoleServiceListener(Services);
      this._registerConsoleObserver(Services);
    }
    // We can't use event listener here to be compatible with Worker Global Context.
    // Use plain callbacks instead.
    this.events = {
      onConsoleMessage: createEvent(),
      onErrorFromWorker: createEvent(),
      onExecutionContextCreated: createEvent(),
      onExecutionContextDestroyed: createEvent(),
      onBindingCalled: createEvent(),
    };
  }

  executionContexts() {
    return [...this._executionContexts.values()];
  }

  async evaluate({executionContextId, expression, returnByValue}) {
    const executionContext = this.findExecutionContext(executionContextId);
    if (!executionContext)
      throw new Error('Failed to find execution context with id = ' + executionContextId);
    const exceptionDetails = {};
    let result = await executionContext.evaluateScript(expression, exceptionDetails);
    if (!result)
      return {exceptionDetails};
    if (returnByValue)
      result = executionContext.ensureSerializedToValue(result);
    return {result};
  }

  async callFunction({executionContextId, functionDeclaration, args, returnByValue}) {
    const executionContext = this.findExecutionContext(executionContextId);
    if (!executionContext)
      throw new Error('Failed to find execution context with id = ' + executionContextId);
    const exceptionDetails = {};
    let result = await executionContext.evaluateFunction(functionDeclaration, args, exceptionDetails);
    if (!result)
      return {exceptionDetails};
    if (returnByValue)
      result = executionContext.ensureSerializedToValue(result);
    return {result};
  }

  async getObjectProperties({executionContextId, objectId}) {
    const executionContext = this.findExecutionContext(executionContextId);
    if (!executionContext)
      throw new Error('Failed to find execution context with id = ' + executionContextId);
    return {properties: executionContext.getObjectProperties(objectId)};
  }

  async disposeObject({executionContextId, objectId}) {
    const executionContext = this.findExecutionContext(executionContextId);
    if (!executionContext)
      throw new Error('Failed to find execution context with id = ' + executionContextId);
    return executionContext.disposeObject(objectId);
  }

  _registerConsoleServiceListener(Services) {
    const Ci = Components.interfaces;
    const consoleServiceListener = {
      QueryInterface: ChromeUtils.generateQI([Ci.nsIConsoleListener]),

      observe: message => {
        if (!(message instanceof Ci.nsIScriptError) || !message.outerWindowID ||
            !message.category || disallowedMessageCategories.has(message.category)) {
          return;
        }
        const errorWindow = Services.wm.getOuterWindowWithId(message.outerWindowID);
        if (message.category === 'Web Worker' && message.logLevel === Ci.nsIConsoleMessage.error) {
          emitEvent(this.events.onErrorFromWorker, errorWindow, message.message, '' + message.stack);
          return;
        }
        const executionContext = this._windowToExecutionContext.get(errorWindow);
        if (!executionContext)
          return;
        const typeNames = {
          [Ci.nsIConsoleMessage.debug]: 'debug',
          [Ci.nsIConsoleMessage.info]: 'info',
          [Ci.nsIConsoleMessage.warn]: 'warn',
          [Ci.nsIConsoleMessage.error]: 'error',
        };
        emitEvent(this.events.onConsoleMessage, {
          args: [{
            value: message.message,
          }],
          type: typeNames[message.logLevel],
          executionContextId: executionContext.id(),
          location: {
            lineNumber: message.lineNumber,
            columnNumber: message.columnNumber,
            url: message.sourceName,
          },
        });
      },
    };
    Services.console.registerListener(consoleServiceListener);
    this._eventListeners.push(() => Services.console.unregisterListener(consoleServiceListener));
  }

  _registerConsoleObserver(Services) {
    const consoleObserver = ({wrappedJSObject}, topic, data) => {
      const executionContext = Array.from(this._executionContexts.values()).find(context => {
        // There is no easy way to determine isolated world context and we normally don't write
        // objects to console from utility worlds so we always return main world context here.
        if (context._isIsolatedWorldContext())
          return false;
        const domWindow = context._domWindow;
        return domWindow && domWindow.windowGlobalChild.innerWindowId === wrappedJSObject.innerID;
      });
      if (!executionContext)
        return;
      this._onConsoleMessage(executionContext, wrappedJSObject);
    };
    Services.obs.addObserver(consoleObserver, "console-api-log-event");
    this._eventListeners.push(() => Services.obs.removeObserver(consoleObserver, "console-api-log-event"));
  }

  _registerWorkerConsoleHandler() {
    setConsoleEventHandler(message => {
      const executionContext = Array.from(this._executionContexts.values())[0];
      this._onConsoleMessage(executionContext, message);
    });
    this._eventListeners.push(() => setConsoleEventHandler(null));
  }

  _onConsoleMessage(executionContext, message) {
    const type = consoleLevelToProtocolType[message.level];
    if (!type)
      return;
    const args = message.arguments.map(arg => executionContext.rawValueToRemoteObject(arg));
    emitEvent(this.events.onConsoleMessage, {
      args,
      type,
      executionContextId: executionContext.id(),
      location: {
        lineNumber: message.lineNumber - 1,
        columnNumber: message.columnNumber - 1,
        url: message.filename,
      },
    });
  }

  dispose() {
    for (const tearDown of this._eventListeners)
      tearDown.call(null);
    this._eventListeners = [];
  }

  async _awaitPromise(executionContext, obj, exceptionDetails = {}) {
    if (obj.promiseState === 'fulfilled')
      return {success: true, obj: obj.promiseValue};
    if (obj.promiseState === 'rejected') {
      const debuggee = executionContext._debuggee;
      exceptionDetails.text = debuggee.executeInGlobalWithBindings('e.message', {e: obj.promiseReason}).return;
      exceptionDetails.stack = debuggee.executeInGlobalWithBindings('e.stack', {e: obj.promiseReason}).return;
      return {success: false, obj: null};
    }
    let resolve, reject;
    const promise = new Promise((a, b) => {
      resolve = a;
      reject = b;
    });
    this._pendingPromises.set(obj.promiseID, {resolve, reject, executionContext, exceptionDetails});
    if (this._pendingPromises.size === 1)
      this._debugger.onPromiseSettled = this._onPromiseSettled.bind(this);
    return await promise;
  }

  _onPromiseSettled(obj) {
    const pendingPromise = this._pendingPromises.get(obj.promiseID);
    if (!pendingPromise)
      return;
    this._pendingPromises.delete(obj.promiseID);
    if (!this._pendingPromises.size)
      this._debugger.onPromiseSettled = undefined;

    if (obj.promiseState === 'fulfilled') {
      pendingPromise.resolve({success: true, obj: obj.promiseValue});
      return;
    };
    const debuggee = pendingPromise.executionContext._debuggee;
    pendingPromise.exceptionDetails.text = debuggee.executeInGlobalWithBindings('e.message', {e: obj.promiseReason}).return;
    pendingPromise.exceptionDetails.stack = debuggee.executeInGlobalWithBindings('e.stack', {e: obj.promiseReason}).return;
    pendingPromise.resolve({success: false, obj: null});
  }

  createExecutionContext(domWindow, contextGlobal, auxData) {
    // Note: domWindow is null for workers.
    const context = new ExecutionContext(this, domWindow, contextGlobal, auxData);
    this._executionContexts.set(context._id, context);
    if (domWindow)
      this._windowToExecutionContext.set(domWindow, context);
    emitEvent(this.events.onExecutionContextCreated, context);
    return context;
  }

  findExecutionContext(executionContextId) {
    const executionContext = this._executionContexts.get(executionContextId);
    if (!executionContext)
      throw new Error('Failed to find execution context with id = ' + executionContextId);
    return executionContext;
  }

  destroyExecutionContext(destroyedContext) {
    for (const [promiseID, {reject, executionContext}] of this._pendingPromises) {
      if (executionContext === destroyedContext) {
        reject(new Error('Execution context was destroyed!'));
        this._pendingPromises.delete(promiseID);
      }
    }
    if (!this._pendingPromises.size)
      this._debugger.onPromiseSettled = undefined;
    this._debugger.removeDebuggee(destroyedContext._contextGlobal);
    this._executionContexts.delete(destroyedContext._id);
    if (destroyedContext._domWindow)
      this._windowToExecutionContext.delete(destroyedContext._domWindow);
    emitEvent(this.events.onExecutionContextDestroyed, destroyedContext);
  }
}

class ExecutionContext {
  constructor(runtime, domWindow, contextGlobal, auxData) {
    this._runtime = runtime;
    this._domWindow = domWindow;
    this._contextGlobal = contextGlobal;
    this._debuggee = runtime._debugger.addDebuggee(contextGlobal);
    this._remoteObjects = new Map();
    this._id = generateId();
    this._auxData = auxData;
    this._jsonStringifyObject = this._debuggee.executeInGlobal(`((stringify, object) => {
      const oldToJSON = Date.prototype.toJSON;
      Date.prototype.toJSON = undefined;
      const oldArrayToJSON = Array.prototype.toJSON;
      const oldArrayHadToJSON = Array.prototype.hasOwnProperty('toJSON');
      if (oldArrayHadToJSON)
        Array.prototype.toJSON = undefined;

      let hasSymbol = false;
      const result = stringify(object, (key, value) => {
        if (typeof value === 'symbol')
          hasSymbol = true;
        return value;
      });

      Date.prototype.toJSON = oldToJSON;
      if (oldArrayHadToJSON)
        Array.prototype.toJSON = oldArrayToJSON;

      return hasSymbol ? undefined : result;
    }).bind(null, JSON.stringify.bind(JSON))`).return;
  }

  id() {
    return this._id;
  }

  auxData() {
    return this._auxData;
  }

  _isIsolatedWorldContext() {
    return !!this._auxData.name;
  }

  async evaluateScript(script, exceptionDetails = {}) {
    const userInputHelper = this._domWindow ? this._domWindow.windowUtils.setHandlingUserInput(true) : null;
    if (this._domWindow && this._domWindow.document)
      this._domWindow.document.notifyUserGestureActivation();

    let {success, obj} = this._getResult(this._debuggee.executeInGlobal(script), exceptionDetails);
    userInputHelper && userInputHelper.destruct();
    if (!success)
      return null;
    if (obj && obj.isPromise) {
      const awaitResult = await this._runtime._awaitPromise(this, obj, exceptionDetails);
      if (!awaitResult.success)
        return null;
      obj = awaitResult.obj;
    }
    return this._createRemoteObject(obj);
  }

  evaluateScriptSafely(script) {
    try {
      this._debuggee.executeInGlobal(script);
    } catch (e) {
      dump(`ERROR: ${e.message}\n${e.stack}\n`);
    }
  }

  async evaluateFunction(functionText, args, exceptionDetails = {}) {
    const funEvaluation = this._getResult(this._debuggee.executeInGlobal('(' + functionText + ')'), exceptionDetails);
    if (!funEvaluation.success)
      return null;
    if (!funEvaluation.obj.callable)
      throw new Error('functionText does not evaluate to a function!');
    args = args.map(arg => {
      if (arg.objectId) {
        if (!this._remoteObjects.has(arg.objectId))
          throw new Error('Cannot find object with id = ' + arg.objectId);
        return this._remoteObjects.get(arg.objectId);
      }
      switch (arg.unserializableValue) {
        case 'Infinity': return Infinity;
        case '-Infinity': return -Infinity;
        case '-0': return -0;
        case 'NaN': return NaN;
        default: return this._toDebugger(arg.value);
      }
    });
    const userInputHelper = this._domWindow ? this._domWindow.windowUtils.setHandlingUserInput(true) : null;
    if (this._domWindow && this._domWindow.document)
      this._domWindow.document.notifyUserGestureActivation();
    let {success, obj} = this._getResult(funEvaluation.obj.apply(null, args), exceptionDetails);
    userInputHelper && userInputHelper.destruct();
    if (!success)
      return null;
    if (obj && obj.isPromise) {
      const awaitResult = await this._runtime._awaitPromise(this, obj, exceptionDetails);
      if (!awaitResult.success)
        return null;
      obj = awaitResult.obj;
    }
    return this._createRemoteObject(obj);
  }

  addBinding(name, script) {
    Cu.exportFunction((...args) => {
      emitEvent(this._runtime.events.onBindingCalled, {
        executionContextId: this._id,
        name,
        payload: args[0],
      });
    }, this._contextGlobal, {
      defineAs: name,
    });
    this.evaluateScriptSafely(script);
  }

  unsafeObject(objectId) {
    if (!this._remoteObjects.has(objectId))
      return;
    return { object: this._remoteObjects.get(objectId).unsafeDereference() };
  }

  rawValueToRemoteObject(rawValue) {
    const debuggerObj = this._debuggee.makeDebuggeeValue(rawValue);
    return this._createRemoteObject(debuggerObj);
  }

  _instanceOf(debuggerObj, rawObj, className) {
    if (this._domWindow)
      return rawObj instanceof this._domWindow[className];
    return this._debuggee.executeInGlobalWithBindings('o instanceof this[className]', {o: debuggerObj, className: this._debuggee.makeDebuggeeValue(className)}).return;
  }

  _createRemoteObject(debuggerObj) {
    if (debuggerObj instanceof Debugger.Object) {
      const objectId = generateId();
      this._remoteObjects.set(objectId, debuggerObj);
      const rawObj = debuggerObj.unsafeDereference();
      const type = typeof rawObj;
      let subtype = undefined;
      if (debuggerObj.isProxy)
        subtype = 'proxy';
      else if (Array.isArray(rawObj))
        subtype = 'array';
      else if (Object.is(rawObj, null))
        subtype = 'null';
      else if (this._instanceOf(debuggerObj, rawObj, 'Node'))
        subtype = 'node';
      else if (this._instanceOf(debuggerObj, rawObj, 'RegExp'))
        subtype = 'regexp';
      else if (this._instanceOf(debuggerObj, rawObj, 'Date'))
        subtype = 'date';
      else if (this._instanceOf(debuggerObj, rawObj, 'Map'))
        subtype = 'map';
      else if (this._instanceOf(debuggerObj, rawObj, 'Set'))
        subtype = 'set';
      else if (this._instanceOf(debuggerObj, rawObj, 'WeakMap'))
        subtype = 'weakmap';
      else if (this._instanceOf(debuggerObj, rawObj, 'WeakSet'))
        subtype = 'weakset';
      else if (this._instanceOf(debuggerObj, rawObj, 'Error'))
        subtype = 'error';
      else if (this._instanceOf(debuggerObj, rawObj, 'Promise'))
        subtype = 'promise';
      else if ((this._instanceOf(debuggerObj, rawObj, 'Int8Array')) || (this._instanceOf(debuggerObj, rawObj, 'Uint8Array')) ||
               (this._instanceOf(debuggerObj, rawObj, 'Uint8ClampedArray')) || (this._instanceOf(debuggerObj, rawObj, 'Int16Array')) ||
               (this._instanceOf(debuggerObj, rawObj, 'Uint16Array')) || (this._instanceOf(debuggerObj, rawObj, 'Int32Array')) ||
               (this._instanceOf(debuggerObj, rawObj, 'Uint32Array')) || (this._instanceOf(debuggerObj, rawObj, 'Float32Array')) ||
               (this._instanceOf(debuggerObj, rawObj, 'Float64Array'))) {
        subtype = 'typedarray';
      }
      return {objectId, type, subtype};
    }
    if (typeof debuggerObj === 'symbol') {
      const objectId = generateId();
      this._remoteObjects.set(objectId, debuggerObj);
      return {objectId, type: 'symbol'};
    }

    let unserializableValue = undefined;
    if (Object.is(debuggerObj, NaN))
      unserializableValue = 'NaN';
    else if (Object.is(debuggerObj, -0))
      unserializableValue = '-0';
    else if (Object.is(debuggerObj, Infinity))
      unserializableValue = 'Infinity';
    else if (Object.is(debuggerObj, -Infinity))
      unserializableValue = '-Infinity';
    return unserializableValue ? {unserializableValue} : {value: debuggerObj};
  }

  ensureSerializedToValue(protocolObject) {
    if (!protocolObject.objectId)
      return protocolObject;
    const obj = this._remoteObjects.get(protocolObject.objectId);
    this._remoteObjects.delete(protocolObject.objectId);
    return {value: this._serialize(obj)};
  }

  _toDebugger(obj) {
    if (typeof obj !== 'object')
      return obj;
    if (obj === null)
      return obj;
    const properties = {};
    for (let [key, value] of Object.entries(obj)) {
      properties[key] = {
        configurable: true,
        writable: true,
        enumerable: true,
        value: this._toDebugger(value),
      };
    }
    const baseObject = Array.isArray(obj) ? '([])' : '({})';
    const debuggerObj = this._debuggee.executeInGlobal(baseObject).return;
    debuggerObj.defineProperties(properties);
    return debuggerObj;
  }

  _serialize(obj) {
    const result = this._debuggee.executeInGlobalWithBindings('stringify(e)', {e: obj, stringify: this._jsonStringifyObject});
    if (result.throw)
      throw new Error('Object is not serializable');
    return result.return === undefined ? undefined : JSON.parse(result.return);
  }

  disposeObject(objectId) {
    this._remoteObjects.delete(objectId);
  }

  getObjectProperties(objectId) {
    if (!this._remoteObjects.has(objectId))
      throw new Error('Cannot find object with id = ' + arg.objectId);
    const result = [];
    for (let obj = this._remoteObjects.get(objectId); obj; obj = obj.proto) {
      for (const propertyName of obj.getOwnPropertyNames()) {
        const descriptor = obj.getOwnPropertyDescriptor(propertyName);
        if (!descriptor.enumerable)
          continue;
        result.push({
          name: propertyName,
          value: this._createRemoteObject(descriptor.value),
        });
      }
    }
    return result;
  }

  _getResult(completionValue, exceptionDetails = {}) {
    if (!completionValue) {
      exceptionDetails.text = 'Evaluation terminated!';
      exceptionDetails.stack = '';
      return {success: false, obj: null};
    }
    if (completionValue.throw) {
      if (this._debuggee.executeInGlobalWithBindings('e instanceof Error', {e: completionValue.throw}).return) {
        exceptionDetails.text = this._debuggee.executeInGlobalWithBindings('e.message', {e: completionValue.throw}).return;
        exceptionDetails.stack = this._debuggee.executeInGlobalWithBindings('e.stack', {e: completionValue.throw}).return;
      } else {
        exceptionDetails.value = this._serialize(completionValue.throw);
      }
      return {success: false, obj: null};
    }
    return {success: true, obj: completionValue.return};
  }
}

const listenersSymbol = Symbol('listeners');

function createEvent() {
  const listeners = new Set();
  const subscribeFunction = listener => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }
  subscribeFunction[listenersSymbol] = listeners;
  return subscribeFunction;
}

function emitEvent(event, ...args) {
  let listeners = event[listenersSymbol];
  if (!listeners || !listeners.size)
    return;
  listeners = new Set(listeners);
  for (const listener of listeners)
    listener.call(null, ...args);
}

var EXPORTED_SYMBOLS = ['Runtime'];
this.Runtime = Runtime;
