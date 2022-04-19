/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { URLSearchParams } from 'url';
import type * as channels from '../protocol/channels';
import { ChannelOwner } from './channelOwner';
import { Frame } from './frame';
import type { Headers, RemoteAddr, SecurityDetails, WaitForEventOptions } from './types';
import fs from 'fs';
import { mime } from '../utilsBundle';
import { isString, headersObjectToArray } from '../utils';
import { ManualPromise } from '../utils/manualPromise';
import { Events } from './events';
import type { Page } from './page';
import { Waiter } from './waiter';
import type * as api from '../../types/types';
import type { HeadersArray, URLMatch } from '../common/types';
import { urlMatches } from './clientHelper';
import { MultiMap } from '../utils/multimap';
import { APIResponse } from './fetch';

export type NetworkCookie = {
  name: string,
  value: string,
  domain: string,
  path: string,
  expires: number,
  httpOnly: boolean,
  secure: boolean,
  sameSite: 'Strict' | 'Lax' | 'None'
};

export type SetNetworkCookieParam = {
  name: string,
  value: string,
  url?: string,
  domain?: string,
  path?: string,
  expires?: number,
  httpOnly?: boolean,
  secure?: boolean,
  sameSite?: 'Strict' | 'Lax' | 'None'
};

export class Request extends ChannelOwner<channels.RequestChannel> implements api.Request {
  private _redirectedFrom: Request | null = null;
  private _redirectedTo: Request | null = null;
  _failureText: string | null = null;
  private _provisionalHeaders: RawHeaders;
  private _actualHeadersPromise: Promise<RawHeaders> | undefined;
  private _postData: Buffer | null;
  _timing: ResourceTiming;

  static from(request: channels.RequestChannel): Request {
    return (request as any)._object;
  }

  static fromNullable(request: channels.RequestChannel | undefined): Request | null {
    return request ? Request.from(request) : null;
  }

  constructor(parent: ChannelOwner, type: string, guid: string, initializer: channels.RequestInitializer) {
    super(parent, type, guid, initializer);
    this._redirectedFrom = Request.fromNullable(initializer.redirectedFrom);
    if (this._redirectedFrom)
      this._redirectedFrom._redirectedTo = this;
    this._provisionalHeaders = new RawHeaders(initializer.headers);
    this._postData = initializer.postData !== undefined ? Buffer.from(initializer.postData, 'base64') : null;
    this._timing = {
      startTime: 0,
      domainLookupStart: -1,
      domainLookupEnd: -1,
      connectStart: -1,
      secureConnectionStart: -1,
      connectEnd: -1,
      requestStart: -1,
      responseStart: -1,
      responseEnd: -1,
    };
  }

  url(): string {
    return this._initializer.url;
  }

  resourceType(): string {
    return this._initializer.resourceType;
  }

  method(): string {
    return this._initializer.method;
  }

  postData(): string | null {
    return this._postData ? this._postData.toString('utf8') : null;
  }

  postDataBuffer(): Buffer | null {
    return this._postData;
  }

  postDataJSON(): Object | null {
    const postData = this.postData();
    if (!postData)
      return null;

    const contentType = this.headers()['content-type'];
    if (contentType === 'application/x-www-form-urlencoded') {
      const entries: Record<string, string> = {};
      const parsed = new URLSearchParams(postData);
      for (const [k, v] of parsed.entries())
        entries[k] = v;
      return entries;
    }

    try {
      return JSON.parse(postData);
    } catch (e) {
      throw new Error('POST data is not a valid JSON object: ' + postData);
    }
  }

  /**
   * @deprecated
   */
  headers(): Headers {
    return this._provisionalHeaders.headers();
  }

  _actualHeaders(): Promise<RawHeaders> {
    if (!this._actualHeadersPromise) {
      this._actualHeadersPromise = this._wrapApiCall(async () => {
        return new RawHeaders((await this._channel.rawRequestHeaders()).headers);
      });
    }
    return this._actualHeadersPromise;
  }

  async allHeaders(): Promise<Headers> {
    return (await this._actualHeaders()).headers();
  }

  async headersArray(): Promise<HeadersArray> {
    return (await this._actualHeaders()).headersArray();
  }

  async headerValue(name: string): Promise<string | null> {
    return (await this._actualHeaders()).get(name);
  }

  async response(): Promise<Response | null> {
    return Response.fromNullable((await this._channel.response()).response);
  }

  async _internalResponse(): Promise<Response | null> {
    return this._wrapApiCall(async () => {
      return Response.fromNullable((await this._channel.response()).response);
    }, true);
  }

  frame(): Frame {
    return Frame.from(this._initializer.frame);
  }

  isNavigationRequest(): boolean {
    return this._initializer.isNavigationRequest;
  }

  redirectedFrom(): Request | null {
    return this._redirectedFrom;
  }

  redirectedTo(): Request | null {
    return this._redirectedTo;
  }

  failure(): { errorText: string; } | null {
    if (this._failureText === null)
      return null;
    return {
      errorText: this._failureText
    };
  }

  timing(): ResourceTiming {
    return this._timing;
  }

  async sizes(): Promise<RequestSizes> {
    const response = await this.response();
    if (!response)
      throw new Error('Unable to fetch sizes for failed request');
    return (await response._channel.sizes()).sizes;
  }

  _finalRequest(): Request {
    return this._redirectedTo ? this._redirectedTo._finalRequest() : this;
  }
}

export class Route extends ChannelOwner<channels.RouteChannel> implements api.Route {
  static from(route: channels.RouteChannel): Route {
    return (route as any)._object;
  }

  constructor(parent: ChannelOwner, type: string, guid: string, initializer: channels.RouteInitializer) {
    super(parent, type, guid, initializer);
  }

  request(): Request {
    return Request.from(this._initializer.request);
  }

  private _raceWithPageClose(promise: Promise<any>): Promise<void> {
    const page = this.request().frame()._page;
    // When page closes or crashes, we catch any potential rejects from this Route.
    // Note that page could be missing when routing popup's initial request that
    // does not have a Page initialized just yet.
    return Promise.race([
      promise,
      page ? page._closedOrCrashedPromise : Promise.resolve(),
    ]);
  }

  async abort(errorCode?: string) {
    await this._raceWithPageClose(this._channel.abort({ errorCode }));
  }

  async fulfill(options: { response?: api.APIResponse, status?: number, headers?: Headers, contentType?: string, body?: string | Buffer, path?: string } = {}) {
    let fetchResponseUid;
    let { status: statusOption, headers: headersOption, body } = options;
    if (options.response) {
      statusOption ||= options.response.status();
      headersOption ||= options.response.headers();
      if (options.body === undefined && options.path === undefined && options.response instanceof APIResponse) {
        if (options.response._request._connection === this._connection)
          fetchResponseUid = (options.response as APIResponse)._fetchUid();
        else
          body = await options.response.body();
      }
    }

    let isBase64 = false;
    let length = 0;
    if (options.path) {
      const buffer = await fs.promises.readFile(options.path);
      body = buffer.toString('base64');
      isBase64 = true;
      length = buffer.length;
    } else if (isString(body)) {
      isBase64 = false;
      length = Buffer.byteLength(body);
    } else if (body) {
      length = body.length;
      body = body.toString('base64');
      isBase64 = true;
    }

    const headers: Headers = {};
    for (const header of Object.keys(headersOption || {}))
      headers[header.toLowerCase()] = String(headersOption![header]);
    if (options.contentType)
      headers['content-type'] = String(options.contentType);
    else if (options.path)
      headers['content-type'] = mime.getType(options.path) || 'application/octet-stream';
    if (length && !('content-length' in headers))
      headers['content-length'] = String(length);

    await this._raceWithPageClose(this._channel.fulfill({
      status: statusOption || 200,
      headers: headersObjectToArray(headers),
      body,
      isBase64,
      fetchResponseUid
    }));
  }

  async continue(options: { url?: string, method?: string, headers?: Headers, postData?: string | Buffer } = {}) {
    await this._continue(options);
  }

  async _internalContinue(options: { url?: string, method?: string, headers?: Headers, postData?: string | Buffer } = {}) {
    await this._continue(options, true).catch(() => {});
  }

  private async _continue(options: { url?: string, method?: string, headers?: Headers, postData?: string | Buffer }, isInternal?: boolean) {
    return await this._wrapApiCall(async () => {
      const postDataBuffer = isString(options.postData) ? Buffer.from(options.postData, 'utf8') : options.postData;
      await this._raceWithPageClose(this._channel.continue({
        url: options.url,
        method: options.method,
        headers: options.headers ? headersObjectToArray(options.headers) : undefined,
        postData: postDataBuffer ? postDataBuffer.toString('base64') : undefined,
      }));
    }, isInternal);
  }
}

export type RouteHandlerCallback = (route: Route, request: Request) => void;

export type ResourceTiming = {
  startTime: number;
  domainLookupStart: number;
  domainLookupEnd: number;
  connectStart: number;
  secureConnectionStart: number;
  connectEnd: number;
  requestStart: number;
  responseStart: number;
  responseEnd: number;
};

export type RequestSizes = {
  requestBodySize: number;
  requestHeadersSize: number;
  responseBodySize: number;
  responseHeadersSize: number;
};

export class Response extends ChannelOwner<channels.ResponseChannel> implements api.Response {
  private _provisionalHeaders: RawHeaders;
  private _actualHeadersPromise: Promise<RawHeaders> | undefined;
  private _request: Request;
  readonly _finishedPromise = new ManualPromise<void>();

  static from(response: channels.ResponseChannel): Response {
    return (response as any)._object;
  }

  static fromNullable(response: channels.ResponseChannel | undefined): Response | null {
    return response ? Response.from(response) : null;
  }

  constructor(parent: ChannelOwner, type: string, guid: string, initializer: channels.ResponseInitializer) {
    super(parent, type, guid, initializer);
    this._provisionalHeaders = new RawHeaders(initializer.headers);
    this._request = Request.from(this._initializer.request);
    Object.assign(this._request._timing, this._initializer.timing);
  }

  url(): string {
    return this._initializer.url;
  }

  ok(): boolean {
    // Status 0 is for file:// URLs
    return this._initializer.status === 0 || (this._initializer.status >= 200 && this._initializer.status <= 299);
  }

  status(): number {
    return this._initializer.status;
  }

  statusText(): string {
    return this._initializer.statusText;
  }

  /**
   * @deprecated
   */
  headers(): Headers {
    return this._provisionalHeaders.headers();
  }

  async _actualHeaders(): Promise<RawHeaders> {
    if (!this._actualHeadersPromise) {
      this._actualHeadersPromise = (async () => {
        return new RawHeaders((await this._channel.rawResponseHeaders()).headers);
      })();
    }
    return this._actualHeadersPromise;
  }

  async allHeaders(): Promise<Headers> {
    return (await this._actualHeaders()).headers();
  }

  async headersArray(): Promise<HeadersArray> {
    return (await this._actualHeaders()).headersArray().slice();
  }

  async headerValue(name: string): Promise<string | null> {
    return (await this._actualHeaders()).get(name);
  }

  async headerValues(name: string): Promise<string[]> {
    return (await this._actualHeaders()).getAll(name);
  }

  async finished(): Promise<null> {
    return this._finishedPromise.then(() => null);
  }

  async body(): Promise<Buffer> {
    return Buffer.from((await this._channel.body()).binary, 'base64');
  }

  async text(): Promise<string> {
    const content = await this.body();
    return content.toString('utf8');
  }

  async json(): Promise<object> {
    const content = await this.text();
    return JSON.parse(content);
  }

  request(): Request {
    return this._request;
  }

  frame(): Frame {
    return this._request.frame();
  }

  async serverAddr(): Promise<RemoteAddr|null> {
    return (await this._channel.serverAddr()).value || null;
  }

  async securityDetails(): Promise<SecurityDetails|null> {
    return (await this._channel.securityDetails()).value || null;
  }
}

export class WebSocket extends ChannelOwner<channels.WebSocketChannel> implements api.WebSocket {
  private _page: Page;
  private _isClosed: boolean;

  static from(webSocket: channels.WebSocketChannel): WebSocket {
    return (webSocket as any)._object;
  }

  constructor(parent: ChannelOwner, type: string, guid: string, initializer: channels.WebSocketInitializer) {
    super(parent, type, guid, initializer);
    this._isClosed = false;
    this._page = parent as Page;
    this._channel.on('frameSent', (event: { opcode: number, data: string }) => {
      if (event.opcode === 1)
        this.emit(Events.WebSocket.FrameSent, { payload: event.data });
      else if (event.opcode === 2)
        this.emit(Events.WebSocket.FrameSent, { payload: Buffer.from(event.data, 'base64') });
    });
    this._channel.on('frameReceived', (event: { opcode: number, data: string }) => {
      if (event.opcode === 1)
        this.emit(Events.WebSocket.FrameReceived, { payload: event.data });
      else if (event.opcode === 2)
        this.emit(Events.WebSocket.FrameReceived, { payload: Buffer.from(event.data, 'base64') });
    });
    this._channel.on('socketError', ({ error }) => this.emit(Events.WebSocket.Error, error));
    this._channel.on('close', () => {
      this._isClosed = true;
      this.emit(Events.WebSocket.Close, this);
    });
  }

  url(): string {
    return this._initializer.url;
  }

  isClosed(): boolean {
    return this._isClosed;
  }

  async waitForEvent(event: string, optionsOrPredicate: WaitForEventOptions = {}): Promise<any> {
    return this._wrapApiCall(async () => {
      const timeout = this._page._timeoutSettings.timeout(typeof optionsOrPredicate === 'function' ? {} : optionsOrPredicate);
      const predicate = typeof optionsOrPredicate === 'function' ? optionsOrPredicate : optionsOrPredicate.predicate;
      const waiter = Waiter.createForEvent(this, event);
      waiter.rejectOnTimeout(timeout, `Timeout ${timeout}ms exceeded while waiting for event "${event}"`);
      if (event !== Events.WebSocket.Error)
        waiter.rejectOnEvent(this, Events.WebSocket.Error, new Error('Socket error'));
      if (event !== Events.WebSocket.Close)
        waiter.rejectOnEvent(this, Events.WebSocket.Close, new Error('Socket closed'));
      waiter.rejectOnEvent(this._page, Events.Page.Close, new Error('Page closed'));
      const result = await waiter.waitForEvent(this, event, predicate as any);
      waiter.dispose();
      return result;
    });
  }
}

export function validateHeaders(headers: Headers) {
  for (const key of Object.keys(headers)) {
    const value = headers[key];
    if (!Object.is(value, undefined) && !isString(value))
      throw new Error(`Expected value of header "${key}" to be String, but "${typeof value}" is found.`);
  }
}

export class RouteHandler {
  private handledCount = 0;
  private readonly _baseURL: string | undefined;
  private readonly _times: number;
  readonly url: URLMatch;
  readonly handler: RouteHandlerCallback;

  constructor(baseURL: string | undefined, url: URLMatch, handler: RouteHandlerCallback, times: number = Number.MAX_SAFE_INTEGER) {
    this._baseURL = baseURL;
    this._times = times;
    this.url = url;
    this.handler = handler;
  }

  public matches(requestURL: string): boolean {
    return urlMatches(this._baseURL, requestURL, this.url);
  }

  public handle(route: Route, request: Request): void {
    ++this.handledCount;
    this.handler(route, request);
  }

  public isActive(): boolean {
    return this.handledCount < this._times;
  }
}

export class RawHeaders {
  private _headersArray: HeadersArray;
  private _headersMap = new MultiMap<string, string>();

  constructor(headers: HeadersArray) {
    this._headersArray = headers;
    for (const header of headers)
      this._headersMap.set(header.name.toLowerCase(), header.value);
  }

  get(name: string): string | null {
    const values = this.getAll(name);
    if (!values || !values.length)
      return null;
    return values.join(name.toLowerCase() === 'set-cookie' ? '\n' : ', ');
  }

  getAll(name: string): string[] {
    return [...this._headersMap.get(name.toLowerCase())];
  }

  headers(): Headers {
    const result: Headers = {};
    for (const name of this._headersMap.keys())
      result[name] = this.get(name)!;
    return result;
  }

  headersArray(): HeadersArray {
    return this._headersArray;
  }
}
