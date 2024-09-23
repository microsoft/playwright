/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an 'AS IS' BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import type { RegisteredListener } from '../../utils/eventsHelper';
import { eventsHelper } from '../../utils/eventsHelper';
import type { Page } from '../page';
import * as network from '../network';
import type * as frames from '../frames';
import type * as types from '../types';
import * as bidi from './third_party/bidiProtocol';
import type { BidiSession } from './bidiConnection';
import { parseRawCookie } from '../cookieStore';


export class BidiNetworkManager {
  private readonly _session: BidiSession;
  private readonly _requests: Map<string, BidiRequest>;
  private readonly _page: Page;
  private readonly _eventListeners: RegisteredListener[];
  private readonly _onNavigationResponseStarted: (params: bidi.Network.ResponseStartedParameters) => void;
  private _userRequestInterceptionEnabled: boolean = false;
  private _protocolRequestInterceptionEnabled: boolean = false;
  private _credentials: types.Credentials | undefined;
  private _intercepId: bidi.Network.Intercept | undefined;

  constructor(bidiSession: BidiSession, page: Page, onNavigationResponseStarted: (params: bidi.Network.ResponseStartedParameters) => void) {
    this._session = bidiSession;
    this._requests = new Map();
    this._page = page;
    this._onNavigationResponseStarted = onNavigationResponseStarted;
    this._eventListeners = [
      eventsHelper.addEventListener(bidiSession, 'network.beforeRequestSent', this._onBeforeRequestSent.bind(this)),
      eventsHelper.addEventListener(bidiSession, 'network.responseStarted', this._onResponseStarted.bind(this)),
      eventsHelper.addEventListener(bidiSession, 'network.responseCompleted', this._onResponseCompleted.bind(this)),
      eventsHelper.addEventListener(bidiSession, 'network.fetchError', this._onFetchError.bind(this)),
      eventsHelper.addEventListener(bidiSession, 'network.authRequired', this._onAuthRequired.bind(this)),
    ];
  }

  dispose() {
    eventsHelper.removeEventListeners(this._eventListeners);
  }

  private _onBeforeRequestSent(param: bidi.Network.BeforeRequestSentParameters) {
    if (param.request.url.startsWith('data:'))
      return;
    const redirectedFrom = param.redirectCount ? (this._requests.get(param.request.request) || null) : null;
    const frame = redirectedFrom ? redirectedFrom.request.frame() : (param.context ? this._page._frameManager.frame(param.context) : null);
    if (!frame)
      return;
    if (redirectedFrom)
      this._requests.delete(redirectedFrom._id);
    let route;
    if (param.intercepts) {
      // We do not support intercepting redirects.
      if (redirectedFrom) {
        this._session.sendMayFail('network.continueRequest', {
          request: param.request.request,
          ...(redirectedFrom._originalRequestRoute?._alreadyContinuedHeaders || {}),
        });
      } else {
        route = new BidiRouteImpl(this._session, param.request.request);
      }
    }
    const request = new BidiRequest(frame, redirectedFrom, param, route);
    this._requests.set(request._id, request);
    this._page._frameManager.requestStarted(request.request, route);
  }

  private _onResponseStarted(params: bidi.Network.ResponseStartedParameters) {
    const request = this._requests.get(params.request.request);
    if (!request)
      return;
    const getResponseBody = async () => {
      throw new Error(`Response body is not available for requests in Bidi`);
    };
    const timings = params.request.timings;
    const startTime = timings.requestTime;
    function relativeToStart(time: number): number {
      if (!time)
        return -1;
      return (time - startTime) / 1000;
    }
    const timing: network.ResourceTiming = {
      startTime: startTime / 1000,
      requestStart: relativeToStart(timings.requestStart),
      responseStart: relativeToStart(timings.responseStart),
      domainLookupStart: relativeToStart(timings.dnsStart),
      domainLookupEnd: relativeToStart(timings.dnsEnd),
      connectStart: relativeToStart(timings.connectStart),
      secureConnectionStart: relativeToStart(timings.tlsStart),
      connectEnd: relativeToStart(timings.connectEnd),
    };
    const response = new network.Response(request.request, params.response.status, params.response.statusText, fromBidiHeaders(params.response.headers), timing, getResponseBody, false);
    response._serverAddrFinished();
    response._securityDetailsFinished();
    // "raw" headers are the same as "provisional" headers in Bidi.
    response.setRawResponseHeaders(null);
    response.setResponseHeadersSize(params.response.headersSize);
    this._page._frameManager.requestReceivedResponse(response);
    if (params.navigation)
      this._onNavigationResponseStarted(params);
  }

  private _onResponseCompleted(params: bidi.Network.ResponseCompletedParameters) {
    const request = this._requests.get(params.request.request);
    if (!request)
      return;
    const response = request.request._existingResponse()!;
    // TODO: body size is the encoded size
    response.setTransferSize(params.response.bodySize);
    response.setEncodedBodySize(params.response.bodySize);

    // Keep redirected requests in the map for future reference as redirectedFrom.
    const isRedirected = response.status() >= 300 && response.status() <= 399;
    const responseEndTime = params.request.timings.responseEnd / 1000 - response.timing().startTime;
    if (isRedirected) {
      response._requestFinished(responseEndTime);
    } else {
      this._requests.delete(request._id);
      response._requestFinished(responseEndTime);
    }
    response._setHttpVersion(params.response.protocol);
    this._page._frameManager.reportRequestFinished(request.request, response);

  }

  private _onFetchError(params: bidi.Network.FetchErrorParameters) {
    const request = this._requests.get(params.request.request);
    if (!request)
      return;
    this._requests.delete(request._id);
    const response = request.request._existingResponse();
    if (response) {
      response.setTransferSize(null);
      response.setEncodedBodySize(null);
      response._requestFinished(-1);
    }
    request.request._setFailureText(params.errorText);
    // TODO: support canceled flag
    this._page._frameManager.requestFailed(request.request, params.errorText === 'NS_BINDING_ABORTED');
  }

  private _onAuthRequired(params: bidi.Network.AuthRequiredParameters) {
    const isBasic = params.response.authChallenges?.some(challenge => challenge.scheme.startsWith('Basic'));
    const credentials = this._page._browserContext._options.httpCredentials;
    if (isBasic && credentials) {
      this._session.sendMayFail('network.continueWithAuth', {
        request: params.request.request,
        action: 'provideCredentials',
        credentials: {
          type: 'password',
          username: credentials.username,
          password: credentials.password,
        }
      });
    } else {
      this._session.sendMayFail('network.continueWithAuth', {
        request: params.request.request,
        action: 'default',
      });
    }
  }

  async setRequestInterception(value: boolean) {
    this._userRequestInterceptionEnabled = value;
    await this._updateProtocolRequestInterception();
  }

  async setCredentials(credentials: types.Credentials | undefined) {
    this._credentials = credentials;
    await this._updateProtocolRequestInterception();
  }

  async _updateProtocolRequestInterception(initial?: boolean) {
    const enabled = this._userRequestInterceptionEnabled || !!this._credentials;
    if (enabled === this._protocolRequestInterceptionEnabled)
      return;
    this._protocolRequestInterceptionEnabled = enabled;
    if (initial && !enabled)
      return;
    const cachePromise = this._session.send('network.setCacheBehavior', { cacheBehavior: enabled ? 'bypass' : 'default' });
    let interceptPromise = Promise.resolve<any>(undefined);
    if (enabled) {
      interceptPromise = this._session.send('network.addIntercept', {
        phases: [bidi.Network.InterceptPhase.AuthRequired, bidi.Network.InterceptPhase.BeforeRequestSent],
        urlPatterns: [{ type: 'pattern' }],
        // urlPatterns: [{ type: 'string', pattern: '*' }],
      }).then(r => {
        this._intercepId = r.intercept;
      });
    } else if (this._intercepId) {
      interceptPromise = this._session.send('network.removeIntercept', { intercept: this._intercepId });
      this._intercepId = undefined;
    }
    await Promise.all([cachePromise, interceptPromise]);
  }
}


class BidiRequest {
  readonly request: network.Request;
  readonly _id: string;
  private _redirectedTo: BidiRequest | undefined;
  // Only first request in the chain can be intercepted, so this will
  // store the first and only Route in the chain (if any).
  _originalRequestRoute: BidiRouteImpl | undefined;

  constructor(frame: frames.Frame, redirectedFrom: BidiRequest | null, payload: bidi.Network.BeforeRequestSentParameters, route: BidiRouteImpl | undefined) {
    this._id = payload.request.request;
    if (redirectedFrom)
      redirectedFrom._redirectedTo = this;
    // TODO: missing in the spec?
    const postDataBuffer = null;
    this.request = new network.Request(frame._page._browserContext, frame, null, redirectedFrom ? redirectedFrom.request : null, payload.navigation ?? undefined,
        payload.request.url, 'other', payload.request.method, postDataBuffer, fromBidiHeaders(payload.request.headers));
    // "raw" headers are the same as "provisional" headers in Bidi.
    this.request.setRawRequestHeaders(null);
    this.request._setBodySize(payload.request.bodySize || 0);
    this._originalRequestRoute = route ?? redirectedFrom?._originalRequestRoute;
    route?._setRequest(this.request);
  }

  _finalRequest(): BidiRequest {
    let request: BidiRequest = this;
    while (request._redirectedTo)
      request = request._redirectedTo;
    return request;
  }
}

class BidiRouteImpl implements network.RouteDelegate {
  private _requestId: bidi.Network.Request;
  private _session: BidiSession;
  private _request!: network.Request;
  _alreadyContinuedHeaders: types.HeadersArray | undefined;

  constructor(session: BidiSession, requestId: bidi.Network.Request) {
    this._session = session;
    this._requestId = requestId;
  }

  _setRequest(request: network.Request) {
    this._request = request;
  }

  async continue(overrides: types.NormalizedContinueOverrides) {
    // Firefox does not update content-length header.
    let headers = overrides.headers || this._request.headers();
    if (overrides.postData && headers) {
      headers = headers.map(header => {
        if (header.name.toLowerCase() === 'content-length')
          return { name: header.name, value: overrides.postData!.byteLength.toString() };
        return header;
      });
    }
    this._alreadyContinuedHeaders = headers;
    await this._session.sendMayFail('network.continueRequest', {
      request: this._requestId,
      url: overrides.url,
      method: overrides.method,
      ...toBidiRequestHeaders(this._alreadyContinuedHeaders),
      body: overrides.postData ? { type: 'base64', value: Buffer.from(overrides.postData).toString('base64') } : undefined,
    });
  }

  async fulfill(response: types.NormalizedFulfillResponse) {
    const base64body = response.isBase64 ? response.body : Buffer.from(response.body).toString('base64');
    await this._session.sendMayFail('network.provideResponse', {
      request: this._requestId,
      statusCode: response.status,
      reasonPhrase: network.statusText(response.status),
      ...toBidiResponseHeaders(response.headers),
      body: { type: 'base64', value: base64body },
    });
  }

  async abort(errorCode: string) {
    await this._session.sendMayFail('network.failRequest', {
      request: this._requestId
    });
  }
}

function fromBidiHeaders(bidiHeaders: bidi.Network.Header[]): types.HeadersArray {
  const result: types.HeadersArray = [];
  for (const { name, value } of bidiHeaders)
    result.push({ name, value: bidiBytesValueToString(value) });
  return result;
}

function toBidiRequestHeaders(allHeaders: types.HeadersArray): { cookies: bidi.Network.CookieHeader[], headers: bidi.Network.Header[] } {
  const bidiHeaders = toBidiHeaders(allHeaders);
  const cookies = bidiHeaders.filter(h => h.name.toLowerCase() === 'cookie');
  const headers = bidiHeaders.filter(h => h.name.toLowerCase() !== 'cookie');
  return { cookies, headers };
}

function toBidiResponseHeaders(headers: types.HeadersArray): { cookies: bidi.Network.SetCookieHeader[], headers: bidi.Network.Header[] } {
  const setCookieHeaders = headers.filter(h => h.name.toLowerCase() === 'set-cookie');
  const otherHeaders = headers.filter(h => h.name.toLowerCase() !== 'set-cookie');
  const rawCookies = setCookieHeaders.map(h => parseRawCookie(h.value));
  const cookies: bidi.Network.SetCookieHeader[] = rawCookies.filter(Boolean).map(c => {
    return {
      ...c!,
      value: { type: 'string', value: c!.value },
      sameSite: toBidiSameSite(c!.sameSite),
    };
  });
  return { cookies, headers: toBidiHeaders(otherHeaders) };
}

function toBidiHeaders(headers: types.HeadersArray): bidi.Network.Header[] {
  return headers.map(({ name, value }) => ({ name, value: { type: 'string', value } }));
}

export function bidiBytesValueToString(value: bidi.Network.BytesValue): string {
  if (value.type === 'string')
    return value.value;
  if (value.type === 'base64')
    return Buffer.from(value.type, 'base64').toString('binary');
  return 'unknown value type: ' + (value as any).type;

}

function toBidiSameSite(sameSite?: 'Strict' | 'Lax' | 'None'): bidi.Network.SameSite | undefined {
  if (!sameSite)
    return undefined;
  if (sameSite === 'Strict')
    return bidi.Network.SameSite.Strict;
  if (sameSite === 'Lax')
    return bidi.Network.SameSite.Lax;
  return bidi.Network.SameSite.None;
}
