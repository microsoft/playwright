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

import * as frames from '../frames';
import { assert, debugError, helper } from '../helper';
import * as network from '../network';
import * as platform from '../platform';
import { Protocol } from './protocol';
import { WKSession } from './wkConnection';

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

export class WKInterceptableRequest implements network.RequestDelegate {
  private readonly _session: WKSession;
  readonly request: network.Request;
  readonly _requestId: string;
  _interceptedCallback: () => void = () => {};
  private _interceptedPromise: Promise<unknown>;

  constructor(session: WKSession, allowInterception: boolean, frame: frames.Frame | null, event: Protocol.Network.requestWillBeSentPayload, redirectChain: network.Request[], documentId: string | undefined) {
    this._session = session;
    this._requestId = event.requestId;
    this.request = new network.Request(allowInterception ? this : null, frame, redirectChain, documentId, event.request.url,
        event.type ? event.type.toLowerCase() : 'Unknown', event.request.method, event.request.postData, headersObject(event.request.headers));
    this._interceptedPromise = new Promise(f => this._interceptedCallback = f);
  }

  async abort(errorCode: string) {
    const reason = errorReasons[errorCode];
    assert(reason, 'Unknown error code: ' + errorCode);
    await this._interceptedPromise;
    await this._session.send('Network.interceptAsError', { requestId: this._requestId, reason }).catch(error => {
      // In certain cases, protocol will return error if the request was already canceled
      // or the page was closed. We should tolerate these errors.
      debugError(error);
    });
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
    }).catch(error => {
      // In certain cases, protocol will return error if the request was already canceled
      // or the page was closed. We should tolerate these errors.
      debugError(error);
    });
  }

  async continue(overrides: { method?: string; headers?: network.Headers; postData?: string }) {
    await this._interceptedPromise;
    await this._session.send('Network.interceptContinue', {
      requestId: this._requestId,
      method: overrides.method,
      headers: overrides.headers,
      postData: overrides.postData ? Buffer.from(overrides.postData).toString('base64') : undefined
    }).catch((error: Error) => {
      // In certain cases, protocol will return error if the request was already canceled
      // or the page was closed. We should tolerate these errors.
      debugError(error);
    });
  }

  createResponse(responsePayload: Protocol.Network.Response): network.Response {
    const getResponseBody = async () => {
      const response = await this._session.send('Network.getResponseBody', { requestId: this._requestId });
      return platform.Buffer.from(response.body, response.base64Encoded ? 'base64' : 'utf8');
    };
    return new network.Response(this.request, responsePayload.status, responsePayload.statusText, headersObject(responsePayload.headers), getResponseBody);
  }
}

function headersObject(headers: Protocol.Network.Headers): network.Headers {
  const result: network.Headers = {};
  for (const key of Object.keys(headers))
    result[key.toLowerCase()] = headers[key];
  return result;
}
