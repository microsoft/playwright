/**
 * Copyright 2019 Google Inc. All rights reserved.
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

import { debugError, helper, RegisteredListener } from '../helper';
import { FFSession } from './ffConnection';
import { Page } from '../page';
import * as network from '../network';
import * as frames from '../frames';
import * as platform from '../platform';
import { Protocol } from './protocol';

export class FFNetworkManager {
  private _session: FFSession;
  private _requests: Map<string, InterceptableRequest>;
  private _page: Page;
  private _eventListeners: RegisteredListener[];

  constructor(session: FFSession, page: Page) {
    this._session = session;

    this._requests = new Map();
    this._page = page;

    this._eventListeners = [
      helper.addEventListener(session, 'Network.requestWillBeSent', this._onRequestWillBeSent.bind(this)),
      helper.addEventListener(session, 'Network.responseReceived', this._onResponseReceived.bind(this)),
      helper.addEventListener(session, 'Network.requestFinished', this._onRequestFinished.bind(this)),
      helper.addEventListener(session, 'Network.requestFailed', this._onRequestFailed.bind(this)),
    ];
  }

  dispose() {
    helper.removeEventListeners(this._eventListeners);
  }

  async setRequestInterception(enabled: boolean) {
    await this._session.send('Network.setRequestInterception', {enabled});
  }

  _onRequestWillBeSent(event: Protocol.Network.requestWillBeSentPayload) {
    const redirected = event.redirectedFrom ? this._requests.get(event.redirectedFrom) : null;
    const frame = redirected ? redirected.request.frame() : (event.frameId ? this._page._frameManager.frame(event.frameId) : null);
    if (!frame)
      return;
    let redirectChain: network.Request[] = [];
    if (redirected) {
      redirectChain = redirected.request._redirectChain;
      redirectChain.push(redirected.request);
      this._requests.delete(redirected._id);
    }
    const request = new InterceptableRequest(this._session, frame, redirectChain, event);
    this._requests.set(request._id, request);
    this._page._frameManager.requestStarted(request.request);
  }

  _onResponseReceived(event: Protocol.Network.responseReceivedPayload) {
    const request = this._requests.get(event.requestId);
    if (!request)
      return;
    const getResponseBody = async () => {
      const response = await this._session.send('Network.getResponseBody', {
        requestId: request._id
      });
      if (response.evicted)
        throw new Error(`Response body for ${request.request.method()} ${request.request.url()} was evicted!`);
      return platform.Buffer.from(response.base64body, 'base64');
    };
    const headers: network.Headers = {};
    for (const {name, value} of event.headers)
      headers[name.toLowerCase()] = value;
    const response = new network.Response(request.request, event.status, event.statusText, headers, getResponseBody);
    this._page._frameManager.requestReceivedResponse(response);
  }

  _onRequestFinished(event: Protocol.Network.requestFinishedPayload) {
    const request = this._requests.get(event.requestId);
    if (!request)
      return;
    const response = request.request.response()!;
    // Keep redirected requests in the map for future reference in redirectChain.
    const isRedirected = response.status() >= 300 && response.status() <= 399;
    if (isRedirected) {
      response._requestFinished(new Error('Response body is unavailable for redirect responses'));
    } else {
      this._requests.delete(request._id);
      response._requestFinished();
    }
    this._page._frameManager.requestFinished(request.request);
  }

  _onRequestFailed(event: Protocol.Network.requestFailedPayload) {
    const request = this._requests.get(event.requestId);
    if (!request)
      return;
    this._requests.delete(request._id);
    const response = request.request.response();
    if (response)
      response._requestFinished();
    request.request._setFailureText(event.errorCode);
    this._page._frameManager.requestFailed(request.request, event.errorCode === 'NS_BINDING_ABORTED');
  }
}

const causeToResourceType: {[key: string]: string} = {
  TYPE_INVALID: 'other',
  TYPE_OTHER: 'other',
  TYPE_SCRIPT: 'script',
  TYPE_IMAGE: 'image',
  TYPE_STYLESHEET: 'stylesheet',
  TYPE_OBJECT: 'other',
  TYPE_DOCUMENT: 'document',
  TYPE_SUBDOCUMENT: 'document',
  TYPE_REFRESH: 'document',
  TYPE_XBL: 'other',
  TYPE_PING: 'other',
  TYPE_XMLHTTPREQUEST: 'xhr',
  TYPE_OBJECT_SUBREQUEST: 'other',
  TYPE_DTD: 'other',
  TYPE_FONT: 'font',
  TYPE_MEDIA: 'media',
  TYPE_WEBSOCKET: 'websocket',
  TYPE_CSP_REPORT: 'other',
  TYPE_XSLT: 'other',
  TYPE_BEACON: 'other',
  TYPE_FETCH: 'fetch',
  TYPE_IMAGESET: 'images',
  TYPE_WEB_MANIFEST: 'manifest',
};

class InterceptableRequest implements network.RequestDelegate {
  readonly request: network.Request;
  _id: string;
  private _session: FFSession;

  constructor(session: FFSession, frame: frames.Frame, redirectChain: network.Request[], payload: Protocol.Network.requestWillBeSentPayload) {
    this._id = payload.requestId;
    this._session = session;

    const headers: network.Headers = {};
    for (const {name, value} of payload.headers)
      headers[name.toLowerCase()] = value;

    this.request = new network.Request(payload.isIntercepted ? this : null, frame, redirectChain, payload.navigationId,
        payload.url, causeToResourceType[payload.cause] || 'other', payload.method, payload.postData, headers);
  }

  async continue(overrides: { method?: string; headers?: network.Headers; postData?: string }) {
    const {
      method,
      headers,
      postData
    } = overrides;
    await this._session.send('Network.resumeInterceptedRequest', {
      requestId: this._id,
      method,
      headers: headers ? headersArray(headers) : undefined,
      postData: postData ? Buffer.from(postData).toString('base64') : undefined
    }).catch(error => {
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

    await this._session.send('Network.fulfillInterceptedRequest', {
      requestId: this._id,
      status: response.status || 200,
      statusText: network.STATUS_TEXTS[String(response.status || 200)] || '',
      headers: headersArray(responseHeaders),
      base64body: responseBody ? responseBody.toString('base64') : undefined,
    }).catch(error => {
      debugError(error);
    });
  }

  async abort(errorCode: string) {
    await this._session.send('Network.abortInterceptedRequest', {
      requestId: this._id,
      errorCode,
    }).catch(error => {
      debugError(error);
    });
  }
}

function headersArray(headers: network.Headers): Protocol.Network.HTTPHeader[] {
  const result: Protocol.Network.HTTPHeader[] = [];
  for (const name in headers) {
    if (!Object.is(headers[name], undefined))
      result.push({name, value: headers[name] + ''});
  }
  return result;
}
