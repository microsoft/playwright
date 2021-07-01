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
import { isString, headersObjectToArray, headersArrayToObject } from '../utils/utils';
import { Events } from './events';
import { Page } from './page';
import { Waiter } from './waiter';
import * as api from '../../types/types';

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
  _headers: Headers;
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
    this._headers = headersArrayToObject(initializer.headers, true /* lowerCase */);
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

  headers(): Headers {
    return { ...this._headers };
  }

  async response(): Promise<Response | null> {
    return this._wrapApiCall(async (channel: channels.RequestChannel) => {
      return Response.fromNullable((await channel.response()).response);
    });
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

  _finalRequest(): Request {
    return this._redirectedTo ? this._redirectedTo._finalRequest() : this;
  }
}

export class InterceptedResponse implements api.Response {
  private readonly _route: Route;
  private readonly _initializer: channels.InterceptedResponse;
  private readonly _request: Request;
  private readonly _headers: Headers;

  constructor(route: Route, initializer: channels.InterceptedResponse) {
    this._route = route;
    this._initializer = initializer;
    this._headers = headersArrayToObject(initializer.headers, true /* lowerCase */);
    this._request = Request.from(initializer.request);
  }

  async securityDetails(): Promise<{ issuer?: string | undefined; protocol?: string | undefined; subjectName?: string | undefined; validFrom?: number | undefined; validTo?: number | undefined; } | null> {
    return null;
  }

  async serverAddr(): Promise<{ ipAddress: string; port: number; } | null> {
    return null;
  }

  async finished(): Promise<Error | null> {
    const response = await this._request.response();
    if (!response)
      return null;
    return await response.finished();
  }

  frame(): api.Frame {
    return this._request.frame();
  }

  ok(): boolean {
    return this._initializer.status === 0 || (this._initializer.status >= 200 && this._initializer.status <= 299);
  }

  url(): string {
    return this._request.url();
  }

  status(): number {
    return this._initializer.status;
  }

  statusText(): string {
    return this._initializer.statusText;
  }

  headers(): Headers {
    return { ...this._headers };
  }

  async body(): Promise<Buffer> {
    return this._route._responseBody();
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
}

type InterceptResponse = true;
type NotInterceptResponse = false;

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

  async abort(errorCode?: string) {
    return this._wrapApiCall(async (channel: channels.RouteChannel) => {
      await channel.abort({ errorCode });
    });
  }

  async fulfill(options: { status?: number, headers?: Headers, contentType?: string, body?: string | Buffer, path?: string } = {}) {
    return this._wrapApiCall(async (channel: channels.RouteChannel) => {
      let body = '';
      let isBase64 = false;
      let length = 0;
      if (options.path) {
        const buffer = await fs.promises.readFile(options.path);
        body = buffer.toString('base64');
        isBase64 = true;
        length = buffer.length;
      } else if (isString(options.body)) {
        body = options.body;
        isBase64 = false;
        length = Buffer.byteLength(body);
      } else if (options.body) {
        body = options.body.toString('base64');
        isBase64 = true;
        length = options.body.length;
      }

      const headers: Headers = {};
      for (const header of Object.keys(options.headers || {}))
        headers[header.toLowerCase()] = String(options.headers![header]);
      if (options.contentType)
        headers['content-type'] = String(options.contentType);
      else if (options.path)
        headers['content-type'] = mime.getType(options.path) || 'application/octet-stream';
      if (length && !('content-length' in headers))
        headers['content-length'] = String(length);

      await channel.fulfill({
        status: options.status || 200,
        headers: headersObjectToArray(headers),
        body,
        isBase64
      });
    });
  }

  async _intercept(options: { url?: string, method?: string, headers?: Headers, postData?: string | Buffer, interceptResponse?: boolean } = {}): Promise<api.Response> {
    return await this._continue(options, true);
  }

  async continue(options: { url?: string, method?: string, headers?: Headers, postData?: string | Buffer } = {}) {
    await this._continue(options, false);
  }

  async _continue(options: { url?: string, method?: string, headers?: Headers, postData?: string | Buffer }, interceptResponse: NotInterceptResponse): Promise<null>;
  async _continue(options: { url?: string, method?: string, headers?: Headers, postData?: string | Buffer }, interceptResponse: InterceptResponse): Promise<api.Response>;
  async _continue(options: { url?: string, method?: string, headers?: Headers, postData?: string | Buffer }, interceptResponse: boolean): Promise<null|api.Response> {
    return await this._wrapApiCall(async (channel: channels.RouteChannel) => {
      const postDataBuffer = isString(options.postData) ? Buffer.from(options.postData, 'utf8') : options.postData;
      const result = await channel.continue({
        url: options.url,
        method: options.method,
        headers: options.headers ? headersObjectToArray(options.headers) : undefined,
        postData: postDataBuffer ? postDataBuffer.toString('base64') : undefined,
        interceptResponse,
      });
      if (result.response)
        return new InterceptedResponse(this, result.response);
      return null;
    });
  }

  async _responseBody(): Promise<Buffer> {
    return this._wrapApiCall(async (channel: channels.RouteChannel) => {
      return Buffer.from((await channel.responseBody()).binary, 'base64');
    });
  }
}

export type RouteHandler = (route: Route, request: Request) => void;

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

export class Response extends ChannelOwner<channels.ResponseChannel, channels.ResponseInitializer> implements api.Response {
  private _headers: Headers;
  private _request: Request;

  static from(response: channels.ResponseChannel): Response {
    return (response as any)._object;
  }

  static fromNullable(response: channels.ResponseChannel | undefined): Response | null {
    return response ? Response.from(response) : null;
  }

  constructor(parent: ChannelOwner, type: string, guid: string, initializer: channels.ResponseInitializer) {
    super(parent, type, guid, initializer);
    this._headers = headersArrayToObject(initializer.headers, true /* lowerCase */);
    this._request = Request.from(this._initializer.request);
    this._request._headers = headersArrayToObject(initializer.requestHeaders, true /* lowerCase */);
    Object.assign(this._request._timing, this._initializer.timing);
  }

  url(): string {
    return this._initializer.url;
  }

  ok(): boolean {
    return this._initializer.status === 0 || (this._initializer.status >= 200 && this._initializer.status <= 299);
  }

  status(): number {
    return this._initializer.status;
  }

  statusText(): string {
    return this._initializer.statusText;
  }

  headers(): Headers {
    return { ...this._headers };
  }

  async finished(): Promise<Error | null> {
    return this._wrapApiCall(async (channel: channels.ResponseChannel) => {
      const result = await channel.finished();
      if (result.error)
        return new Error(result.error);
      return null;
    });
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
      const waiter = Waiter.createForEvent(this, event);
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
