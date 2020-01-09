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

import { WKSession, WKPageProxySession } from './wkConnection';
import { Page } from '../page';
import { helper, RegisteredListener, assert } from '../helper';
import { Protocol } from './protocol';
import * as network from '../network';
import * as frames from '../frames';
import * as types from '../types';
import * as platform from '../platform';

export class WKNetworkManager {
  private readonly _page: Page;
  private readonly _pageProxySession: WKPageProxySession;
  private _session: WKSession;
  private readonly _requestIdToRequest = new Map<string, InterceptableRequest>();
  private _userCacheDisabled = false;
  private _sessionListeners: RegisteredListener[] = [];

  constructor(page: Page, pageProxySession: WKPageProxySession) {
    this._page = page;
    this._pageProxySession = pageProxySession;
  }

  async initializePageProxySession(credentials: types.Credentials | null) {
    await this.authenticate(credentials);
  }

  setSession(session: WKSession) {
    helper.removeEventListeners(this._sessionListeners);
    this._session = session;
    this._sessionListeners = [
      helper.addEventListener(this._session, 'Network.requestWillBeSent', this._onRequestWillBeSent.bind(this)),
      helper.addEventListener(this._session, 'Network.requestIntercepted', this._onRequestIntercepted.bind(this)),
      helper.addEventListener(this._session, 'Network.responseReceived', this._onResponseReceived.bind(this)),
      helper.addEventListener(this._session, 'Network.loadingFinished', this._onLoadingFinished.bind(this)),
      helper.addEventListener(this._session, 'Network.loadingFailed', this._onLoadingFailed.bind(this)),
    ];
  }

  async initializeSession(session: WKSession, interceptNetwork: boolean | null, offlineMode: boolean | null) {
    const promises = [];
    promises.push(session.send('Network.enable'));
    if (interceptNetwork)
      promises.push(session.send('Network.setInterceptionEnabled', { enabled: true, interceptRequests: true }));
    if (offlineMode)
      promises.push(session.send('Network.setEmulateOfflineState', { offline: true }));
    await Promise.all(promises);
  }

  dispose() {
    helper.removeEventListeners(this._sessionListeners);
  }

  async setCacheEnabled(enabled: boolean) {
    this._userCacheDisabled = !enabled;
    await this._updateProtocolCacheDisabled();
  }

  async setRequestInterception(enabled: boolean): Promise<void> {
    await this._session.send('Network.setInterceptionEnabled', { enabled, interceptRequests: enabled });
  }

  async _updateProtocolCacheDisabled() {
    await this._session.send('Network.setResourceCachingDisabled', {
      disabled: this._userCacheDisabled
    });
  }

  _onRequestWillBeSent(event: Protocol.Network.requestWillBeSentPayload) {
    let redirectChain: network.Request[] = [];
    if (event.redirectResponse) {
      const request = this._requestIdToRequest.get(event.requestId);
      // If we connect late to the target, we could have missed the requestWillBeSent event.
      if (request) {
        this._handleRequestRedirect(request, event.redirectResponse);
        redirectChain = request.request._redirectChain;
      }
    }
    const frame = this._page._frameManager.frame(event.frameId);
    // TODO(einbinder) this will fail if we are an XHR document request
    const isNavigationRequest = event.type === 'Document';
    const documentId = isNavigationRequest ? this._session.sessionId + '::' + event.loaderId : undefined;
    const request = new InterceptableRequest(this._session, this._page._state.interceptNetwork, frame, event, redirectChain, documentId);
    this._requestIdToRequest.set(event.requestId, request);
    this._page._frameManager.requestStarted(request.request);
  }

  _onRequestIntercepted(event: Protocol.Network.requestInterceptedPayload) {
    this._requestIdToRequest.get(event.requestId)._interceptedCallback();
  }

  _createResponse(request: InterceptableRequest, responsePayload: Protocol.Network.Response): network.Response {
    const remoteAddress: network.RemoteAddress = { ip: '', port: 0 };
    const getResponseBody = async () => {
      const response = await this._session.send('Network.getResponseBody', { requestId: request._requestId });
      return platform.Buffer.from(response.body, response.base64Encoded ? 'base64' : 'utf8');
    };
    return new network.Response(request.request, responsePayload.status, responsePayload.statusText, headersObject(responsePayload.headers), remoteAddress, getResponseBody);
  }

  _handleRequestRedirect(request: InterceptableRequest, responsePayload: Protocol.Network.Response) {
    const response = this._createResponse(request, responsePayload);
    request.request._redirectChain.push(request.request);
    response._requestFinished(new Error('Response body is unavailable for redirect responses'));
    this._requestIdToRequest.delete(request._requestId);
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
    if (request.request.response())
      request.request.response()._requestFinished();
    this._requestIdToRequest.delete(request._requestId);
    this._page._frameManager.requestFinished(request.request);
  }

  _onLoadingFailed(event: Protocol.Network.loadingFailedPayload) {
    const request = this._requestIdToRequest.get(event.requestId);
    // For certain requestIds we never receive requestWillBeSent event.
    // @see https://crbug.com/750469
    if (!request)
      return;
    const response = request.request.response();
    if (response)
      response._requestFinished();
    this._requestIdToRequest.delete(request._requestId);
    request.request._setFailureText(event.errorText);
    this._page._frameManager.requestFailed(request.request, event.errorText.includes('cancelled'));
  }

  async authenticate(credentials: types.Credentials | null) {
    await this._pageProxySession.send('Emulation.setAuthCredentials', { ...(credentials || { username: '', password: '' }) });
  }

  async setOfflineMode(value: boolean): Promise<void> {
    await this._session.send('Network.setEmulateOfflineState', { offline: value });
  }
}

const errorReasons: { [reason: string]: string } = {
  'aborted': 'Cancellation',
  'accessdenied': 'AccessControl',
  'addressunreachable': 'General',
  'blockedbyclient': 'Cancellation',
  'blockedbyresponse': 'General',
  'connectionaborted': 'General',
  'connectionclosed': 'General',
  'connectionfailed': 'General',
  'connectionrefused': 'General',
  'connectionreset': 'General',
  'internetdisconnected': 'General',
  'namenotresolved': 'General',
  'timedout': 'Timeout',
  'failed': 'General',
};

class InterceptableRequest implements network.RequestDelegate {
  private _session: WKSession;
  readonly request: network.Request;
  _requestId: string;
  _documentId: string | undefined;
  _interceptedCallback: () => void;
  private _interceptedPromise: Promise<unknown>;

  constructor(session: WKSession, allowInterception: boolean, frame: frames.Frame | null, event: Protocol.Network.requestWillBeSentPayload, redirectChain: network.Request[], documentId: string | undefined) {
    this._session = session;
    this._requestId = event.requestId;
    this._documentId = documentId;
    this.request = new network.Request(allowInterception ? this : null, frame, redirectChain, documentId, event.request.url,
        event.type ? event.type.toLowerCase() : 'Unknown', event.request.method, event.request.postData, headersObject(event.request.headers));
    this._interceptedPromise = new Promise(f => this._interceptedCallback = f);
  }

  async abort(errorCode: string) {
    const reason = errorReasons[errorCode];
    assert(reason, 'Unknown error code: ' + errorCode);
    await this._interceptedPromise;
    await this._session.send('Network.interceptAsError', { requestId: this._requestId, reason });
  }

  async fulfill(response: { status: number; headers: network.Headers; contentType: string; body: (string | platform.BufferType); }) {
    await this._interceptedPromise;

    const base64Encoded = !!response.body && !helper.isString(response.body);
    const responseBody = response.body ? (base64Encoded ? response.body.toString('base64') : response.body as string) : undefined;

    const responseHeaders: { [s: string]: string; } = {};
    if (response.headers) {
      for (const header of Object.keys(response.headers))
        responseHeaders[header.toLowerCase()] = String(response.headers[header]);
    }
    if (response.contentType)
      responseHeaders['content-type'] = response.contentType;
    if (responseBody && !('content-length' in responseHeaders))
      responseHeaders['content-length'] = String(platform.Buffer.byteLength(responseBody));

    await this._session.send('Network.interceptWithResponse', {
      requestId: this._requestId,
      status: response.status || 200,
      statusText: network.STATUS_TEXTS[String(response.status || 200)],
      mimeType: response.contentType || (base64Encoded ? 'application/octet-stream' : 'text/plain'),
      headers: responseHeaders,
      base64Encoded,
      content: responseBody
    });
  }

  async continue(overrides: { headers?: { [key: string]: string; }; }) {
    await this._interceptedPromise;
    await this._session.send('Network.interceptContinue', {
      requestId: this._requestId,
      ...overrides
    });
  }
}

function headersObject(headers: Protocol.Network.Headers): network.Headers {
  const result: network.Headers = {};
  for (const key of Object.keys(headers))
    result[key.toLowerCase()] = headers[key];
  return result;
}
