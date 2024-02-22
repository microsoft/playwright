/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const uuidGen = Cc["@mozilla.org/uuid-generator;1"].getService(Ci.nsIUUIDGenerator);

class Helper {
  decorateAsEventEmitter(objectToDecorate) {
    const { EventEmitter } = ChromeUtils.import('resource://gre/modules/EventEmitter.jsm');
    const emitter = new EventEmitter();
    objectToDecorate.on = emitter.on.bind(emitter);
    objectToDecorate.addEventListener = emitter.on.bind(emitter);
    objectToDecorate.off = emitter.off.bind(emitter);
    objectToDecorate.removeEventListener = emitter.off.bind(emitter);
    objectToDecorate.once = emitter.once.bind(emitter);
    objectToDecorate.emit = emitter.emit.bind(emitter);
  }

  collectAllBrowsingContexts(rootBrowsingContext, allBrowsingContexts = []) {
    allBrowsingContexts.push(rootBrowsingContext);
    for (const child of rootBrowsingContext.children)
      this.collectAllBrowsingContexts(child, allBrowsingContexts);
    return allBrowsingContexts;
  }

  awaitTopic(topic) {
    return new Promise(resolve => {
      const listener = () => {
        Services.obs.removeObserver(listener, topic);
        resolve();
      }
      Services.obs.addObserver(listener, topic);
    });
  }

  toProtocolNavigationId(loadIdentifier) {
    return `nav-${loadIdentifier}`;
  }

  addObserver(handler, topic) {
    Services.obs.addObserver(handler, topic);
    return () => Services.obs.removeObserver(handler, topic);
  }

  addMessageListener(receiver, eventName, handler) {
    receiver.addMessageListener(eventName, handler);
    return () => receiver.removeMessageListener(eventName, handler);
  }

  addEventListener(receiver, eventName, handler, options) {
    receiver.addEventListener(eventName, handler, options);
    return () => {
      try {
        receiver.removeEventListener(eventName, handler, options);
      } catch (e) {
        // This could fail when window has navigated cross-process
        // and we remove the listener from WindowProxy.
        // Nothing we can do here - so ignore the error.
      }
    };
  }

  awaitEvent(receiver, eventName) {
    return new Promise(resolve => {
      receiver.addEventListener(eventName, function listener() {
        receiver.removeEventListener(eventName, listener);
        resolve();
      });
    });
  }

  on(receiver, eventName, handler, options) {
    // The toolkit/modules/EventEmitter.jsm dispatches event name as a first argument.
    // Fire event listeners without it for convenience.
    const handlerWrapper = (_, ...args) => handler(...args);
    receiver.on(eventName, handlerWrapper, options);
    return () => receiver.off(eventName, handlerWrapper);
  }

  addProgressListener(progress, listener, flags) {
    progress.addProgressListener(listener, flags);
    return () => progress.removeProgressListener(listener);
  }

  removeListeners(listeners) {
    for (const tearDown of listeners)
      tearDown.call(null);
    listeners.splice(0, listeners.length);
  }

  generateId() {
    const string = uuidGen.generateUUID().toString();
    return string.substring(1, string.length - 1);
  }

  getLoadContext(channel) {
    let loadContext = null;
    try {
      if (channel.notificationCallbacks)
        loadContext = channel.notificationCallbacks.getInterface(Ci.nsILoadContext);
    } catch (e) {}
    try {
      if (!loadContext && channel.loadGroup)
        loadContext = channel.loadGroup.notificationCallbacks.getInterface(Ci.nsILoadContext);
    } catch (e) { }
    return loadContext;
  }

  getNetworkErrorStatusText(status) {
    if (!status)
      return null;
    for (const key of Object.keys(Cr)) {
      if (Cr[key] === status)
        return key;
    }
    // Security module. The following is taken from
    // https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest/How_to_check_the_secruity_state_of_an_XMLHTTPRequest_over_SSL
    if ((status & 0xff0000) === 0x5a0000) {
      // NSS_SEC errors (happen below the base value because of negative vals)
      if ((status & 0xffff) < Math.abs(Ci.nsINSSErrorsService.NSS_SEC_ERROR_BASE)) {
        // The bases are actually negative, so in our positive numeric space, we
        // need to subtract the base off our value.
        const nssErr = Math.abs(Ci.nsINSSErrorsService.NSS_SEC_ERROR_BASE) - (status & 0xffff);
        switch (nssErr) {
          case 11:
            return 'SEC_ERROR_EXPIRED_CERTIFICATE';
          case 12:
            return 'SEC_ERROR_REVOKED_CERTIFICATE';
          case 13:
            return 'SEC_ERROR_UNKNOWN_ISSUER';
          case 20:
            return 'SEC_ERROR_UNTRUSTED_ISSUER';
          case 21:
            return 'SEC_ERROR_UNTRUSTED_CERT';
          case 36:
            return 'SEC_ERROR_CA_CERT_INVALID';
          case 90:
            return 'SEC_ERROR_INADEQUATE_KEY_USAGE';
          case 176:
            return 'SEC_ERROR_CERT_SIGNATURE_ALGORITHM_DISABLED';
          default:
            return 'SEC_ERROR_UNKNOWN';
        }
      }
      const sslErr = Math.abs(Ci.nsINSSErrorsService.NSS_SSL_ERROR_BASE) - (status & 0xffff);
      switch (sslErr) {
        case 3:
          return 'SSL_ERROR_NO_CERTIFICATE';
        case 4:
          return 'SSL_ERROR_BAD_CERTIFICATE';
        case 8:
          return 'SSL_ERROR_UNSUPPORTED_CERTIFICATE_TYPE';
        case 9:
          return 'SSL_ERROR_UNSUPPORTED_VERSION';
        case 12:
          return 'SSL_ERROR_BAD_CERT_DOMAIN';
        default:
          return 'SSL_ERROR_UNKNOWN';
      }
    }
    return '<unknown error>';
  }

  browsingContextToFrameId(browsingContext) {
    if (!browsingContext)
      return undefined;
    if (!browsingContext.parent)
      return 'mainframe-' + browsingContext.browserId;
    return 'subframe-' + browsingContext.id;
  }
}

const helper = new Helper();

class EventWatcher {
  constructor(receiver, eventNames, pendingEventWatchers = new Set()) {
    this._pendingEventWatchers = pendingEventWatchers;
    this._pendingEventWatchers.add(this);

    this._events = [];
    this._pendingPromises = [];
    this._eventListeners = eventNames.map(eventName =>
      helper.on(receiver, eventName, this._onEvent.bind(this, eventName)),
    );
  }

  _onEvent(eventName, eventObject) {
    this._events.push({eventName, eventObject});
    for (const promise of this._pendingPromises)
      promise.resolve();
    this._pendingPromises = [];
  }

  async ensureEvent(aEventName, predicate) {
    if (typeof aEventName !== 'string')
      throw new Error('ERROR: ensureEvent expects a "string" as its first argument');
    while (true) {
      const result = this.getEvent(aEventName, predicate);
      if (result)
        return result;
      await new Promise((resolve, reject) => this._pendingPromises.push({resolve, reject}));
    }
  }

  async ensureEvents(eventNames, predicate) {
    if (!Array.isArray(eventNames))
      throw new Error('ERROR: ensureEvents expects an array of event names as its first argument');
    return await Promise.all(eventNames.map(eventName => this.ensureEvent(eventName, predicate)));
  }

  async ensureEventsAndDispose(eventNames, predicate) {
    if (!Array.isArray(eventNames))
      throw new Error('ERROR: ensureEventsAndDispose expects an array of event names as its first argument');
    const result = await this.ensureEvents(eventNames, predicate);
    this.dispose();
    return result;
  }

  getEvent(aEventName, predicate = (eventObject) => true) {
    return this._events.find(({eventName, eventObject}) => eventName === aEventName && predicate(eventObject))?.eventObject;
  }

  hasEvent(aEventName, predicate) {
    return !!this.getEvent(aEventName, predicate);
  }

  dispose() {
    this._pendingEventWatchers.delete(this);
    for (const promise of this._pendingPromises)
      promise.reject(new Error('EventWatcher is being disposed'));
    this._pendingPromises = [];
    helper.removeListeners(this._eventListeners);
  }
}

var EXPORTED_SYMBOLS = [ "Helper", "EventWatcher" ];
this.Helper = Helper;
this.EventWatcher = EventWatcher;

