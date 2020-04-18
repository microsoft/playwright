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
import { assert, helper, RegisteredListener } from '../helper';
import { Protocol } from './protocol';
import * as network from '../network';
import * as frames from '../frames';
import { Credentials } from '../types';
import { CRPage } from './crPage';
import { logError } from '../logger';

export class CRNetworkManager {
  private _client: CRSession;
  private _page: Page;
  private _requestIdToRequest = new Map<string, InterceptableRequest>();
  private _requestIdToRequestWillBeSentEvent = new Map<string, Protocol.Network.requestWillBeSentPayload>();
  private _credentials: {username: string, password: string} | null = null;
  private _attemptedAuthentications = new Set<string>();
  private _userRequestInterceptionEnabled = false;
  private _protocolRequestInterceptionEnabled = false;
  private _requestIdToRequestPausedEvent = new Map<string, Protocol.Fetch.requestPausedPayload>();
  private _eventListeners: RegisteredListener[];

  constructor(client: CRSession, page: Page) {
    this._client = client;
    this._page = page;
    this._eventListeners = this.instrumentNetworkEvents(client);
  }

  instrumentNetworkEvents(session: CRSession, workerFrame?: frames.Frame): RegisteredListener[] {
    return [
      helper.addEventListener(session, 'Fetch.requestPaused', this._onRequestPaused.bind(this, workerFrame)),
      helper.addEventListener(session, 'Fetch.authRequired', this._onAuthRequired.bind(this)),
      helper.addEventListener(session, 'Network.requestWillBeSent', this._onRequestWillBeSent.bind(this, workerFrame)),
      helper.addEventListener(session, 'Network.responseReceived', this._onResponseReceived.bind(this)),
      helper.addEventListener(session, 'Network.loadingFinished', this._onLoadingFinished.bind(this)),
      helper.addEventListener(session, 'Network.loadingFailed', this._onLoadingFailed.bind(this)),
    ];
  }

  async initialize() {
    await this._client.send('Network.enable');
  }

  dispose() {
    helper.removeEventListeners(this._eventListeners);
  }

  async authenticate(credentials: Credentials | null) {
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
      return;
    }
    this._onRequest(workerFrame, event, null);
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
    this._client.send('Fetch.continueWithAuth', {
      requestId: event.requestId,
      authChallengeResponse: { response, username, password },
    }).catch(logError(this._page));
  }

  _onRequestPaused(workerFrame: frames.Frame | undefined, event: Protocol.Fetch.requestPausedPayload) {
    if (!this._userRequestInterceptionEnabled && this._protocolRequestInterceptionEnabled) {
      this._client.send('Fetch.continueRequest', {
        requestId: event.requestId
      }).catch(logError(this._page));
    }
    if (!event.networkId || event.request.url.startsWith('data:'))
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
        this._handleRequestRedirect(request, requestWillBeSentEvent.redirectResponse);
        redirectedFrom = request.request;
      }
    }
    let frame = requestWillBeSentEvent.frameId ? this._page._frameManager.frame(requestWillBeSentEvent.frameId) : workerFrame;

    // Check if it's main resource request interception (targetId === main frame id).
    if (!frame && requestPausedEvent && requestWillBeSentEvent.frameId === (this._page._delegate as CRPage)._targetId) {
      // Main resource request for the page is being intercepted so the Frame is not created
      // yet. Precreate it here for the purposes of request interception. It will be updated
      // later as soon as the request contnues and we receive frame tree from the page.
      frame = this._page._frameManager.frameAttached(requestWillBeSentEvent.frameId, null);
    }

    if (!frame) {
      if (requestPausedEvent)
        this._client.send('Fetch.continueRequest', { requestId: requestPausedEvent.requestId }).catch(logError(this._page));
      return;
    }
    const isNavigationRequest = requestWillBeSentEvent.requestId === requestWillBeSentEvent.loaderId && requestWillBeSentEvent.type === 'Document';
    const documentId = isNavigationRequest ? requestWillBeSentEvent.loaderId : undefined;
    if (isNavigationRequest)
      this._page._frameManager.frameUpdatedDocumentIdForNavigation(requestWillBeSentEvent.frameId!, documentId!);
    const request = new InterceptableRequest({
      client: this._client,
      frame,
      documentId,
      allowInterception: this._userRequestInterceptionEnabled,
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
    return new network.Response(request.request, responsePayload.status, responsePayload.statusText, headersObject(responsePayload.headers), getResponseBody);
  }

  _handleRequestRedirect(request: InterceptableRequest, responsePayload: Protocol.Network.Response) {
    const response = this._createResponse(request, responsePayload);
    response._requestFinished(new Error('Response body is unavailable for redirect responses'));
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
    const request = this._requestIdToRequest.get(event.requestId);
    // For certain requestIds we never receive requestWillBeSent event.
    // @see https://crbug.com/750469
    if (!request)
      return;

    // Under certain conditions we never get the Network.responseReceived
    // event from protocol. @see https://crbug.com/883475
    const response = request.request._existingResponse();
    if (response)
      response._requestFinished();
    this._requestIdToRequest.delete(request._requestId);
    if (request._interceptionId)
      this._attemptedAuthentications.delete(request._interceptionId);
    this._page._frameManager.requestFinished(request.request);
  }

  _onLoadingFailed(event: Protocol.Network.loadingFailedPayload) {
    const request = this._requestIdToRequest.get(event.requestId);
    // For certain requestIds we never receive requestWillBeSent event.
    // @see https://crbug.com/750469
    if (!request)
      return;
    const response = request.request._existingResponse();
    if (response)
      response._requestFinished();
    this._requestIdToRequest.delete(request._requestId);
    if (request._interceptionId)
      this._attemptedAuthentications.delete(request._interceptionId);
    request.request._setFailureText(event.errorText);
    this._page._frameManager.requestFailed(request.request, !!event.canceled);
  }
}

class InterceptableRequest implements network.RouteDelegate {
  readonly request: network.Request;
  _requestId: string;
  _interceptionId: string | null;
  _documentId: string | undefined;
  private _client: CRSession;

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
    this._requestId = requestWillBeSentEvent.requestId;
    this._interceptionId = requestPausedEvent && requestPausedEvent.requestId;
    this._documentId = documentId;

    const {
      headers,
      method,
      url,
      postData = null,
    } = requestPausedEvent ? requestPausedEvent.request : requestWillBeSentEvent.request;
    const type = (requestWillBeSentEvent.type || '').toLowerCase();
    this.request = new network.Request(allowInterception ? this : null, frame, redirectedFrom, documentId, url, type, method, postData, headersObject(headers));
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
      logError(this.request._page)(error);
    });
  }

  async fulfill(response: network.FulfillResponse) {
    const responseBody = response.body && helper.isString(response.body) ? Buffer.from(response.body) : (response.body || null);

    const responseHeaders: { [s: string]: string; } = {};
    if (response.headers) {
      for (const header of Object.keys(response.headers))
        responseHeaders[header.toLowerCase()] = response.headers[header];
    }
    if (response.contentType)
      responseHeaders['content-type'] = response.contentType;
    if (responseBody && !('content-length' in responseHeaders))
      responseHeaders['content-length'] = String(Buffer.byteLength(responseBody));

    await this._client.send('Fetch.fulfillRequest', {
      requestId: this._interceptionId!,
      responseCode: response.status || 200,
      responsePhrase: network.STATUS_TEXTS[String(response.status || 200)],
      responseHeaders: headersArray(responseHeaders),
      body: responseBody ? responseBody.toString('base64') : undefined,
    }).catch(error => {
      // In certain cases, protocol will return error if the request was already canceled
      // or the page was closed. We should tolerate these errors.
      logError(this.request._page)(error);
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
      logError(this.request._page)(error);
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

