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

import { helper, RegisteredListener } from '../helper';
import { FFSession } from './ffConnection';
import { Page } from '../page';
import * as network from '../network';
import * as frames from '../frames';
import * as types from '../types';
import { Protocol } from './protocol';

export class FFNetworkManager {
  private _session: FFSession;
  private _requests: Map<string, InterceptableRequest>;
  private _page: Page;
  private _eventListeners: RegisteredListener[];
  private _startTime = 0;

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
    const redirectedFrom = event.redirectedFrom ? (this._requests.get(event.redirectedFrom) || null) : null;
    const frame = redirectedFrom ? redirectedFrom.request.frame() : (event.frameId ? this._page._frameManager.frame(event.frameId) : null);
    if (!frame)
      return;
    if (redirectedFrom)
      this._requests.delete(redirectedFrom._id);
    const request = new InterceptableRequest(this._session, frame, redirectedFrom, event);
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
      return Buffer.from(response.base64body, 'base64');
    };

    this._startTime = event.timing.startTime;
    const timing = {
      startTime: this._startTime / 1000,
      domainLookupStart: this._relativeTiming(event.timing.domainLookupStart),
      domainLookupEnd: this._relativeTiming(event.timing.domainLookupEnd),
      connectStart: this._relativeTiming(event.timing.connectStart),
      secureConnectionStart: this._relativeTiming(event.timing.secureConnectionStart),
      connectEnd: this._relativeTiming(event.timing.connectEnd),
      requestStart: this._relativeTiming(event.timing.requestStart),
      responseStart: this._relativeTiming(event.timing.responseStart),
    };
    const response = new network.Response(request.request, event.status, event.statusText, event.headers, timing, getResponseBody);
    if (event?.remoteIPAddress && typeof event?.remotePort === 'number')
      response._serverAddrFinished({
        ipAddress: event.remoteIPAddress,
        port: event.remotePort,
      });
    else
      response._serverAddrFinished()
    response._securityDetailsFinished({
      protocol: event?.securityDetails?.protocol,
      subjectName: event?.securityDetails?.subjectName,
      issuer: event?.securityDetails?.issuer,
      validFrom: event?.securityDetails?.validFrom,
      validTo: event?.securityDetails?.validTo,
    });
    this._page._frameManager.requestReceivedResponse(response);
  }

  _onRequestFinished(event: Protocol.Network.requestFinishedPayload) {
    const request = this._requests.get(event.requestId);
    if (!request)
      return;
    const response = request.request._existingResponse()!;
    // Keep redirected requests in the map for future reference as redirectedFrom.
    const isRedirected = response.status() >= 300 && response.status() <= 399;
    if (isRedirected) {
      response._requestFinished(this._relativeTiming(event.responseEndTime), 'Response body is unavailable for redirect responses');
    } else {
      this._requests.delete(request._id);
      response._requestFinished(this._relativeTiming(event.responseEndTime));
    }
    this._page._frameManager.requestFinished(request.request);
  }

  _onRequestFailed(event: Protocol.Network.requestFailedPayload) {
    const request = this._requests.get(event.requestId);
    if (!request)
      return;
    this._requests.delete(request._id);
    const response = request.request._existingResponse();
    if (response)
      response._requestFinished(-1);
    request.request._setFailureText(event.errorCode);
    this._page._frameManager.requestFailed(request.request, event.errorCode === 'NS_BINDING_ABORTED');
  }

  _relativeTiming(time: number): number {
    if (!time)
      return -1;
    return (time - this._startTime) / 1000;
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

const internalCauseToResourceType: {[key: string]: string} = {
  TYPE_INTERNAL_EVENTSOURCE: 'eventsource',
};

class InterceptableRequest implements network.RouteDelegate {
  readonly request: network.Request;
  _id: string;
  private _session: FFSession;

  constructor(session: FFSession, frame: frames.Frame, redirectedFrom: InterceptableRequest | null, payload: Protocol.Network.requestWillBeSentPayload) {
    this._id = payload.requestId;
    this._session = session;
    let postDataBuffer = null;
    if (payload.postData)
      postDataBuffer = Buffer.from(payload.postData, 'base64');
    this.request = new network.Request(payload.isIntercepted ? this : null, frame, redirectedFrom ? redirectedFrom.request : null, payload.navigationId,
        payload.url, internalCauseToResourceType[payload.internalCause] || causeToResourceType[payload.cause] || 'other', payload.method, postDataBuffer, payload.headers);
  }

  async continue(overrides: types.NormalizedContinueOverrides) {
    await this._session.sendMayFail('Network.resumeInterceptedRequest', {
      requestId: this._id,
      url: overrides.url,
      method: overrides.method,
      headers: overrides.headers,
      postData: overrides.postData ? Buffer.from(overrides.postData).toString('base64') : undefined
    });
  }

  async fulfill(response: types.NormalizedFulfillResponse) {
    const base64body = response.isBase64 ? response.body : Buffer.from(response.body).toString('base64');

    await this._session.sendMayFail('Network.fulfillInterceptedRequest', {
      requestId: this._id,
      status: response.status,
      statusText: network.STATUS_TEXTS[String(response.status)] || '',
      headers: response.headers,
      base64body,
    });
  }

  async abort(errorCode: string) {
    await this._session.sendMayFail('Network.abortInterceptedRequest', {
      requestId: this._id,
      errorCode,
    });
  }
}
