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

import { assert, headersArrayToObject, headersObjectToArray } from '../../utils';
import * as network from '../network';

import type * as frames from '../frames';
import type * as types from '../types';
import type { Protocol } from './protocol';
import type { WKSession } from './wkConnection';


const errorReasons: { [reason: string]: Protocol.Network.ResourceErrorType } = {
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

export class WKInterceptableRequest {
  private _session: WKSession;
  private _requestId: string;
  readonly request: network.Request;
  _timestamp: number;
  _wallTime: number;

  constructor(session: WKSession, frame: frames.Frame, event: Protocol.Network.requestWillBeSentPayload, redirectedFrom: WKInterceptableRequest | null, documentId: string | undefined) {
    this._session = session;
    this._requestId = event.requestId;
    const resourceType = event.type ? event.type.toLowerCase() : (redirectedFrom ? redirectedFrom.request.resourceType() : 'other');
    let postDataBuffer = null;
    this._timestamp = event.timestamp;
    this._wallTime = event.walltime * 1000;
    if (event.request.postData)
      postDataBuffer = Buffer.from(event.request.postData, 'base64');
    this.request = new network.Request(frame._page.browserContext, frame, null, redirectedFrom?.request || null, documentId, event.request.url,
        resourceType, event.request.method, postDataBuffer, headersObjectToArray(event.request.headers));
  }

  adoptRequestFromNewProcess(newSession: WKSession, requestId: string) {
    this._session = newSession;
    this._requestId = requestId;
  }

  createResponse(responsePayload: Protocol.Network.Response): network.Response {
    const getResponseBody = async () => {
      const response = await this._session.send('Network.getResponseBody', { requestId: this._requestId });
      return Buffer.from(response.body, response.base64Encoded ? 'base64' : 'utf8');
    };
    const timingPayload = responsePayload.timing;
    const timing: network.ResourceTiming = {
      startTime: this._wallTime,
      domainLookupStart: timingPayload ? wkMillisToRoundishMillis(timingPayload.domainLookupStart) : -1,
      domainLookupEnd: timingPayload ? wkMillisToRoundishMillis(timingPayload.domainLookupEnd) : -1,
      connectStart: timingPayload ? wkMillisToRoundishMillis(timingPayload.connectStart) : -1,
      secureConnectionStart: timingPayload ? wkMillisToRoundishMillis(timingPayload.secureConnectionStart) : -1,
      connectEnd: timingPayload ? wkMillisToRoundishMillis(timingPayload.connectEnd) : -1,
      requestStart: timingPayload ? wkMillisToRoundishMillis(timingPayload.requestStart) : -1,
      responseStart: timingPayload ? wkMillisToRoundishMillis(timingPayload.responseStart) : -1,
    };
    const setCookieSeparator = process.platform === 'darwin' ? ',' : 'playwright-set-cookie-separator';
    const response = new network.Response(this.request, responsePayload.status, responsePayload.statusText, headersObjectToArray(responsePayload.headers, ',', setCookieSeparator), timing, getResponseBody, responsePayload.source === 'service-worker');

    // No raw response headers in WebKit, use "provisional" ones.
    response.setRawResponseHeaders(null);
    // Transfer size is not available in WebKit.
    response.setTransferSize(null);

    if (responsePayload.requestHeaders && Object.keys(responsePayload.requestHeaders).length) {
      const headers = { ...responsePayload.requestHeaders };
      if (!headers['host'])
        headers['Host'] = new URL(this.request.url()).host;
      this.request.setRawRequestHeaders(headersObjectToArray(headers));
    } else {
      // No raw headers available, use provisional ones.
      this.request.setRawRequestHeaders(null);
    }
    return response;
  }
}

export class WKRouteImpl implements network.RouteDelegate {
  private readonly _session: WKSession;
  private readonly _requestId: string;

  constructor(session: WKSession, requestId: string) {
    this._session = session;
    this._requestId = requestId;
  }

  async abort(errorCode: string) {
    const errorType = errorReasons[errorCode];
    assert(errorType, 'Unknown error code: ' + errorCode);
    // In certain cases, protocol will return error if the request was already canceled
    // or the page was closed. We should tolerate these errors.
    await this._session.sendMayFail('Network.interceptRequestWithError', { requestId: this._requestId, errorType });
  }

  async fulfill(response: types.NormalizedFulfillResponse) {
    if (300 <= response.status && response.status < 400)
      throw new Error('Cannot fulfill with redirect status: ' + response.status);

    // In certain cases, protocol will return error if the request was already canceled
    // or the page was closed. We should tolerate these errors.
    let mimeType = response.isBase64 ? 'application/octet-stream' : 'text/plain';
    const headers = headersArrayToObject(response.headers, true /* lowerCase */);
    const contentType = headers['content-type'];
    if (contentType)
      mimeType = contentType.split(';')[0].trim();

    await this._session.sendMayFail('Network.interceptRequestWithResponse', {
      requestId: this._requestId,
      status: response.status,
      statusText: network.statusText(response.status),
      mimeType,
      headers,
      base64Encoded: response.isBase64,
      content: response.body
    });
  }

  async continue(overrides: types.NormalizedContinueOverrides) {
    // In certain cases, protocol will return error if the request was already canceled
    // or the page was closed. We should tolerate these errors.
    await this._session.sendMayFail('Network.interceptWithRequest', {
      requestId: this._requestId,
      url: overrides.url,
      method: overrides.method,
      headers: overrides.headers ? headersArrayToObject(overrides.headers, false /* lowerCase */) : undefined,
      postData: overrides.postData ? Buffer.from(overrides.postData).toString('base64') : undefined
    });
  }
}

function wkMillisToRoundishMillis(value: number): number {
  // WebKit uses -1000 for unavailable.
  if (value === -1000)
    return -1;

  // WebKit has a bug, instead of -1 it sends -1000 to be in ms.
  if (value <= 0) {
    // DNS can start before request start on Mac Network Stack
    return -1;
  }

  return ((value * 1000) | 0) / 1000;
}
