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
import * as channels from '../protocol/channels';
import { ChannelOwner } from './channelOwner';
import { Frame } from './frame';
import { Headers, RemoteAddr, SecurityDetails, WaitForEventOptions } from './types';
import fs from 'fs';
import * as mime from 'mime';
import { isString, headersObjectToArray } from '../utils/utils';
import { ManualPromise } from '../utils/async';
import { Events } from './events';
import { Page } from './page';
import { Waiter } from './waiter';
import * as api from '../../types/types';
import { HeadersArray, URLMatch } from '../common/types';
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

export class Request extends ChannelOwner<channels.RequestChannel, channels.RequestInitializer> implements api.Request {
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
    this._postData = initializer.postData ? Buffer.from(initializer.postData, 'base64') : null;
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
      this._actualHeadersPromise = this._wrapApiCall(async (channel: channels.RequestChannel) => {
        return new RawHeaders((await channel.rawRequestHeaders()).headers);
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
    return this._wrapApiCall(async (channel: channels.RequestChannel) => {
      return Response.fromNullable((await channel.response()).response);
    });
  }

  async _internalResponse(): Promise<Response | null> {
    return this._wrapApiCall(async (channel: channels.RequestChannel) => {
      return Response.fromNullable((await channel.response()).response);
    }, undefined, true);
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
    return response._wrapApiCall(async (channel: channels.ResponseChannel) => {
      return (await channel.sizes()).sizes;
    });
  }

  _finalRequest(): Request {
    return this._redirectedTo ? this._redirectedTo._finalRequest() : this;
  }
}

export class Route extends ChannelOwner<channels.RouteChannel, channels.RouteInitializer> implements api.Route {
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
    return this._wrapApiCall(async (channel: channels.RouteChannel) => {
      await this._raceWithPageClose(channel.abort({ errorCode }));
    });
  }

  async fulfill(options: { response?: api.APIResponse, status?: number, headers?: Headers, contentType?: string, body?: string | Buffer, path?: string } = {}) {
    return this._wrapApiCall(async (channel: channels.RouteChannel) => {
      let fetchResponseUid;
      let { status: statusOption, headers: headersOption, body } = options;
      if (options.response) {
        statusOption ||= options.response.status();
        headersOption ||= options.response.headers();
        if (options.body === undefined && options.path === undefined && options.response instanceof APIResponse)
          fetchResponseUid = (options.response as APIResponse)._fetchUid();
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

      await this._raceWithPageClose(channel.fulfill({
        status: statusOption || 200,
        headers: headersObjectToArray(headers),
        body,
        isBase64,
        fetchResponseUid
      }));
    });
  }

  async continue(options: { url?: string, method?: string, headers?: Headers, postData?: string | Buffer } = {}) {
    await this._continue(options);
  }

  async _internalContinue(options: { url?: string, method?: string, headers?: Headers, postData?: string | Buffer } = {}) {
    await this._continue(options, true).catch(() => {});
  }

  private async _continue(options: { url?: string, method?: string, headers?: Headers, postData?: string | Buffer }, isInternal?: boolean) {
    return await this._wrapApiCall(async (channel: channels.RouteChannel) => {
      const postDataBuffer = isString(options.postData) ? Buffer.from(options.postData, 'utf8') : options.postData;
      await this._raceWithPageClose(channel.continue({
        url: options.url,
        method: options.method,
        headers: options.headers ? headersObjectToArray(options.headers) : undefined,
        postData: postDataBuffer ? postDataBuffer.toString('base64') : undefined,
      }));
    }, undefined, isInternal);
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

export class Response extends ChannelOwner<channels.ResponseChannel, channels.ResponseInitializer> implements api.Response {
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
      this._actualHeadersPromise = this._wrapApiCall(async (channel: channels.ResponseChannel) => {
        return new RawHeaders((await channel.rawResponseHeaders()).headers);
      });
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
    return this._wrapApiCall(async (channel: channels.ResponseChannel) => {
      return Buffer.from((await channel.body()).binary, 'base64');
    });
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
    return this._wrapApiCall(async (channel: channels.ResponseChannel) => {
      return (await channel.serverAddr()).value || null;
    });
  }

  async securityDetails(): Promise<SecurityDetails|null> {
    return this._wrapApiCall(async (channel: channels.ResponseChannel) => {
      return (await channel.securityDetails()).value || null;
    });
  }
}

export class WebSocket extends ChannelOwner<channels.WebSocketChannel, channels.WebSocketInitializer> implements api.WebSocket {
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
    return this._wrapApiCall(async (channel: channels.WebSocketChannel) => {
      const timeout = this._page._timeoutSettings.timeout(typeof optionsOrPredicate === 'function' ? {} : optionsOrPredicate);
      const predicate = typeof optionsOrPredicate === 'function' ? optionsOrPredicate : optionsOrPredicate.predicate;
      const waiter = Waiter.createForEvent(channel, event);
      waiter.rejectOnTimeout(timeout, `Timeout while waiting for event "${event}"`);
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

  public handle(route: Route, request: Request): boolean {
    try {
      this.handler(route, request);
    } finally {
      return ++this.handledCount >= this._times;
    }
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
