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

import { assert, debugError, helper, RegisteredListener } from '../helper';
import { FFSession } from './ffConnection';
import { Page } from '../page';
import * as network from '../network';
import * as frames from '../frames';

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

  async setRequestInterception(enabled) {
    await this._session.send('Network.setRequestInterception', {enabled});
  }

  _onRequestWillBeSent(event) {
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

  _onResponseReceived(event) {
    const request = this._requests.get(event.requestId);
    if (!request)
      return;
    const remoteAddress: network.RemoteAddress = { ip: event.remoteIPAddress, port: event.remotePort };
    const getResponseBody = async () => {
      const response = await this._session.send('Network.getResponseBody', {
        requestId: request._id
      });
      if (response.evicted)
        throw new Error(`Response body for ${request.request.method()} ${request.request.url()} was evicted!`);
      return Buffer.from(response.base64body, 'base64');
    };
    const headers: network.Headers = {};
    for (const {name, value} of event.headers)
      headers[name.toLowerCase()] = value;
    const response = new network.Response(request.request, event.status, event.statusText, headers, remoteAddress, getResponseBody);
    this._page._frameManager.requestReceivedResponse(response);
  }

  _onRequestFinished(event) {
    const request = this._requests.get(event.requestId);
    if (!request)
      return;
    const response = request.request.response();
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

  _onRequestFailed(event) {
    const request = this._requests.get(event.requestId);
    if (!request)
      return;
    this._requests.delete(request._id);
    if (request.request.response())
      request.request.response()._requestFinished();
    request.request._setFailureText(event.errorCode);
    this._page._frameManager.requestFailed(request.request, event.errorCode === 'NS_BINDING_ABORTED');
  }
}

const causeToResourceType = {
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

const interceptableRequestSymbol = Symbol('interceptableRequest');

export function toInterceptableRequest(request: network.Request): InterceptableRequest {
  return (request as any)[interceptableRequestSymbol];
}

class InterceptableRequest {
  readonly request: network.Request;
  _id: string;
  private _session: FFSession;
  private _suspended: boolean;
  private _interceptionHandled: boolean;

  constructor(session: FFSession, frame: frames.Frame, redirectChain: network.Request[], payload: any) {
    this._id = payload.requestId;
    this._session = session;
    this._suspended = payload.suspended;
    this._interceptionHandled = false;

    const headers: network.Headers = {};
    for (const {name, value} of payload.headers)
      headers[name.toLowerCase()] = value;

    this.request = new network.Request(frame, redirectChain, payload.navigationId,
        payload.url, causeToResourceType[payload.cause] || 'other', payload.method, payload.postData, headers);
    (this.request as any)[interceptableRequestSymbol] = this;
  }

  async continue(overrides: {url?: string, method?: string, postData?: string, headers?: {[key: string]: string}} = {}) {
    assert(!overrides.url, 'Playwright-Firefox does not support overriding URL');
    assert(!overrides.method, 'Playwright-Firefox does not support overriding method');
    assert(!overrides.postData, 'Playwright-Firefox does not support overriding postData');
    assert(this._suspended, 'Request Interception is not enabled!');
    assert(!this._interceptionHandled, 'Request is already handled!');
    this._interceptionHandled = true;
    const {
      headers,
    } = overrides;
    await this._session.send('Network.resumeSuspendedRequest', {
      requestId: this._id,
      headers: headers ? Object.entries(headers).filter(([, value]) => !Object.is(value, undefined)).map(([name, value]) => ({name, value})) : undefined,
    }).catch(error => {
      debugError(error);
    });
  }

  async abort() {
    assert(this._suspended, 'Request Interception is not enabled!');
    assert(!this._interceptionHandled, 'Request is already handled!');
    this._interceptionHandled = true;
    await this._session.send('Network.abortSuspendedRequest', {
      requestId: this._id,
    }).catch(error => {
      debugError(error);
    });
  }
}
