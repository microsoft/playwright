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

import { CRSession } from './crConnection';
import { Page } from '../page';
import { helper, RegisteredListener } from '../helper';
import { Protocol } from './protocol';
import * as network from '../network';
import * as frames from '../frames';
import * as types from '../types';
import { CRPage } from './crPage';
import { assert, headersObjectToArray } from '../../utils/utils';

export class CRNetworkManager {
  private _client: CRSession;
  private _page: Page;
  private _parentManager: CRNetworkManager | null;
  private _requestIdToRequest = new Map<string, InterceptableRequest>();
  private _requestIdToRequestWillBeSentEvent = new Map<string, Protocol.Network.requestWillBeSentPayload>();
  private _credentials: {username: string, password: string} | null = null;
  private _attemptedAuthentications = new Set<string>();
  private _userRequestInterceptionEnabled = false;
  private _protocolRequestInterceptionEnabled = false;
  private _requestIdToRequestPausedEvent = new Map<string, Protocol.Fetch.requestPausedPayload>();
  private _eventListeners: RegisteredListener[];
  private _requestIdToExtraInfo = new Map<string, Protocol.Network.requestWillBeSentExtraInfoPayload>();

  constructor(client: CRSession, page: Page, parentManager: CRNetworkManager | null) {
    this._client = client;
    this._page = page;
    this._parentManager = parentManager;
    this._eventListeners = this.instrumentNetworkEvents(client);
  }

  instrumentNetworkEvents(session: CRSession, workerFrame?: frames.Frame): RegisteredListener[] {
    return [
      helper.addEventListener(session, 'Fetch.requestPaused', this._onRequestPaused.bind(this, workerFrame)),
      helper.addEventListener(session, 'Fetch.authRequired', this._onAuthRequired.bind(this)),
      helper.addEventListener(session, 'Network.requestWillBeSent', this._onRequestWillBeSent.bind(this, workerFrame)),
      helper.addEventListener(session, 'Network.requestWillBeSentExtraInfo', this._onRequestWillBeSentExtraInfo.bind(this)),
      helper.addEventListener(session, 'Network.responseReceived', this._onResponseReceived.bind(this)),
      helper.addEventListener(session, 'Network.loadingFinished', this._onLoadingFinished.bind(this)),
      helper.addEventListener(session, 'Network.loadingFailed', this._onLoadingFailed.bind(this)),
      helper.addEventListener(session, 'Network.webSocketCreated', e => this._page._frameManager.onWebSocketCreated(e.requestId, e.url)),
      helper.addEventListener(session, 'Network.webSocketWillSendHandshakeRequest', e => this._page._frameManager.onWebSocketRequest(e.requestId)),
      helper.addEventListener(session, 'Network.webSocketHandshakeResponseReceived', e => this._page._frameManager.onWebSocketResponse(e.requestId, e.response.status, e.response.statusText)),
      helper.addEventListener(session, 'Network.webSocketFrameSent', e => e.response.payloadData && this._page._frameManager.onWebSocketFrameSent(e.requestId, e.response.opcode, e.response.payloadData)),
      helper.addEventListener(session, 'Network.webSocketFrameReceived', e => e.response.payloadData && this._page._frameManager.webSocketFrameReceived(e.requestId, e.response.opcode, e.response.payloadData)),
      helper.addEventListener(session, 'Network.webSocketClosed', e => this._page._frameManager.webSocketClosed(e.requestId)),
      helper.addEventListener(session, 'Network.webSocketFrameError', e => this._page._frameManager.webSocketError(e.requestId, e.errorMessage)),
    ];
  }

  async initialize() {
    await this._client.send('Network.enable');
  }

  dispose() {
    helper.removeEventListeners(this._eventListeners);
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
          patterns: [{urlPattern: '*'}],
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
    const extraInfo = this._requestIdToExtraInfo.get(event.requestId);
    if (extraInfo)
      this._onRequestWillBeSentExtraInfo(extraInfo);
  }

  _onRequestWillBeSentExtraInfo(event: Protocol.Network.requestWillBeSentExtraInfoPayload) {
    const request = this._requestIdToRequest.get(event.requestId);
    if (request) {
      request.request.updateWithRawHeaders(headersObjectToArray(event.headers));
      this._requestIdToExtraInfo.delete(event.requestId);
    } else {
      this._requestIdToExtraInfo.set(event.requestId, event);
    }
  }

  _onAuthRequired(event: Protocol.Fetch.authRequiredPayload) {
    let response: 'Default' | 'CancelAuth' | 'ProvideCredentials' = 'Default';
    if (this._attemptedAuthentications.has(event.requestId)) {
      response = 'CancelAuth';
    } else if (this._credentials) {
      response = 'ProvideCredentials';
      this._attemptedAuthentications.add(event.requestId);
    }
    const {username, password} = this._credentials || {username: undefined, password: undefined};
    this._client._sendMayFail('Fetch.continueWithAuth', {
      requestId: event.requestId,
      authChallengeResponse: { response, username, password },
    });
  }

  _onRequestPaused(workerFrame: frames.Frame | undefined, event: Protocol.Fetch.requestPausedPayload) {
    if (!this._userRequestInterceptionEnabled && this._protocolRequestInterceptionEnabled) {
      this._client._sendMayFail('Fetch.continueRequest', {
        requestId: event.requestId
      });
    }
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
    let redirectedFrom: network.Request | null = null;
    if (requestWillBeSentEvent.redirectResponse) {
      const request = this._requestIdToRequest.get(requestWillBeSentEvent.requestId);
      // If we connect late to the target, we could have missed the requestWillBeSent event.
      if (request) {
        this._handleRequestRedirect(request, requestWillBeSentEvent.redirectResponse, requestWillBeSentEvent.timestamp);
        redirectedFrom = request.request;
      }
    }
    let frame = requestWillBeSentEvent.frameId ? this._page._frameManager.frame(requestWillBeSentEvent.frameId) : workerFrame;
    // Requests from workers lack frameId, because we receive Network.requestWillBeSent
    // on the worker target. However, we receive Fetch.requestPaused on the page target,
    // and lack workerFrame there. Luckily, Fetch.requestPaused provides a frameId.
    if (!frame && requestPausedEvent && requestPausedEvent.frameId)
      frame = this._page._frameManager.frame(requestPausedEvent.frameId);

    // Check if it's main resource request interception (targetId === main frame id).
    if (!frame && requestWillBeSentEvent.frameId === (this._page._delegate as CRPage)._targetId) {
      // Main resource request for the page is being intercepted so the Frame is not created
      // yet. Precreate it here for the purposes of request interception. It will be updated
      // later as soon as the request continues and we receive frame tree from the page.
      frame = this._page._frameManager.frameAttached(requestWillBeSentEvent.frameId, null);
    }

    // CORS options request is generated by the network stack. If interception is enabled,
    // we accept all CORS options, assuming that this was intended when setting route.
    //
    // Note: it would be better to match the URL against interception patterns, but
    // that information is only available to the client. Perhaps we can just route to the client?
    if (requestPausedEvent && requestPausedEvent.request.method === 'OPTIONS' && this._page._needsRequestInterception()) {
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

    if (!frame) {
      if (requestPausedEvent)
        this._client._sendMayFail('Fetch.continueRequest', { requestId: requestPausedEvent.requestId });
      return;
    }

    let allowInterception = this._userRequestInterceptionEnabled;
    if (redirectedFrom) {
      allowInterception = false;
      // We do not support intercepting redirects.
      if (requestPausedEvent)
        this._client._sendMayFail('Fetch.continueRequest', { requestId: requestPausedEvent.requestId });
    }
    const isNavigationRequest = requestWillBeSentEvent.requestId === requestWillBeSentEvent.loaderId && requestWillBeSentEvent.type === 'Document';
    const documentId = isNavigationRequest ? requestWillBeSentEvent.loaderId : undefined;
    const request = new InterceptableRequest({
      client: this._client,
      frame,
      documentId,
      allowInterception,
      requestWillBeSentEvent,
      requestPausedEvent,
      redirectedFrom
    });
    this._requestIdToRequest.set(requestWillBeSentEvent.requestId, request);
    this._page._frameManager.requestStarted(request.request);
  }

  _createResponse(request: InterceptableRequest, responsePayload: Protocol.Network.Response): network.Response {
    const getResponseBody = async () => {
      const response = await this._client.send('Network.getResponseBody', { requestId: request._requestId });
      return Buffer.from(response.body, response.base64Encoded ? 'base64' : 'utf8');
    };
    const timingPayload = responsePayload.timing!;
    let timing: network.ResourceTiming;
    if (timingPayload) {
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
    const response = new network.Response(request.request, responsePayload.status, responsePayload.statusText, headersObjectToArray(responsePayload.headers), timing, getResponseBody);
    if (responsePayload?.remoteIPAddress && typeof responsePayload?.remotePort === 'number')
      response._serverAddrFinished({
        ipAddress: responsePayload.remoteIPAddress,
        port: responsePayload.remotePort,
      });
    else
      response._serverAddrFinished();
    response._securityDetailsFinished({
      protocol: responsePayload?.securityDetails?.protocol,
      subjectName: responsePayload?.securityDetails?.subjectName,
      issuer: responsePayload?.securityDetails?.issuer,
      validFrom: responsePayload?.securityDetails?.validFrom,
      validTo: responsePayload?.securityDetails?.validTo,
    });
    return response;
  }

  _handleRequestRedirect(request: InterceptableRequest, responsePayload: Protocol.Network.Response, timestamp: number) {
    const response = this._createResponse(request, responsePayload);
    response._requestFinished((timestamp - request._timestamp) * 1000, 'Response body is unavailable for redirect responses');
    this._requestIdToRequest.delete(request._requestId);
    if (request._interceptionId)
      this._attemptedAuthentications.delete(request._interceptionId);
    this._page._frameManager.requestReceivedResponse(response);
    this._page._frameManager.requestFinished(request.request);
  }

  _onResponseReceived(event: Protocol.Network.responseReceivedPayload) {
    const request = this._requestIdToRequest.get(event.requestId);
    // FileUpload sends a response without a matching request.
    if (!request)
      return;
    const response = this._createResponse(request, event.response);
    this._page._frameManager.requestReceivedResponse(response);
  }

  _onLoadingFinished(event: Protocol.Network.loadingFinishedPayload) {
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
    if (response)
      response._requestFinished(helper.secondsToRoundishMillis(event.timestamp - request._timestamp));
    this._requestIdToRequest.delete(request._requestId);
    if (request._interceptionId)
      this._attemptedAuthentications.delete(request._interceptionId);
    this._page._frameManager.requestFinished(request.request);
  }

  _onLoadingFailed(event: Protocol.Network.loadingFailedPayload) {
    let request = this._requestIdToRequest.get(event.requestId);
    if (!request)
      request = this._maybeAdoptMainRequest(event.requestId);
    // For certain requestIds we never receive requestWillBeSent event.
    // @see https://crbug.com/750469
    if (!request)
      return;
    const response = request.request._existingResponse();
    if (response)
      response._requestFinished(helper.secondsToRoundishMillis(event.timestamp - request._timestamp));
    this._requestIdToRequest.delete(request._requestId);
    if (request._interceptionId)
      this._attemptedAuthentications.delete(request._interceptionId);
    request.request._setFailureText(event.errorText);
    this._page._frameManager.requestFailed(request.request, !!event.canceled);
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

class InterceptableRequest implements network.RouteDelegate {
  readonly request: network.Request;
  _requestId: string;
  _interceptionId: string | null;
  _documentId: string | undefined;
  private _client: CRSession;
  _timestamp: number;
  _wallTime: number;

  constructor(options: {
    client: CRSession;
    frame: frames.Frame;
    documentId?: string;
    allowInterception: boolean;
    requestWillBeSentEvent: Protocol.Network.requestWillBeSentPayload;
    requestPausedEvent: Protocol.Fetch.requestPausedPayload | null;
    redirectedFrom: network.Request | null;
  }) {
    const { client, frame, documentId, allowInterception, requestWillBeSentEvent, requestPausedEvent, redirectedFrom } = options;
    this._client = client;
    this._timestamp = requestWillBeSentEvent.timestamp;
    this._wallTime = requestWillBeSentEvent.wallTime;
    this._requestId = requestWillBeSentEvent.requestId;
    this._interceptionId = requestPausedEvent && requestPausedEvent.requestId;
    this._documentId = documentId;

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

    this.request = new network.Request(allowInterception ? this : null, frame, redirectedFrom, documentId, url, type, method, postDataBuffer, headersObjectToArray(headers));
  }

  async continue(overrides: types.NormalizedContinueOverrides) {
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

    // In certain cases, protocol will return error if the request was already canceled
    // or the page was closed. We should tolerate these errors.
    await this._client._sendMayFail('Fetch.fulfillRequest', {
      requestId: this._interceptionId!,
      responseCode: response.status,
      responsePhrase: network.STATUS_TEXTS[String(response.status)],
      responseHeaders: response.headers,
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
