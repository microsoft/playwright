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
import { assert, debugError, helper, RegisteredListener } from '../helper';
import { Protocol } from './protocol';
import * as network from '../network';
import * as frames from '../frames';
import * as platform from '../platform';
import { Credentials } from '../types';

export class CRNetworkManager {
  private _client: CRSession;
  private _page: Page;
  private _requestIdToRequest = new Map<string, InterceptableRequest>();
  private _requestIdToRequestWillBeSentEvent = new Map<string, Protocol.Network.requestWillBeSentPayload>();
  private _credentials: {username: string, password: string} | null = null;
  private _attemptedAuthentications = new Set<string>();
  private _protocolRequestInterceptionEnabled = false;
  private _requestIdToInterceptionId = new Map<string, string>();
  private _eventListeners: RegisteredListener[];

  constructor(client: CRSession, page: Page) {
    this._client = client;
    this._page = page;
    this._eventListeners = this.instrumentNetworkEvents(client);
  }

  instrumentNetworkEvents(session: CRSession): RegisteredListener[] {
    return [
      helper.addEventListener(session, 'Fetch.requestPaused', this._onRequestPaused.bind(this)),
      helper.addEventListener(session, 'Fetch.authRequired', this._onAuthRequired.bind(this)),
      helper.addEventListener(session, 'Network.requestWillBeSent', this._onRequestWillBeSent.bind(this)),
      helper.addEventListener(session, 'Network.responseReceived', this._onResponseReceived.bind(this)),
      helper.addEventListener(session, 'Network.loadingFinished', this._onLoadingFinished.bind(this)),
      helper.addEventListener(session, 'Network.loadingFailed', this._onLoadingFailed.bind(this)),
      helper.addEventListener(session, 'Network.webSocketCreated', e => this._page._frameManager.onWebSocketCreated(e.requestId, e.url)),
      helper.addEventListener(session, 'Network.webSocketWillSendHandshakeRequest', e => this._page._frameManager.onWebSocketRequest(e.requestId, e.request.headers)),
      helper.addEventListener(session, 'Network.webSocketHandshakeResponseReceived', e => this._page._frameManager.onWebSocketResponse(e.requestId, e.response.status, e.response.statusText, e.response.headers)),
      helper.addEventListener(session, 'Network.webSocketFrameSent', e => e.response.payloadData && this._page._frameManager.onWebSocketFrameSent(e.requestId, e.response.opcode, e.response.payloadData)),
      helper.addEventListener(session, 'Network.webSocketFrameReceived', e => e.response.payloadData && this._page._frameManager.webSocketFrameReceived(e.requestId, e.response.opcode, e.response.payloadData)),
      helper.addEventListener(session, 'Network.webSocketClosed', e => this._page._frameManager.webSocketClosed(e.requestId)),
      helper.addEventListener(session, 'Network.webSocketFrameError', e => this._page._frameManager.webSocketError(e.requestId, e.errorMessage)),
    ];
  }

  async initialize() {
    const promises: Promise<any>[] = [
      this._client.send('Network.enable')
    ];
    const options = this._page.browserContext()._options;
    if (options.offlineMode)
      promises.push(this.setOfflineMode(options.offlineMode));
    if (this._userRequestInterceptionEnabled())
      promises.push(this._updateProtocolRequestInterception());
    else if (options.cacheEnabled === false)
      promises.push(this._updateProtocolCacheDisabled());
    await Promise.all(promises);
  }

  dispose() {
    helper.removeEventListeners(this._eventListeners);
  }

  async authenticate(credentials: Credentials | null) {
    this._credentials = credentials;
    await this._updateProtocolRequestInterception();
  }

  async setOfflineMode(offline: boolean) {
    await this._client.send('Network.emulateNetworkConditions', {
      offline,
      // values of 0 remove any active throttling. crbug.com/456324#c9
      latency: 0,
      downloadThroughput: -1,
      uploadThroughput: -1
    });
  }

  async setUserAgent(userAgent: string) {
    await this._client.send('Network.setUserAgentOverride', { userAgent });
  }

  async setCacheEnabled(enabled: boolean) {
    await this._updateProtocolCacheDisabled();
  }

  async setRequestInterception(value: boolean) {
    await this._updateProtocolRequestInterception();
  }

  private _userRequestInterceptionEnabled() : boolean {
    return !!this._page.browserContext()._options.interceptNetwork;
  }

  private async _updateProtocolRequestInterception() {
    const enabled = this._userRequestInterceptionEnabled() || !!this._credentials;
    if (enabled === this._protocolRequestInterceptionEnabled)
      return;
    this._protocolRequestInterceptionEnabled = enabled;
    if (enabled) {
      await Promise.all([
        this._updateProtocolCacheDisabled(),
        this._client.send('Fetch.enable', {
          handleAuthRequests: true,
          patterns: [{urlPattern: '*'}],
        }),
      ]);
    } else {
      await Promise.all([
        this._updateProtocolCacheDisabled(),
        this._client.send('Fetch.disable')
      ]);
    }
  }

  private async _updateProtocolCacheDisabled() {
    const options = this._page.browserContext()._options;
    const cacheDisabled = options.cacheEnabled === false;
    await this._client.send('Network.setCacheDisabled', {
      cacheDisabled: cacheDisabled || this._protocolRequestInterceptionEnabled
    });
  }

  private _onRequestWillBeSent(event: Protocol.Network.requestWillBeSentPayload) {
    // Request interception doesn't happen for data URLs with Network Service.
    if (this._protocolRequestInterceptionEnabled && !event.request.url.startsWith('data:')) {
      const requestId = event.requestId;
      const interceptionId = this._requestIdToInterceptionId.get(requestId);
      if (interceptionId) {
        this._onRequest(event, interceptionId);
        this._requestIdToInterceptionId.delete(requestId);
      } else {
        this._requestIdToRequestWillBeSentEvent.set(event.requestId, event);
      }
      return;
    }
    this._onRequest(event, null);
  }

  private _onAuthRequired(event: Protocol.Fetch.authRequiredPayload) {
    let response: 'Default' | 'CancelAuth' | 'ProvideCredentials' = 'Default';
    if (this._attemptedAuthentications.has(event.requestId)) {
      response = 'CancelAuth';
    } else if (this._credentials) {
      response = 'ProvideCredentials';
      this._attemptedAuthentications.add(event.requestId);
    }
    const {username, password} = this._credentials || {username: undefined, password: undefined};
    this._client.send('Fetch.continueWithAuth', {
      requestId: event.requestId,
      authChallengeResponse: { response, username, password },
    }).catch(debugError);
  }

  private _onRequestPaused(event: Protocol.Fetch.requestPausedPayload) {
    if (!this._userRequestInterceptionEnabled() && this._protocolRequestInterceptionEnabled) {
      this._client.send('Fetch.continueRequest', {
        requestId: event.requestId
      }).catch(debugError);
    }
    if (!event.networkId || event.request.url.startsWith('data:'))
      return;

    const requestId = event.networkId;
    const interceptionId = event.requestId;
    const requestWillBeSentEvent = this._requestIdToRequestWillBeSentEvent.get(requestId);
    if (requestWillBeSentEvent) {
      this._onRequest(requestWillBeSentEvent, interceptionId);
      this._requestIdToRequestWillBeSentEvent.delete(requestId);
    } else {
      this._requestIdToInterceptionId.set(requestId, interceptionId);
    }
  }

  private _onRequest(event: Protocol.Network.requestWillBeSentPayload, interceptionId: string | null) {
    if (event.request.url.startsWith('data:'))
      return;
    let redirectChain: network.Request[] = [];
    if (event.redirectResponse) {
      const request = this._requestIdToRequest.get(event.requestId);
      // If we connect late to the target, we could have missed the requestWillBeSent event.
      if (request) {
        this._handleRequestRedirect(request, event.redirectResponse);
        redirectChain = request.request._redirectChain;
      }
    }
    // TODO: how can frame be null here?
    const frame = event.frameId ? this._page._frameManager.frame(event.frameId) : null;
    const isNavigationRequest = event.requestId === event.loaderId && event.type === 'Document';
    const documentId = isNavigationRequest ? event.loaderId : undefined;
    const request = new InterceptableRequest(this._client, frame, interceptionId, documentId, this._userRequestInterceptionEnabled(), event, redirectChain);
    this._requestIdToRequest.set(event.requestId, request);
    this._page._frameManager.requestStarted(request.request);
  }

  private _createResponse(request: InterceptableRequest, responsePayload: Protocol.Network.Response): network.Response {
    const getResponseBody = async () => {
      const response = await this._client.send('Network.getResponseBody', { requestId: request._requestId });
      return platform.Buffer.from(response.body, response.base64Encoded ? 'base64' : 'utf8');
    };
    return new network.Response(request.request, responsePayload.status, responsePayload.statusText, headersObject(responsePayload.headers), getResponseBody);
  }

  private _handleRequestRedirect(request: InterceptableRequest, responsePayload: Protocol.Network.Response) {
    const response = this._createResponse(request, responsePayload);
    request.request._redirectChain.push(request.request);
    response._requestFinished(new Error('Response body is unavailable for redirect responses'));
    this._requestIdToRequest.delete(request._requestId);
    if (request._interceptionId)
      this._attemptedAuthentications.delete(request._interceptionId);
    this._page._frameManager.requestReceivedResponse(response);
    this._page._frameManager.requestFinished(request.request);
  }

  private _onResponseReceived(event: Protocol.Network.responseReceivedPayload) {
    const request = this._requestIdToRequest.get(event.requestId);
    // FileUpload sends a response without a matching request.
    if (!request)
      return;
    const response = this._createResponse(request, event.response);
    this._page._frameManager.requestReceivedResponse(response);
  }

  private _onLoadingFinished(event: Protocol.Network.loadingFinishedPayload) {
    const request = this._requestIdToRequest.get(event.requestId);
    // For certain requestIds we never receive requestWillBeSent event.
    // @see https://crbug.com/750469
    if (!request)
      return;

    // Under certain conditions we never get the Network.responseReceived
    // event from protocol. @see https://crbug.com/883475
    const response = request.request.response();
    if (response)
      response._requestFinished();
    this._requestIdToRequest.delete(request._requestId);
    if (request._interceptionId)
      this._attemptedAuthentications.delete(request._interceptionId);
    this._page._frameManager.requestFinished(request.request);
  }

  private _onLoadingFailed(event: Protocol.Network.loadingFailedPayload) {
    const request = this._requestIdToRequest.get(event.requestId);
    // For certain requestIds we never receive requestWillBeSent event.
    // @see https://crbug.com/750469
    if (!request)
      return;
    const response = request.request.response();
    if (response)
      response._requestFinished();
    this._requestIdToRequest.delete(request._requestId);
    if (request._interceptionId)
      this._attemptedAuthentications.delete(request._interceptionId);
    request.request._setFailureText(event.errorText);
    this._page._frameManager.requestFailed(request.request, !!event.canceled);
  }
}

class InterceptableRequest implements network.RequestDelegate {
  readonly request: network.Request;
  _requestId: string;
  _interceptionId: string | null;
  _documentId: string | undefined;
  private _client: CRSession;

  constructor(client: CRSession, frame: frames.Frame | null, interceptionId: string | null, documentId: string | undefined, allowInterception: boolean, event: Protocol.Network.requestWillBeSentPayload, redirectChain: network.Request[]) {
    this._client = client;
    this._requestId = event.requestId;
    this._interceptionId = interceptionId;
    this._documentId = documentId;

    this.request = new network.Request(allowInterception ? this : null, frame, redirectChain, documentId,
        event.request.url, (event.type || '').toLowerCase(), event.request.method, event.request.postData, headersObject(event.request.headers));
  }

  async continue(overrides: { method?: string; headers?: network.Headers; postData?: string } = {}) {
    await this._client.send('Fetch.continueRequest', {
      requestId: this._interceptionId!,
      headers: overrides.headers ? headersArray(overrides.headers) : undefined,
      method: overrides.method,
      postData: overrides.postData
    }).catch(error => {
      // In certain cases, protocol will return error if the request was already canceled
      // or the page was closed. We should tolerate these errors.
      debugError(error);
    });
  }

  async fulfill(response: { status: number; headers: network.Headers; contentType: string; body: (string | platform.BufferType); }) {
    const responseBody = response.body && helper.isString(response.body) ? platform.Buffer.from(response.body) : (response.body || null);

    const responseHeaders: { [s: string]: string; } = {};
    if (response.headers) {
      for (const header of Object.keys(response.headers))
        responseHeaders[header.toLowerCase()] = response.headers[header];
    }
    if (response.contentType)
      responseHeaders['content-type'] = response.contentType;
    if (responseBody && !('content-length' in responseHeaders))
      responseHeaders['content-length'] = String(platform.Buffer.byteLength(responseBody));

    await this._client.send('Fetch.fulfillRequest', {
      requestId: this._interceptionId!,
      responseCode: response.status || 200,
      responsePhrase: network.STATUS_TEXTS[String(response.status || 200)],
      responseHeaders: headersArray(responseHeaders),
      body: responseBody ? responseBody.toString('base64') : undefined,
    }).catch(error => {
      // In certain cases, protocol will return error if the request was already canceled
      // or the page was closed. We should tolerate these errors.
      debugError(error);
    });
  }

  async abort(errorCode: string = 'failed') {
    const errorReason = errorReasons[errorCode];
    assert(errorReason, 'Unknown error code: ' + errorCode);
    await this._client.send('Fetch.failRequest', {
      requestId: this._interceptionId!,
      errorReason
    }).catch(error => {
      // In certain cases, protocol will return error if the request was already canceled
      // or the page was closed. We should tolerate these errors.
      debugError(error);
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

function headersArray(headers: { [s: string]: string; }): { name: string; value: string; }[] {
  const result = [];
  for (const name in headers) {
    if (!Object.is(headers[name], undefined))
      result.push({name, value: headers[name] + ''});
  }
  return result;
}

function headersObject(headers: Protocol.Network.Headers): network.Headers {
  const result: network.Headers = {};
  for (const key of Object.keys(headers))
    result[key.toLowerCase()] = headers[key];
  return result;
}

