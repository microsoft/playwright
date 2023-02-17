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

import type { CRSession } from './crConnection';
import type { Page } from '../page';
import { helper } from '../helper';
import type { RegisteredListener } from '../../utils/eventsHelper';
import { eventsHelper } from '../../utils/eventsHelper';
import type { Protocol } from './protocol';
import * as network from '../network';
import type * as contexts from '../browserContext';
import type * as frames from '../frames';
import type * as types from '../types';
import type { CRPage } from './crPage';
import { assert, headersObjectToArray } from '../../utils';
import type { CRServiceWorker } from './crServiceWorker';

export class CRNetworkManager {
  private _client: CRSession;
  private _page: Page | null;
  private _serviceWorker: CRServiceWorker | null;
  private _parentManager: CRNetworkManager | null;
  private _requestIdToRequest = new Map<string, InterceptableRequest>();
  private _requestIdToRequestWillBeSentEvent = new Map<string, Protocol.Network.requestWillBeSentPayload>();
  private _credentials: {username: string, password: string} | null = null;
  private _attemptedAuthentications = new Set<string>();
  private _userRequestInterceptionEnabled = false;
  private _protocolRequestInterceptionEnabled = false;
  private _requestIdToRequestPausedEvent = new Map<string, Protocol.Fetch.requestPausedPayload>();
  private _eventListeners: RegisteredListener[];
  private _responseExtraInfoTracker = new ResponseExtraInfoTracker();

  constructor(client: CRSession, page: Page | null, serviceWorker: CRServiceWorker | null, parentManager: CRNetworkManager | null) {
    this._client = client;
    this._page = page;
    this._serviceWorker = serviceWorker;
    this._parentManager = parentManager;
    this._eventListeners = this.instrumentNetworkEvents(client);
  }

  instrumentNetworkEvents(session: CRSession, workerFrame?: frames.Frame): RegisteredListener[] {
    const listeners = [
      eventsHelper.addEventListener(session, 'Fetch.requestPaused', this._onRequestPaused.bind(this, workerFrame)),
      eventsHelper.addEventListener(session, 'Fetch.authRequired', this._onAuthRequired.bind(this)),
      eventsHelper.addEventListener(session, 'Network.requestWillBeSent', this._onRequestWillBeSent.bind(this, workerFrame)),
      eventsHelper.addEventListener(session, 'Network.requestWillBeSentExtraInfo', this._onRequestWillBeSentExtraInfo.bind(this)),
      eventsHelper.addEventListener(session, 'Network.requestServedFromCache', this._onRequestServedFromCache.bind(this)),
      eventsHelper.addEventListener(session, 'Network.responseReceived', this._onResponseReceived.bind(this)),
      eventsHelper.addEventListener(session, 'Network.responseReceivedExtraInfo', this._onResponseReceivedExtraInfo.bind(this)),
      eventsHelper.addEventListener(session, 'Network.loadingFinished', this._onLoadingFinished.bind(this)),
      eventsHelper.addEventListener(session, 'Network.loadingFailed', this._onLoadingFailed.bind(this, workerFrame)),
    ];
    if (this._page) {
      listeners.push(...[
        eventsHelper.addEventListener(session, 'Network.webSocketCreated', e => this._page!._frameManager.onWebSocketCreated(e.requestId, e.url)),
        eventsHelper.addEventListener(session, 'Network.webSocketWillSendHandshakeRequest', e => this._page!._frameManager.onWebSocketRequest(e.requestId)),
        eventsHelper.addEventListener(session, 'Network.webSocketHandshakeResponseReceived', e => this._page!._frameManager.onWebSocketResponse(e.requestId, e.response.status, e.response.statusText)),
        eventsHelper.addEventListener(session, 'Network.webSocketFrameSent', e => e.response.payloadData && this._page!._frameManager.onWebSocketFrameSent(e.requestId, e.response.opcode, e.response.payloadData)),
        eventsHelper.addEventListener(session, 'Network.webSocketFrameReceived', e => e.response.payloadData && this._page!._frameManager.webSocketFrameReceived(e.requestId, e.response.opcode, e.response.payloadData)),
        eventsHelper.addEventListener(session, 'Network.webSocketClosed', e => this._page!._frameManager.webSocketClosed(e.requestId)),
        eventsHelper.addEventListener(session, 'Network.webSocketFrameError', e => this._page!._frameManager.webSocketError(e.requestId, e.errorMessage)),
      ]);
    }
    return listeners;
  }

  async initialize() {
    await this._client.send('Network.enable');
  }

  dispose() {
    eventsHelper.removeEventListeners(this._eventListeners);
  }

  async authenticate(credentials: types.Credentials | null) {
    this._credentials = credentials;
    await this._updateProtocolRequestInterception();
  }

  async setOffline(offline: boolean) {
    await this._client.send('Network.emulateNetworkConditions', {
      offline,
      // values of 0 remove any active throttling. crbug.com/456324#c9
      latency: 0,
      downloadThroughput: -1,
      uploadThroughput: -1
    });
  }

  async setRequestInterception(value: boolean) {
    this._userRequestInterceptionEnabled = value;
    await this._updateProtocolRequestInterception();
  }

  async _updateProtocolRequestInterception() {
    const enabled = this._userRequestInterceptionEnabled || !!this._credentials;
    if (enabled === this._protocolRequestInterceptionEnabled)
      return;
    this._protocolRequestInterceptionEnabled = enabled;
    if (enabled) {
      await Promise.all([
        this._client.send('Network.setCacheDisabled', { cacheDisabled: true }),
        this._client.send('Fetch.enable', {
          handleAuthRequests: true,
          patterns: [{ urlPattern: '*', requestStage: 'Request' }],
        }),
      ]);
    } else {
      await Promise.all([
        this._client.send('Network.setCacheDisabled', { cacheDisabled: false }),
        this._client.send('Fetch.disable')
      ]);
    }
  }

  _onRequestWillBeSent(workerFrame: frames.Frame | undefined, event: Protocol.Network.requestWillBeSentPayload) {
    // Request interception doesn't happen for data URLs with Network Service.
    if (this._protocolRequestInterceptionEnabled && !event.request.url.startsWith('data:')) {
      const requestId = event.requestId;
      const requestPausedEvent = this._requestIdToRequestPausedEvent.get(requestId);
      if (requestPausedEvent) {
        this._onRequest(workerFrame, event, requestPausedEvent);
        this._requestIdToRequestPausedEvent.delete(requestId);
      } else {
        this._requestIdToRequestWillBeSentEvent.set(event.requestId, event);
      }
    } else {
      this._onRequest(workerFrame, event, null);
    }
  }

  _onRequestServedFromCache(event: Protocol.Network.requestServedFromCachePayload) {
    this._responseExtraInfoTracker.requestServedFromCache(event);
  }

  _onRequestWillBeSentExtraInfo(event: Protocol.Network.requestWillBeSentExtraInfoPayload) {
    this._responseExtraInfoTracker.requestWillBeSentExtraInfo(event);
  }

  _onAuthRequired(event: Protocol.Fetch.authRequiredPayload) {
    let response: 'Default' | 'CancelAuth' | 'ProvideCredentials' = 'Default';
    if (this._attemptedAuthentications.has(event.requestId)) {
      response = 'CancelAuth';
    } else if (this._credentials) {
      response = 'ProvideCredentials';
      this._attemptedAuthentications.add(event.requestId);
    }
    const { username, password } = this._credentials || { username: undefined, password: undefined };
    this._client._sendMayFail('Fetch.continueWithAuth', {
      requestId: event.requestId,
      authChallengeResponse: { response, username, password },
    });
  }

  _onRequestPaused(workerFrame: frames.Frame | undefined, event: Protocol.Fetch.requestPausedPayload) {
    if (!event.networkId) {
      // Fetch without networkId means that request was not recongnized by inspector, and
      // it will never receive Network.requestWillBeSent. Most likely, this is an internal request
      // that we can safely fail.
      this._client._sendMayFail('Fetch.failRequest', {
        requestId: event.requestId,
        errorReason: 'Aborted',
      });
      return;
    }
    if (event.request.url.startsWith('data:'))
      return;

    const requestId = event.networkId;
    const requestWillBeSentEvent = this._requestIdToRequestWillBeSentEvent.get(requestId);
    if (requestWillBeSentEvent) {
      this._onRequest(workerFrame, requestWillBeSentEvent, event);
      this._requestIdToRequestWillBeSentEvent.delete(requestId);
    } else {
      this._requestIdToRequestPausedEvent.set(requestId, event);
    }
  }

  _onRequest(workerFrame: frames.Frame | undefined, requestWillBeSentEvent: Protocol.Network.requestWillBeSentPayload, requestPausedEvent: Protocol.Fetch.requestPausedPayload | null) {
    if (requestWillBeSentEvent.request.url.startsWith('data:'))
      return;
    let redirectedFrom: InterceptableRequest | null = null;
    if (requestWillBeSentEvent.redirectResponse) {
      const request = this._requestIdToRequest.get(requestWillBeSentEvent.requestId);
      // If we connect late to the target, we could have missed the requestWillBeSent event.
      if (request) {
        this._handleRequestRedirect(request, requestWillBeSentEvent.redirectResponse, requestWillBeSentEvent.timestamp, requestWillBeSentEvent.redirectHasExtraInfo);
        redirectedFrom = request;
      }
    }
    let frame = requestWillBeSentEvent.frameId ? this._page?._frameManager.frame(requestWillBeSentEvent.frameId) : workerFrame;
    // Requests from workers lack frameId, because we receive Network.requestWillBeSent
    // on the worker target. However, we receive Fetch.requestPaused on the page target,
    // and lack workerFrame there. Luckily, Fetch.requestPaused provides a frameId.
    if (!frame && this._page && requestPausedEvent && requestPausedEvent.frameId)
      frame = this._page._frameManager.frame(requestPausedEvent.frameId);

    // Check if it's main resource request interception (targetId === main frame id).
    if (!frame && this._page && requestWillBeSentEvent.frameId === (this._page?._delegate as CRPage)._targetId) {
      // Main resource request for the page is being intercepted so the Frame is not created
      // yet. Precreate it here for the purposes of request interception. It will be updated
      // later as soon as the request continues and we receive frame tree from the page.
      frame = this._page._frameManager.frameAttached(requestWillBeSentEvent.frameId, null);
    }

    // CORS options preflight request is generated by the network stack. If interception is enabled,
    // we accept all CORS options, assuming that this was intended when setting route.
    //
    // Note: it would be better to match the URL against interception patterns.
    const isInterceptedOptionsPreflight = !!requestPausedEvent && requestPausedEvent.request.method === 'OPTIONS' && requestWillBeSentEvent.initiator.type === 'preflight';
    if (isInterceptedOptionsPreflight && (this._page || this._serviceWorker)!.needsRequestInterception()) {
      const requestHeaders = requestPausedEvent.request.headers;
      const responseHeaders: Protocol.Fetch.HeaderEntry[] = [
        { name: 'Access-Control-Allow-Origin', value: requestHeaders['Origin'] || '*' },
        { name: 'Access-Control-Allow-Methods', value: requestHeaders['Access-Control-Request-Method'] || 'GET, POST, OPTIONS, DELETE' },
        { name: 'Access-Control-Allow-Credentials', value: 'true' }
      ];
      if (requestHeaders['Access-Control-Request-Headers'])
        responseHeaders.push({ name: 'Access-Control-Allow-Headers', value: requestHeaders['Access-Control-Request-Headers'] });
      this._client._sendMayFail('Fetch.fulfillRequest', {
        requestId: requestPausedEvent.requestId,
        responseCode: 204,
        responsePhrase: network.STATUS_TEXTS['204'],
        responseHeaders,
        body: '',
      });
      return;
    }

    // Non-service-worker requests MUST have a frame—if they don't, we pretend there was no request
    if (!frame && !this._serviceWorker) {
      if (requestPausedEvent)
        this._client._sendMayFail('Fetch.continueRequest', { requestId: requestPausedEvent.requestId });
      return;
    }

    let route = null;
    if (requestPausedEvent) {
      // We do not support intercepting redirects.
      if (redirectedFrom || (!this._userRequestInterceptionEnabled && this._protocolRequestInterceptionEnabled))
        this._client._sendMayFail('Fetch.continueRequest', { requestId: requestPausedEvent.requestId });
      else
        route = new RouteImpl(this._client, requestPausedEvent.requestId);
    }
    const isNavigationRequest = requestWillBeSentEvent.requestId === requestWillBeSentEvent.loaderId && requestWillBeSentEvent.type === 'Document';
    const documentId = isNavigationRequest ? requestWillBeSentEvent.loaderId : undefined;
    const request = new InterceptableRequest({
      context: (this._page || this._serviceWorker)!._browserContext,
      frame: frame || null,
      serviceWorker: this._serviceWorker || null,
      documentId,
      route,
      requestWillBeSentEvent,
      requestPausedEvent,
      redirectedFrom
    });
    this._requestIdToRequest.set(requestWillBeSentEvent.requestId, request);

    if (requestPausedEvent && !requestPausedEvent.responseStatusCode && !requestPausedEvent.responseErrorReason) {
      // We will not receive extra info when intercepting the request.
      // Use the headers from the Fetch.requestPausedPayload and release the allHeaders()
      // right away, so that client can call it from the route handler.
      request.request.setRawRequestHeaders(headersObjectToArray(requestPausedEvent.request.headers, '\n'));
    }
    (this._page?._frameManager || this._serviceWorker)!.requestStarted(request.request, route || undefined);
  }

  _createResponse(request: InterceptableRequest, responsePayload: Protocol.Network.Response, hasExtraInfo: boolean): network.Response {
    const getResponseBody = async () => {
      const contentLengthHeader = Object.entries(responsePayload.headers).find(header => header[0].toLowerCase() === 'content-length');
      const expectedLength = contentLengthHeader ? +contentLengthHeader[1] : undefined;

      const response = await this._client.send('Network.getResponseBody', { requestId: request._requestId });
      if (response.body || !expectedLength)
        return Buffer.from(response.body, response.base64Encoded ? 'base64' : 'utf8');

      // For <link prefetch we are going to receive empty body with non-emtpy content-length expectation. Reach out for the actual content.
      const resource = await this._client.send('Network.loadNetworkResource', { url: request.request.url(), frameId: this._serviceWorker ? undefined : request.request.frame()!._id, options: { disableCache: false, includeCredentials: true } });
      const chunks: Buffer[] = [];
      while (resource.resource.stream) {
        const chunk = await this._client.send('IO.read', { handle: resource.resource.stream });
        chunks.push(Buffer.from(chunk.data, chunk.base64Encoded ? 'base64' : 'utf-8'));
        if (chunk.eof) {
          await this._client.send('IO.close', { handle: resource.resource.stream });
          break;
        }
      }
      return Buffer.concat(chunks);
    };
    const timingPayload = responsePayload.timing!;
    let timing: network.ResourceTiming;
    if (timingPayload && !this._responseExtraInfoTracker.servedFromCache(request._requestId)) {
      timing = {
        startTime: (timingPayload.requestTime - request._timestamp + request._wallTime) * 1000,
        domainLookupStart: timingPayload.dnsStart,
        domainLookupEnd: timingPayload.dnsEnd,
        connectStart: timingPayload.connectStart,
        secureConnectionStart: timingPayload.sslStart,
        connectEnd: timingPayload.connectEnd,
        requestStart: timingPayload.sendStart,
        responseStart: timingPayload.receiveHeadersEnd,
      };
    } else {
      timing = {
        startTime: request._wallTime * 1000,
        domainLookupStart: -1,
        domainLookupEnd: -1,
        connectStart: -1,
        secureConnectionStart: -1,
        connectEnd: -1,
        requestStart: -1,
        responseStart: -1,
      };
    }
    const response = new network.Response(request.request, responsePayload.status, responsePayload.statusText, headersObjectToArray(responsePayload.headers), timing, getResponseBody, !!responsePayload.fromServiceWorker, responsePayload.protocol);
    if (responsePayload?.remoteIPAddress && typeof responsePayload?.remotePort === 'number') {
      response._serverAddrFinished({
        ipAddress: responsePayload.remoteIPAddress,
        port: responsePayload.remotePort,
      });
    } else {
      response._serverAddrFinished();
    }
    response._securityDetailsFinished({
      protocol: responsePayload?.securityDetails?.protocol,
      subjectName: responsePayload?.securityDetails?.subjectName,
      issuer: responsePayload?.securityDetails?.issuer,
      validFrom: responsePayload?.securityDetails?.validFrom,
      validTo: responsePayload?.securityDetails?.validTo,
    });
    this._responseExtraInfoTracker.processResponse(request._requestId, response, hasExtraInfo);
    return response;
  }

  _handleRequestRedirect(request: InterceptableRequest, responsePayload: Protocol.Network.Response, timestamp: number, hasExtraInfo: boolean) {
    const response = this._createResponse(request, responsePayload, hasExtraInfo);
    response.setTransferSize(null);
    response.setEncodedBodySize(null);
    response._requestFinished((timestamp - request._timestamp) * 1000);
    this._requestIdToRequest.delete(request._requestId);
    if (request._interceptionId)
      this._attemptedAuthentications.delete(request._interceptionId);
    (this._page?._frameManager || this._serviceWorker)!.requestReceivedResponse(response);
    (this._page?._frameManager || this._serviceWorker)!.reportRequestFinished(request.request, response);
  }

  _onResponseReceivedExtraInfo(event: Protocol.Network.responseReceivedExtraInfoPayload) {
    this._responseExtraInfoTracker.responseReceivedExtraInfo(event);
  }

  _onResponseReceived(event: Protocol.Network.responseReceivedPayload) {
    let request = this._requestIdToRequest.get(event.requestId);
    // For frame-level Requests that are handled by a Service Worker's fetch handler, we'll never get a requestPaused event, so we need to
    // manually create the request. In an ideal world, crNetworkManager would be able to know this on Network.requestWillBeSent, but there
    // is not enough metadata there.
    //
    // PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS we guard with, since this would fix an old bug where, when using routing,
    // request would not be emitted to the user for requests made by a page with a SW (and fetch handler) registered
    if (!!process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS && !request && event.response.fromServiceWorker) {
      const requestWillBeSentEvent = this._requestIdToRequestWillBeSentEvent.get(event.requestId);
      const frame = requestWillBeSentEvent?.frameId ? this._page?._frameManager.frame(requestWillBeSentEvent.frameId) : null;
      if (requestWillBeSentEvent && frame) {
        this._onRequest(frame, requestWillBeSentEvent, null /* requestPausedPayload */);
        request = this._requestIdToRequest.get(event.requestId);
        this._requestIdToRequestWillBeSentEvent.delete(event.requestId);
      }
    }
    // FileUpload sends a response without a matching request.
    if (!request)
      return;
    const response = this._createResponse(request, event.response, event.hasExtraInfo);
    (this._page?._frameManager || this._serviceWorker)!.requestReceivedResponse(response);
  }

  _onLoadingFinished(event: Protocol.Network.loadingFinishedPayload) {
    this._responseExtraInfoTracker.loadingFinished(event);

    let request = this._requestIdToRequest.get(event.requestId);
    if (!request)
      request = this._maybeAdoptMainRequest(event.requestId);
    // For certain requestIds we never receive requestWillBeSent event.
    // @see https://crbug.com/750469
    if (!request)
      return;

    // Under certain conditions we never get the Network.responseReceived
    // event from protocol. @see https://crbug.com/883475
    const response = request.request._existingResponse();
    if (response) {
      response.setTransferSize(event.encodedDataLength);
      response.responseHeadersSize().then(size => response.setEncodedBodySize(event.encodedDataLength - size));
      response._requestFinished(helper.secondsToRoundishMillis(event.timestamp - request._timestamp));
    }
    this._requestIdToRequest.delete(request._requestId);
    if (request._interceptionId)
      this._attemptedAuthentications.delete(request._interceptionId);
    (this._page?._frameManager || this._serviceWorker)!.reportRequestFinished(request.request, response);
  }

  _onLoadingFailed(workerFrame: frames.Frame | undefined, event: Protocol.Network.loadingFailedPayload) {
    this._responseExtraInfoTracker.loadingFailed(event);

    let request = this._requestIdToRequest.get(event.requestId);
    if (!request)
      request = this._maybeAdoptMainRequest(event.requestId);

    if (!request) {
      const requestWillBeSentEvent = this._requestIdToRequestWillBeSentEvent.get(event.requestId);
      if (requestWillBeSentEvent) {
        // This is a case where request has failed before we had a chance to intercept it.
        // We stop waiting for Fetch.requestPaused (it might never come), and dispatch request event
        // right away, followed by requestfailed event.
        this._requestIdToRequestWillBeSentEvent.delete(event.requestId);
        this._onRequest(workerFrame, requestWillBeSentEvent, null);
        request = this._requestIdToRequest.get(event.requestId);
      }
    }

    // For certain requestIds we never receive requestWillBeSent event.
    // @see https://crbug.com/750469
    if (!request)
      return;
    const response = request.request._existingResponse();
    if (response) {
      response.setTransferSize(null);
      response.setEncodedBodySize(null);
      response._requestFinished(helper.secondsToRoundishMillis(event.timestamp - request._timestamp));
    }
    this._requestIdToRequest.delete(request._requestId);
    if (request._interceptionId)
      this._attemptedAuthentications.delete(request._interceptionId);
    request.request._setFailureText(event.errorText);
    (this._page?._frameManager || this._serviceWorker)!.requestFailed(request.request, !!event.canceled);
  }

  private _maybeAdoptMainRequest(requestId: Protocol.Network.RequestId): InterceptableRequest | undefined {
    // OOPIF has a main request that starts in the parent session but finishes in the child session.
    if (!this._parentManager)
      return;
    const request = this._parentManager._requestIdToRequest.get(requestId);
    // Main requests have matching loaderId and requestId.
    if (!request || request._documentId !== requestId)
      return;
    this._requestIdToRequest.set(requestId, request);
    this._parentManager._requestIdToRequest.delete(requestId);
    if (request._interceptionId && this._parentManager._attemptedAuthentications.has(request._interceptionId)) {
      this._parentManager._attemptedAuthentications.delete(request._interceptionId);
      this._attemptedAuthentications.add(request._interceptionId);
    }
    return request;
  }
}

class InterceptableRequest {
  readonly request: network.Request;
  readonly _requestId: string;
  readonly _interceptionId: string | null;
  readonly _documentId: string | undefined;
  readonly _timestamp: number;
  readonly _wallTime: number;
  private _route: RouteImpl | null;
  private _redirectedFrom: InterceptableRequest | null;

  constructor(options: {
    context: contexts.BrowserContext;
    frame: frames.Frame | null;
    serviceWorker: CRServiceWorker | null;
    documentId?: string;
    route: RouteImpl | null;
    requestWillBeSentEvent: Protocol.Network.requestWillBeSentPayload;
    requestPausedEvent: Protocol.Fetch.requestPausedPayload | null;
    redirectedFrom: InterceptableRequest | null;
  }) {
    const { context, frame, documentId, route, requestWillBeSentEvent, requestPausedEvent, redirectedFrom, serviceWorker } = options;
    this._timestamp = requestWillBeSentEvent.timestamp;
    this._wallTime = requestWillBeSentEvent.wallTime;
    this._requestId = requestWillBeSentEvent.requestId;
    this._interceptionId = requestPausedEvent && requestPausedEvent.requestId;
    this._documentId = documentId;
    this._route = route;
    this._redirectedFrom = redirectedFrom;

    const {
      headers,
      method,
      url,
      postDataEntries = null,
    } = requestPausedEvent ? requestPausedEvent.request : requestWillBeSentEvent.request;
    const type = (requestWillBeSentEvent.type || '').toLowerCase();
    let postDataBuffer = null;
    if (postDataEntries && postDataEntries.length && postDataEntries[0].bytes)
      postDataBuffer = Buffer.from(postDataEntries[0].bytes, 'base64');

    this.request = new network.Request(context, frame, serviceWorker, redirectedFrom?.request || null, documentId, url, type, method, postDataBuffer, headersObjectToArray(headers));
  }

  _routeForRedirectChain(): RouteImpl | null {
    let request: InterceptableRequest = this;
    while (request._redirectedFrom)
      request = request._redirectedFrom;
    return request._route;
  }
}

class RouteImpl implements network.RouteDelegate {
  private readonly _client: CRSession;
  private _interceptionId: string;

  constructor(client: CRSession, interceptionId: string) {
    this._client = client;
    this._interceptionId = interceptionId;
  }

  async continue(request: network.Request, overrides: types.NormalizedContinueOverrides): Promise<void> {
    // In certain cases, protocol will return error if the request was already canceled
    // or the page was closed. We should tolerate these errors.
    await this._client._sendMayFail('Fetch.continueRequest', {
      requestId: this._interceptionId!,
      url: overrides.url,
      headers: overrides.headers,
      method: overrides.method,
      postData: overrides.postData ? overrides.postData.toString('base64') : undefined
    });
  }

  async fulfill(response: types.NormalizedFulfillResponse) {
    const body = response.isBase64 ? response.body : Buffer.from(response.body).toString('base64');

    const responseHeaders = splitSetCookieHeader(response.headers);
    // In certain cases, protocol will return error if the request was already canceled
    // or the page was closed. We should tolerate these errors.
    await this._client._sendMayFail('Fetch.fulfillRequest', {
      requestId: this._interceptionId!,
      responseCode: response.status,
      responsePhrase: network.STATUS_TEXTS[String(response.status)],
      responseHeaders,
      body,
    });
  }

  async abort(errorCode: string = 'failed') {
    const errorReason = errorReasons[errorCode];
    assert(errorReason, 'Unknown error code: ' + errorCode);
    // In certain cases, protocol will return error if the request was already canceled
    // or the page was closed. We should tolerate these errors.
    await this._client._sendMayFail('Fetch.failRequest', {
      requestId: this._interceptionId!,
      errorReason
    });
  }
}

function splitSetCookieHeader(headers: types.HeadersArray): types.HeadersArray {
  const index = headers.findIndex(({ name }) => name.toLowerCase() === 'set-cookie');
  if (index === -1)
    return headers;

  const header = headers[index];
  const values = header.value.split('\n');
  if (values.length === 1)
    return headers;
  const result = headers.slice();
  result.splice(index, 1, ...values.map(value => ({ name: header.name, value })));
  return result;
}

const errorReasons: { [reason: string]: Protocol.Network.ErrorReason } = {
  'aborted': 'Aborted',
  'accessdenied': 'AccessDenied',
  'addressunreachable': 'AddressUnreachable',
  'blockedbyclient': 'BlockedByClient',
  'blockedbyresponse': 'BlockedByResponse',
  'connectionaborted': 'ConnectionAborted',
  'connectionclosed': 'ConnectionClosed',
  'connectionfailed': 'ConnectionFailed',
  'connectionrefused': 'ConnectionRefused',
  'connectionreset': 'ConnectionReset',
  'internetdisconnected': 'InternetDisconnected',
  'namenotresolved': 'NameNotResolved',
  'timedout': 'TimedOut',
  'failed': 'Failed',
};

type RequestInfo = {
  requestId: string,
  // Events are replaced with "undefined" to avoid updating the same headers twice.
  requestWillBeSentExtraInfo: (Protocol.Network.requestWillBeSentExtraInfoPayload | undefined)[],
  responseReceivedExtraInfo: (Protocol.Network.responseReceivedExtraInfoPayload | undefined)[],
  // Note: we only put the responses that expect extra info in this list.
  // Since the order of responses and extraInfo events is the same, each response
  // will get a pair of matching request/response extraInfo events in this list.
  responses: network.Response[],
  loadingFinished?: Protocol.Network.loadingFinishedPayload,
  loadingFailed?: Protocol.Network.loadingFailedPayload,
  servedFromCache?: boolean,
};

// This class aligns responses with response headers from extra info:
//   - Network.requestWillBeSent, Network.responseReceived, Network.loadingFinished/loadingFailed are
//     dispatched using one channel.
//   - Network.requestWillBeSentExtraInfo and Network.responseReceivedExtraInfo are dispatched on
//     another channel. Those channels are not associated, so events come in random order.
//
// This class will associate responses with the new headers. These extra info headers will become
// available to client reliably upon requestfinished event only. It consumes CDP
// signals on one end and processResponse(network.Response) signals on the other hands. It then makes
// sure that responses have all the extra headers in place by the time request finishes.
//
// The shape of the instrumentation API is deliberately following the CDP, so that it
// is clear what is called when and what this means to the tracker without extra
// documentation.
class ResponseExtraInfoTracker {
  private _requests = new Map<string, RequestInfo>();

  requestWillBeSentExtraInfo(event: Protocol.Network.requestWillBeSentExtraInfoPayload) {
    const info = this._getOrCreateEntry(event.requestId);
    info.requestWillBeSentExtraInfo.push(event);
    this._patchHeaders(info, info.requestWillBeSentExtraInfo.length - 1);
    this._checkFinished(info);
  }

  requestServedFromCache(event: Protocol.Network.requestServedFromCachePayload) {
    const info = this._getOrCreateEntry(event.requestId);
    info.servedFromCache = true;
  }

  servedFromCache(requestId: string): boolean {
    const info = this._requests.get(requestId);
    return !!info?.servedFromCache;
  }

  responseReceivedExtraInfo(event: Protocol.Network.responseReceivedExtraInfoPayload) {
    const info = this._getOrCreateEntry(event.requestId);
    info.responseReceivedExtraInfo.push(event);
    this._patchHeaders(info, info.responseReceivedExtraInfo.length - 1);
    this._checkFinished(info);
  }

  processResponse(requestId: string, response: network.Response, hasExtraInfo: boolean) {
    let info = this._requests.get(requestId);
    // Cached responses have erroneous "hasExtraInfo" flag.
    // https://bugs.chromium.org/p/chromium/issues/detail?id=1340398
    if (!hasExtraInfo || info?.servedFromCache) {
      // Use "provisional" headers as "raw" ones.
      response.request().setRawRequestHeaders(null);
      response.setResponseHeadersSize(null);
      response.setRawResponseHeaders(null);
      return;
    }

    info = this._getOrCreateEntry(requestId);
    info.responses.push(response);
    this._patchHeaders(info, info.responses.length - 1);
  }

  loadingFinished(event: Protocol.Network.loadingFinishedPayload) {
    const info = this._requests.get(event.requestId);
    if (!info)
      return;
    info.loadingFinished = event;
    this._checkFinished(info);
  }

  loadingFailed(event: Protocol.Network.loadingFailedPayload) {
    const info = this._requests.get(event.requestId);
    if (!info)
      return;
    info.loadingFailed = event;
    this._checkFinished(info);
  }

  _getOrCreateEntry(requestId: string): RequestInfo {
    let info = this._requests.get(requestId);
    if (!info) {
      info = {
        requestId: requestId,
        requestWillBeSentExtraInfo: [],
        responseReceivedExtraInfo: [],
        responses: [],
      };
      this._requests.set(requestId, info);
    }
    return info;
  }

  private _patchHeaders(info: RequestInfo, index: number) {
    const response = info.responses[index];
    const requestExtraInfo = info.requestWillBeSentExtraInfo[index];
    if (response && requestExtraInfo) {
      response.request().setRawRequestHeaders(headersObjectToArray(requestExtraInfo.headers, '\n'));
      info.requestWillBeSentExtraInfo[index] = undefined;
    }
    const responseExtraInfo = info.responseReceivedExtraInfo[index];
    if (response && responseExtraInfo) {
      response.setResponseHeadersSize(responseExtraInfo.headersText?.length || 0);
      response.setRawResponseHeaders(headersObjectToArray(responseExtraInfo.headers, '\n'));
      info.responseReceivedExtraInfo[index] = undefined;
    }
  }

  private _checkFinished(info: RequestInfo) {
    if (!info.loadingFinished && !info.loadingFailed)
      return;

    if (info.responses.length <= info.responseReceivedExtraInfo.length) {
      // We have extra info for each response.
      this._stopTracking(info.requestId);
      return;
    }

    // We are not done yet.
  }

  private _stopTracking(requestId: string) {
    this._requests.delete(requestId);
  }
}
