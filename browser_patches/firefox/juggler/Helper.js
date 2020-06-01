/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const uuidGen = Cc["@mozilla.org/uuid-generator;1"].getService(Ci.nsIUUIDGenerator);
const {Services} = ChromeUtils.import("resource://gre/modules/Services.jsm");

class Helper {
  addObserver(handler, topic) {
    Services.obs.addObserver(handler, topic);
    return () => Services.obs.removeObserver(handler, topic);
  }

  addMessageListener(receiver, eventName, handler) {
    receiver.addMessageListener(eventName, handler);
    return () => receiver.removeMessageListener(eventName, handler);
  }

  addEventListener(receiver, eventName, handler) {
    receiver.addEventListener(eventName, handler);
    return () => receiver.removeEventListener(eventName, handler);
  }

  on(receiver, eventName, handler) {
    // The toolkit/modules/EventEmitter.jsm dispatches event name as a first argument.
    // Fire event listeners without it for convenience.
    const handlerWrapper = (_, ...args) => handler(...args);
    receiver.on(eventName, handlerWrapper);
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
}

var EXPORTED_SYMBOLS = [ "Helper" ];
this.Helper = Helper;

