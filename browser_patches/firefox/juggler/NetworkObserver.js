/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const {EventEmitter} = ChromeUtils.import('resource://gre/modules/EventEmitter.jsm');
const {Helper} = ChromeUtils.import('chrome://juggler/content/Helper.js');
const {Services} = ChromeUtils.import("resource://gre/modules/Services.jsm");
const {NetUtil} = ChromeUtils.import('resource://gre/modules/NetUtil.jsm');


const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;
const Cr = Components.results;
const Cm = Components.manager;
const CC = Components.Constructor;
const helper = new Helper();

const UINT32_MAX = Math.pow(2, 32)-1;

const BinaryInputStream = CC('@mozilla.org/binaryinputstream;1', 'nsIBinaryInputStream', 'setInputStream');
const BinaryOutputStream = CC('@mozilla.org/binaryoutputstream;1', 'nsIBinaryOutputStream', 'setOutputStream');
const StorageStream = CC('@mozilla.org/storagestream;1', 'nsIStorageStream', 'init');

// Cap response storage with 100Mb per tracked tab.
const MAX_RESPONSE_STORAGE_SIZE = 100 * 1024 * 1024;

/**
 * This is a nsIChannelEventSink implementation that monitors channel redirects.
 */
const SINK_CLASS_DESCRIPTION = "Juggler NetworkMonitor Channel Event Sink";
const SINK_CLASS_ID = Components.ID("{c2b4c83e-607a-405a-beab-0ef5dbfb7617}");
const SINK_CONTRACT_ID = "@mozilla.org/network/monitor/channeleventsink;1";
const SINK_CATEGORY_NAME = "net-channel-event-sinks";

const pageNetworkSymbol = Symbol('PageNetwork');

class PageNetwork {
  static _forPageTarget(target) {
    let result = target[pageNetworkSymbol];
    if (!result) {
      result = new PageNetwork(target);
      target[pageNetworkSymbol] = result;
    }
    return result;
  }

  constructor(target) {
    EventEmitter.decorate(this);
    this._target = target;
    this._sessionCount = 0;
    this._extraHTTPHeaders = null;
    this._responseStorage = null;
    this._requestInterceptionEnabled = false;
    // This is requestId => NetworkRequest map, only contains requests that are
    // awaiting interception action (abort, resume, fulfill) over the protocol.
    this._interceptedRequests = new Map();
  }

  addSession() {
    if (this._sessionCount === 0)
      this._responseStorage = new ResponseStorage(MAX_RESPONSE_STORAGE_SIZE, MAX_RESPONSE_STORAGE_SIZE / 10);
    ++this._sessionCount;
    return () => this._stopTracking();
  }

  _stopTracking() {
    --this._sessionCount;
    if (this._sessionCount === 0) {
      this._extraHTTPHeaders = null;
      this._responseStorage = null;
      this._requestInterceptionEnabled = false;
      this._interceptedRequests.clear();
    }
  }

  _isActive() {
    return this._sessionCount > 0;
  }

  setExtraHTTPHeaders(headers) {
    this._extraHTTPHeaders = headers;
  }

  enableRequestInterception() {
    this._requestInterceptionEnabled = true;
  }

  disableRequestInterception() {
    this._requestInterceptionEnabled = false;
    for (const intercepted of this._interceptedRequests.values())
      intercepted.resume();
    this._interceptedRequests.clear();
  }

  resumeInterceptedRequest(requestId, method, headers, postData) {
    this._takeIntercepted(requestId).resume(method, headers, postData);
  }

  fulfillInterceptedRequest(requestId, status, statusText, headers, base64body) {
    this._takeIntercepted(requestId).fulfill(status, statusText, headers, base64body);
  }

  abortInterceptedRequest(requestId, errorCode) {
    this._takeIntercepted(requestId).abort(errorCode);
  }

  getResponseBody(requestId) {
    if (!this._responseStorage)
      throw new Error('Responses are not tracked for the given browser');
    return this._responseStorage.getBase64EncodedResponse(requestId);
  }

  _takeIntercepted(requestId) {
    const intercepted = this._interceptedRequests.get(requestId);
    if (!intercepted)
      throw new Error(`Cannot find request "${requestId}"`);
    this._interceptedRequests.delete(requestId);
    return intercepted;
  }
}

class NetworkRequest {
  constructor(networkObserver, httpChannel, redirectedFrom) {
    this._networkObserver = networkObserver;
    this.httpChannel = httpChannel;
    this._networkObserver._channelToRequest.set(this.httpChannel, this);

    this.requestId = httpChannel.channelId + '';
    this.navigationId = httpChannel.isMainDocumentChannel ? this.requestId : undefined;

    this._redirectedIndex = 0;
    if (redirectedFrom) {
      this.redirectedFromId = redirectedFrom.requestId;
      this._redirectedIndex = redirectedFrom._redirectedIndex + 1;
      this.requestId = this.requestId + '-redirect' + this._redirectedIndex;
      this.navigationId = redirectedFrom.navigationId;
      // Finish previous request now. Since we inherit the listener, we could in theory
      // use onStopRequest, but that will only happen after the last redirect has finished.
      redirectedFrom._sendOnRequestFinished();
    }

    this._maybeInactivePageNetwork = this._findPageNetwork();
    this._expectingInterception = false;
    this._expectingResumedRequest = undefined;  // { method, headers, postData }
    this._sentOnResponse = false;

    const pageNetwork = this._activePageNetwork();
    if (pageNetwork) {
      const browserContext = pageNetwork._target.browserContext();
      if (browserContext)
        appendExtraHTTPHeaders(httpChannel, browserContext.extraHTTPHeaders);
      appendExtraHTTPHeaders(httpChannel, pageNetwork._extraHTTPHeaders);
    }

    this._responseBodyChunks = [];

    httpChannel.QueryInterface(Ci.nsITraceableChannel);
    this._originalListener = httpChannel.setNewListener(this);
    if (redirectedFrom && this._originalListener === redirectedFrom) {
      // Listener is inherited for regular redirects, so we'd like to avoid
      // calling into previous NetworkRequest.
      this._originalListener = redirectedFrom._originalListener;
    }

    this._previousCallbacks = httpChannel.notificationCallbacks;
    httpChannel.notificationCallbacks = this;

    this.QueryInterface = ChromeUtils.generateQI([
      Ci.nsIAuthPrompt2,
      Ci.nsIAuthPromptProvider,
      Ci.nsIInterfaceRequestor,
      Ci.nsINetworkInterceptController,
      Ci.nsIStreamListener,
    ]);

    if (this.redirectedFromId) {
      // Redirects are not interceptable.
      this._sendOnRequest(false);
    }
  }

  // Public interception API.
  resume(method, headers, postData) {
    this._expectingResumedRequest = { method, headers, postData };
    this._interceptedChannel.resetInterception();
    this._interceptedChannel = undefined;
  }

  // Public interception API.
  abort(errorCode) {
    const error = errorMap[errorCode] || Cr.NS_ERROR_FAILURE;
    this._interceptedChannel.cancelInterception(error);
    this._interceptedChannel = undefined;
  }

  // Public interception API.
  fulfill(status, statusText, headers, base64body) {
    this._interceptedChannel.synthesizeStatus(status, statusText);
    for (const header of headers)
      this._interceptedChannel.synthesizeHeader(header.name, header.value);
    const synthesized = Cc["@mozilla.org/io/string-input-stream;1"].createInstance(Ci.nsIStringInputStream);
    const body = base64body ? atob(base64body) : '';
    synthesized.data = body;
    this._interceptedChannel.startSynthesizedResponse(synthesized, null, null, '', false);
    this._interceptedChannel.finishSynthesizedResponse();
    this._interceptedChannel = undefined;
  }

  // Instrumentation called by NetworkObserver.
  _onInternalRedirect(newChannel) {
    // Intercepted requests produce "internal redirects" - this is both for our own
    // interception and service workers.
    // An internal redirect has the same channelId, inherits notificationCallbacks and
    // listener, and should be used instead of an old channel.
    this._networkObserver._channelToRequest.delete(this.httpChannel);
    this.httpChannel = newChannel;
    this._networkObserver._channelToRequest.set(this.httpChannel, this);
  }

  // Instrumentation called by NetworkObserver.
  _onInternalRedirectReady() {
    // Resumed request is first internally redirected to a new request,
    // and then the new request is ready to be updated.
    if (!this._expectingResumedRequest)
      return;
    const { method, headers, postData } = this._expectingResumedRequest;
    this._expectingResumedRequest = undefined;

    if (headers) {
      for (const header of requestHeaders(this.httpChannel))
        this.httpChannel.setRequestHeader(header.name, '', false /* merge */);
      for (const header of headers)
        this.httpChannel.setRequestHeader(header.name, header.value, false /* merge */);
    }
    if (method)
      this.httpChannel.requestMethod = method;
    if (postData && this.httpChannel instanceof Ci.nsIUploadChannel2) {
      const synthesized = Cc["@mozilla.org/io/string-input-stream;1"].createInstance(Ci.nsIStringInputStream);
      const body = atob(postData);
      synthesized.setData(body, body.length);
      // Clear content-length, so that upload stream resets it.
      this.httpChannel.setRequestHeader('content-length', '', false /* merge */);
      this.httpChannel.explicitSetUploadStream(synthesized, 'application/octet-stream', -1, this.httpChannel.requestMethod, false);
    }
  }

  // Instrumentation called by NetworkObserver.
  _onResponse(fromCache) {
    this._sendOnResponse(fromCache);
  }

  // nsIInterfaceRequestor
  getInterface(iid) {
    if (iid.equals(Ci.nsIAuthPrompt2) || iid.equals(Ci.nsIAuthPromptProvider) || iid.equals(Ci.nsINetworkInterceptController))
      return this;
    if (iid.equals(Ci.nsIAuthPrompt))  // Block nsIAuthPrompt - we want nsIAuthPrompt2 to be used instead.
      throw Cr.NS_ERROR_NO_INTERFACE;
    if (this._previousCallbacks)
      return this._previousCallbacks.getInterface(iid);
    throw Cr.NS_ERROR_NO_INTERFACE;
  }

  // nsIAuthPromptProvider
  getAuthPrompt(aPromptReason, iid) {
    return this;
  }

  // nsIAuthPrompt2
  asyncPromptAuth(aChannel, aCallback, aContext, level, authInfo) {
    let canceled = false;
    Promise.resolve().then(() => {
      if (canceled)
        return;
      const hasAuth = this.promptAuth(aChannel, level, authInfo);
      if (hasAuth)
        aCallback.onAuthAvailable(aContext, authInfo);
      else
        aCallback.onAuthCancelled(aContext, true);
    });
    return {
      QueryInterface: ChromeUtils.generateQI([Ci.nsICancelable]),
      cancel: () => {
        aCallback.onAuthCancelled(aContext, false);
        canceled = true;
      }
    };
  }

  // nsIAuthPrompt2
  promptAuth(aChannel, level, authInfo) {
    if (authInfo.flags & Ci.nsIAuthInformation.PREVIOUS_FAILED)
      return false;
    const pageNetwork = this._activePageNetwork();
    if (!pageNetwork)
      return false;
    const browserContext = pageNetwork._target.browserContext();
    const credentials = browserContext ? browserContext.httpCredentials : undefined;
    if (!credentials)
      return false;
    authInfo.username = credentials.username;
    authInfo.password = credentials.password;
    // This will produce a new request with respective auth header set.
    // It will have the same id as ours. We expect it to arrive as new request and
    // will treat it as our own redirect.
    this._networkObserver._expectRedirect(this.httpChannel.channelId + '', this);
    return true;
  }

  // nsINetworkInterceptController
  shouldPrepareForIntercept(aURI, channel) {
    const interceptController = this._fallThroughInterceptController();
    if (interceptController && interceptController.shouldPrepareForIntercept(aURI, channel)) {
      // We assume that interceptController is a service worker if there is one,
      // and yield interception to it. We are not going to intercept ourselves,
      // so we send onRequest now.
      this._sendOnRequest(false);
      return true;
    }

    if (channel !== this.httpChannel) {
      // Not our channel? Just in case this happens, don't do anything.
      return false;
    }

    // We do not want to intercept any redirects, because we are not able
    // to intercept subresource redirects, and it's unreliable for main requests.
    // We do not sendOnRequest here, because redirects do that in constructor.
    if (this.redirectedFromId)
      return false;

    const shouldIntercept = this._shouldIntercept();
    if (!shouldIntercept) {
      // We are not intercepting - ready to issue onRequest.
      this._sendOnRequest(false);
      return false;
    }

    this._expectingInterception = true;
    return true;
  }

  // nsINetworkInterceptController
  channelIntercepted(intercepted) {
    if (!this._expectingInterception) {
      // We are not intercepting, fall-through.
      const interceptController = this._fallThroughInterceptController();
      if (interceptController)
        interceptController.channelIntercepted(intercepted);
      return;
    }

    this._expectingInterception = false;
    this._interceptedChannel = intercepted.QueryInterface(Ci.nsIInterceptedChannel);

    const pageNetwork = this._activePageNetwork();
    if (!pageNetwork) {
      // Just in case we disabled instrumentation while intercepting, resume and forget.
      this.resume();
      return;
    }

    const browserContext = pageNetwork._target.browserContext();
    if (browserContext && browserContext.settings.onlineOverride === 'offline') {
      // Implement offline.
      this.abort(Cr.NS_ERROR_OFFLINE);
      return;
    }

    // Ok, so now we have intercepted the request, let's issue onRequest.
    // If interception has been disabled while we were intercepting, resume and forget.
    const interceptionEnabled = this._shouldIntercept();
    this._sendOnRequest(!!interceptionEnabled);
    if (interceptionEnabled)
      pageNetwork._interceptedRequests.set(this.requestId, this);
    else
      this.resume();
  }

  // nsIStreamListener
  onDataAvailable(aRequest, aInputStream, aOffset, aCount) {
    // For requests with internal redirect (e.g. intercepted by Service Worker),
    // we do not get onResponse normally, but we do get nsIStreamListener notifications.
    this._sendOnResponse(false);

    const iStream = new BinaryInputStream(aInputStream);
    const sStream = new StorageStream(8192, aCount, null);
    const oStream = new BinaryOutputStream(sStream.getOutputStream(0));

    // Copy received data as they come.
    const data = iStream.readBytes(aCount);
    this._responseBodyChunks.push(data);

    oStream.writeBytes(data, aCount);
    try {
      this._originalListener.onDataAvailable(aRequest, sStream.newInputStream(0), aOffset, aCount);
    } catch (e) {
      // Be ready to original listener exceptions.
    }
  }

  // nsIStreamListener
  onStartRequest(aRequest) {
    try {
      this._originalListener.onStartRequest(aRequest);
    } catch (e) {
      // Be ready to original listener exceptions.
    }
  }

  // nsIStreamListener
  onStopRequest(aRequest, aStatusCode) {
    try {
      this._originalListener.onStopRequest(aRequest, aStatusCode);
    } catch (e) {
      // Be ready to original listener exceptions.
    }

    if (aStatusCode === 0) {
      // For requests with internal redirect (e.g. intercepted by Service Worker),
      // we do not get onResponse normally, but we do get nsIRequestObserver notifications.
      this._sendOnResponse(false);
      const body = this._responseBodyChunks.join('');
      const pageNetwork = this._activePageNetwork();
      if (pageNetwork)
        pageNetwork._responseStorage.addResponseBody(this, body);
      this._sendOnRequestFinished();
    } else {
      this._sendOnRequestFailed(aStatusCode);
    }

    delete this._responseBodyChunks;
  }

  _shouldIntercept() {
    const pageNetwork = this._activePageNetwork();
    if (!pageNetwork)
      return false;
    if (pageNetwork._requestInterceptionEnabled)
      return true;
    const browserContext = pageNetwork._target.browserContext();
    if (browserContext && browserContext.requestInterceptionEnabled)
      return true;
    if (browserContext && browserContext.settings.onlineOverride === 'offline')
      return true;
    return false;
  }

  _fallThroughInterceptController() {
    if (!this._previousCallbacks || !(this._previousCallbacks instanceof Ci.nsINetworkInterceptController))
      return undefined;
    return this._previousCallbacks.getInterface(Ci.nsINetworkInterceptController);
  }

  _activePageNetwork() {
    if (!this._maybeInactivePageNetwork || !this._maybeInactivePageNetwork._isActive())
      return undefined;
    return this._maybeInactivePageNetwork;
  }

  _findPageNetwork() {
    let loadContext = helper.getLoadContext(this.httpChannel);
    if (!loadContext)
      return;
    const target = this._networkObserver._targetRegistry.targetForBrowser(loadContext.topFrameElement);
    if (!target)
      return;
    return PageNetwork._forPageTarget(target);
  }

  _sendOnRequest(isIntercepted) {
    // Note: we call _sendOnRequest either after we intercepted the request,
    // or at the first moment we know that we are not going to intercept.
    const pageNetwork = this._activePageNetwork();
    if (!pageNetwork)
      return;
    const causeType = this.httpChannel.loadInfo ? this.httpChannel.loadInfo.externalContentPolicyType : Ci.nsIContentPolicy.TYPE_OTHER;
    const internalCauseType = this.httpChannel.loadInfo ? this.httpChannel.loadInfo.internalContentPolicyType : Ci.nsIContentPolicy.TYPE_OTHER;
    pageNetwork.emit(PageNetwork.Events.Request, {
      url: this.httpChannel.URI.spec,
      isIntercepted,
      requestId: this.requestId,
      redirectedFrom: this.redirectedFromId,
      postData: readRequestPostData(this.httpChannel),
      headers: requestHeaders(this.httpChannel),
      method: this.httpChannel.requestMethod,
      navigationId: this.navigationId,
      cause: causeTypeToString(causeType),
      internalCause: causeTypeToString(internalCauseType),
    }, this.httpChannel.channelId);
  }

  _sendOnResponse(fromCache) {
    if (this._sentOnResponse) {
      // We can come here twice because of internal redirects, e.g. service workers.
      return;
    }
    this._sentOnResponse = true;
    const pageNetwork = this._activePageNetwork();
    if (!pageNetwork)
      return;

    this.httpChannel.QueryInterface(Ci.nsIHttpChannelInternal);
    const headers = [];
    this.httpChannel.visitResponseHeaders({
      visitHeader: (name, value) => headers.push({name, value}),
    });

    let remoteIPAddress = undefined;
    let remotePort = undefined;
    try {
      remoteIPAddress = this.httpChannel.remoteAddress;
      remotePort = this.httpChannel.remotePort;
    } catch (e) {
      // remoteAddress is not defined for cached requests.
    }

    pageNetwork.emit(PageNetwork.Events.Response, {
      requestId: this.requestId,
      securityDetails: getSecurityDetails(this.httpChannel),
      fromCache,
      headers,
      remoteIPAddress,
      remotePort,
      status: this.httpChannel.responseStatus,
      statusText: this.httpChannel.responseStatusText,
    });
  }

  _sendOnRequestFailed(error) {
    const pageNetwork = this._activePageNetwork();
    if (pageNetwork) {
      pageNetwork.emit(PageNetwork.Events.RequestFailed, {
        requestId: this.requestId,
        errorCode: helper.getNetworkErrorStatusText(error),
      });
    }
    this._networkObserver._channelToRequest.delete(this.httpChannel);
  }

  _sendOnRequestFinished() {
    const pageNetwork = this._activePageNetwork();
    if (pageNetwork) {
      pageNetwork.emit(PageNetwork.Events.RequestFinished, {
        requestId: this.requestId,
      });
    }
    this._networkObserver._channelToRequest.delete(this.httpChannel);
  }
}

class NetworkObserver {
  static instance() {
    return NetworkObserver._instance || null;
  }

  constructor(targetRegistry) {
    EventEmitter.decorate(this);
    NetworkObserver._instance = this;

    this._targetRegistry = targetRegistry;

    this._channelToRequest = new Map();  // http channel -> network request
    this._expectedRedirect = new Map();  // expected redirect channel id (string) -> network request

    const protocolProxyService = Cc['@mozilla.org/network/protocol-proxy-service;1'].getService();
    this._channelProxyFilter = {
      QueryInterface: ChromeUtils.generateQI([Ci.nsIProtocolProxyChannelFilter]),
      applyFilter: (channel, defaultProxyInfo, proxyFilter) => {
        const originAttributes = channel.loadInfo && channel.loadInfo.originAttributes;
        const browserContext = originAttributes ? this._targetRegistry.browserContextForUserContextId(originAttributes.userContextId) : null;
        // Prefer context proxy and fallback to browser-level proxy.
        const proxy = (browserContext && browserContext.proxy()) || this._targetRegistry.browserProxy();
        if (!proxy) {
          proxyFilter.onProxyFilterResult(defaultProxyInfo);
          return;
        }
        if (proxy.bypass.some(domain => channel.URI.host.endsWith(domain))) {
          proxyFilter.onProxyFilterResult(defaultProxyInfo);
          return;
        }
        proxyFilter.onProxyFilterResult(protocolProxyService.newProxyInfo(
            proxy.type,
            proxy.host,
            proxy.port,
            '', /* aProxyAuthorizationHeader */
            '', /* aConnectionIsolationKey */
            0, /* aFlags */
            UINT32_MAX, /* aFailoverTimeout */
            null, /* failover proxy */
        ));
      },
    };
    protocolProxyService.registerChannelFilter(this._channelProxyFilter, 0 /* position */);

    this._channelSink = {
      QueryInterface: ChromeUtils.generateQI([Ci.nsIChannelEventSink]),
      asyncOnChannelRedirect: (oldChannel, newChannel, flags, callback) => {
        this._onRedirect(oldChannel, newChannel, flags);
        callback.onRedirectVerifyCallback(Cr.NS_OK);
      },
    };
    this._channelSinkFactory = {
      QueryInterface: ChromeUtils.generateQI([Ci.nsIFactory]),
      createInstance: (aOuter, aIID) => this._channelSink.QueryInterface(aIID),
    };
    // Register self as ChannelEventSink to track redirects.
    const registrar = Cm.QueryInterface(Ci.nsIComponentRegistrar);
    registrar.registerFactory(SINK_CLASS_ID, SINK_CLASS_DESCRIPTION, SINK_CONTRACT_ID, this._channelSinkFactory);
    Services.catMan.addCategoryEntry(SINK_CATEGORY_NAME, SINK_CONTRACT_ID, SINK_CONTRACT_ID, false, true);

    this._eventListeners = [
      helper.addObserver(this._onRequest.bind(this), 'http-on-modify-request'),
      helper.addObserver(this._onResponse.bind(this, false /* fromCache */), 'http-on-examine-response'),
      helper.addObserver(this._onResponse.bind(this, true /* fromCache */), 'http-on-examine-cached-response'),
      helper.addObserver(this._onResponse.bind(this, true /* fromCache */), 'http-on-examine-merged-response'),
    ];
  }

  _expectRedirect(channelId, previous) {
    this._expectedRedirect.set(channelId, previous);
  }

  _onRedirect(oldChannel, newChannel, flags) {
    if (!(oldChannel instanceof Ci.nsIHttpChannel) || !(newChannel instanceof Ci.nsIHttpChannel))
      return;
    const oldHttpChannel = oldChannel.QueryInterface(Ci.nsIHttpChannel);
    const newHttpChannel = newChannel.QueryInterface(Ci.nsIHttpChannel);
    if (!(flags & Ci.nsIChannelEventSink.REDIRECT_INTERNAL)) {
      const previous = this._channelToRequest.get(oldHttpChannel);
      if (previous)
        this._expectRedirect(newHttpChannel.channelId + '', previous);
    } else {
      const request = this._channelToRequest.get(oldHttpChannel);
      if (request)
        request._onInternalRedirect(newHttpChannel);
    }
  }

  pageNetworkForTarget(target) {
    return PageNetwork._forPageTarget(target);
  }

  _onRequest(channel, topic) {
    if (!(channel instanceof Ci.nsIHttpChannel))
      return;
    const httpChannel = channel.QueryInterface(Ci.nsIHttpChannel);
    const channelId = httpChannel.channelId + '';
    const redirectedFrom = this._expectedRedirect.get(channelId);
    if (redirectedFrom) {
      this._expectedRedirect.delete(channelId);
      new NetworkRequest(this, httpChannel, redirectedFrom);
    } else {
      const redirectedRequest = this._channelToRequest.get(httpChannel);
      if (redirectedRequest)
        redirectedRequest._onInternalRedirectReady();
      else
        new NetworkRequest(this, httpChannel);
    }
  }

  _onResponse(fromCache, httpChannel, topic) {
    const request = this._channelToRequest.get(httpChannel);
    if (request)
      request._onResponse(fromCache);
  }

  dispose() {
    this._activityDistributor.removeObserver(this);
    const registrar = Cm.QueryInterface(Ci.nsIComponentRegistrar);
    registrar.unregisterFactory(SINK_CLASS_ID, this._channelSinkFactory);
    Services.catMan.deleteCategoryEntry(SINK_CATEGORY_NAME, SINK_CONTRACT_ID, false);
    helper.removeListeners(this._eventListeners);
  }
}

const protocolVersionNames = {
  [Ci.nsITransportSecurityInfo.TLS_VERSION_1]: 'TLS 1',
  [Ci.nsITransportSecurityInfo.TLS_VERSION_1_1]: 'TLS 1.1',
  [Ci.nsITransportSecurityInfo.TLS_VERSION_1_2]: 'TLS 1.2',
  [Ci.nsITransportSecurityInfo.TLS_VERSION_1_3]: 'TLS 1.3',
};

function getSecurityDetails(httpChannel) {
  const securityInfo = httpChannel.securityInfo;
  if (!securityInfo)
    return null;
  securityInfo.QueryInterface(Ci.nsITransportSecurityInfo);
  if (!securityInfo.serverCert)
    return null;
  return {
    protocol: protocolVersionNames[securityInfo.protocolVersion] || '<unknown>',
    subjectName: securityInfo.serverCert.commonName,
    issuer: securityInfo.serverCert.issuerCommonName,
    // Convert to seconds.
    validFrom: securityInfo.serverCert.validity.notBefore / 1000 / 1000,
    validTo: securityInfo.serverCert.validity.notAfter / 1000 / 1000,
  };
}

function readRequestPostData(httpChannel) {
  if (!(httpChannel instanceof Ci.nsIUploadChannel))
    return undefined;
  const iStream = httpChannel.uploadStream;
  if (!iStream)
    return undefined;
  const isSeekableStream = iStream instanceof Ci.nsISeekableStream;

  let prevOffset;
  if (isSeekableStream) {
    prevOffset = iStream.tell();
    iStream.seek(Ci.nsISeekableStream.NS_SEEK_SET, 0);
  }

  // Read data from the stream.
  let result = undefined;
  try {
    const buffer = NetUtil.readInputStream(iStream, iStream.available());
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++)
        binary += String.fromCharCode(bytes[i]);
    result = btoa(binary);
  } catch (err) {
    result = '';
  }

  // Seek locks the file, so seek to the beginning only if necko hasn't
  // read it yet, since necko doesn't seek to 0 before reading (at lest
  // not till 459384 is fixed).
  if (isSeekableStream && prevOffset == 0)
    iStream.seek(Ci.nsISeekableStream.NS_SEEK_SET, 0);
  return result;
}

function requestHeaders(httpChannel) {
  const headers = [];
  httpChannel.visitRequestHeaders({
    visitHeader: (name, value) => headers.push({name, value}),
  });
  return headers;
}

function causeTypeToString(causeType) {
  for (let key in Ci.nsIContentPolicy) {
    if (Ci.nsIContentPolicy[key] === causeType)
      return key;
  }
  return 'TYPE_OTHER';
}

function appendExtraHTTPHeaders(httpChannel, headers) {
  if (!headers)
    return;
  for (const header of headers)
    httpChannel.setRequestHeader(header.name, header.value, false /* merge */);
}

class ResponseStorage {
  constructor(maxTotalSize, maxResponseSize) {
    this._totalSize = 0;
    this._maxResponseSize = maxResponseSize;
    this._maxTotalSize = maxTotalSize;
    this._responses = new Map();
  }

  addResponseBody(request, body) {
    if (body.length > this._maxResponseSize) {
      this._responses.set(requestId, {
        evicted: true,
        body: '',
      });
      return;
    }
    let encodings = [];
    if ((request.httpChannel instanceof Ci.nsIEncodedChannel) && request.httpChannel.contentEncodings && !request.httpChannel.applyConversion) {
      const encodingHeader = request.httpChannel.getResponseHeader("Content-Encoding");
      encodings = encodingHeader.split(/\s*\t*,\s*\t*/);
    }
    this._responses.set(request.requestId, {body, encodings});
    this._totalSize += body.length;
    if (this._totalSize > this._maxTotalSize) {
      for (let [requestId, response] of this._responses) {
        this._totalSize -= response.body.length;
        response.body = '';
        response.evicted = true;
        if (this._totalSize < this._maxTotalSize)
          break;
      }
    }
  }

  getBase64EncodedResponse(requestId) {
    const response = this._responses.get(requestId);
    if (!response)
      throw new Error(`Request "${requestId}" is not found`);
    if (response.evicted)
      return {base64body: '', evicted: true};
    let result = response.body;
    if (response.encodings && response.encodings.length) {
      for (const encoding of response.encodings)
        result = convertString(result, encoding, 'uncompressed');
    }
    return {base64body: btoa(result)};
  }
}

function convertString(s, source, dest) {
  const is = Cc["@mozilla.org/io/string-input-stream;1"].createInstance(
    Ci.nsIStringInputStream
  );
  is.setData(s, s.length);
  const listener = Cc["@mozilla.org/network/stream-loader;1"].createInstance(
    Ci.nsIStreamLoader
  );
  let result = [];
  listener.init({
    onStreamComplete: function onStreamComplete(
      loader,
      context,
      status,
      length,
      data
    ) {
      const array = Array.from(data);
      const kChunk = 100000;
      for (let i = 0; i < length; i += kChunk) {
        const len = Math.min(kChunk, length - i);
        const chunk = String.fromCharCode.apply(this, array.slice(i, i + len));
        result.push(chunk);
      }
    },
  });
  const converter = Cc["@mozilla.org/streamConverters;1"].getService(
    Ci.nsIStreamConverterService
  ).asyncConvertData(
    source,
    dest,
    listener,
    null
  );
  converter.onStartRequest(null, null);
  converter.onDataAvailable(null, is, 0, s.length);
  converter.onStopRequest(null, null, null);
  return result.join('');
}

const errorMap = {
  'aborted': Cr.NS_ERROR_ABORT,
  'accessdenied': Cr.NS_ERROR_PORT_ACCESS_NOT_ALLOWED,
  'addressunreachable': Cr.NS_ERROR_UNKNOWN_HOST,
  'blockedbyclient': Cr.NS_ERROR_FAILURE,
  'blockedbyresponse': Cr.NS_ERROR_FAILURE,
  'connectionaborted': Cr.NS_ERROR_NET_INTERRUPT,
  'connectionclosed': Cr.NS_ERROR_FAILURE,
  'connectionfailed': Cr.NS_ERROR_FAILURE,
  'connectionrefused': Cr.NS_ERROR_CONNECTION_REFUSED,
  'connectionreset': Cr.NS_ERROR_NET_RESET,
  'internetdisconnected': Cr.NS_ERROR_OFFLINE,
  'namenotresolved': Cr.NS_ERROR_UNKNOWN_HOST,
  'timedout': Cr.NS_ERROR_NET_TIMEOUT,
  'failed': Cr.NS_ERROR_FAILURE,
};

PageNetwork.Events = {
  Request: Symbol('PageNetwork.Events.Request'),
  Response: Symbol('PageNetwork.Events.Response'),
  RequestFinished: Symbol('PageNetwork.Events.RequestFinished'),
  RequestFailed: Symbol('PageNetwork.Events.RequestFailed'),
};

var EXPORTED_SYMBOLS = ['NetworkObserver', 'PageNetwork'];
this.NetworkObserver = NetworkObserver;
this.PageNetwork = PageNetwork;
