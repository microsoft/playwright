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
import * as types from '../../types';
import { RequestChannel, ResponseChannel, FrameChannel, RouteChannel } from '../channels';
import { ChannelOwner } from './channelOwner';
import { Frame } from './frame';
import { Connection } from '../connection';

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

export class Request extends ChannelOwner<RequestChannel> {
  private _redirectedFrom: Request | null = null;
  private _redirectedTo: Request | null = null;
  private _isNavigationRequest = false;
  _failureText: string | null = null;
  private _url: string = '';
  private _resourceType = '';
  private _method = '';
  private _postData: string | null = null;
  private _headers: types.Headers = {};
  private _frame: Frame | undefined;

  static from(request: RequestChannel): Request {
    return request._object;
  }

  static fromNullable(request: RequestChannel | null): Request | null {
    return request ? Request.from(request) : null;
  }

  constructor(connection: Connection, channel: RequestChannel) {
    super(connection, channel);
  }

  _initialize(payload: { frame: FrameChannel, redirectedFrom: RequestChannel | null, isNavigationRequest: boolean,
      url: string, resourceType: string, method: string, postData: string | null, headers: types.Headers }) {
    this._frame = payload.frame._object as Frame;
    this._isNavigationRequest = payload.isNavigationRequest;
    this._redirectedFrom = Request.fromNullable(payload.redirectedFrom);
    if (this._redirectedFrom)
      this._redirectedFrom._redirectedTo = this;
    this._url = payload.url;
    this._resourceType = payload.resourceType;
    this._method = payload.method;
    this._postData = payload.postData;
    this._headers = payload.headers;
  }

  url(): string {
    return this._url;
  }

  resourceType(): string {
    return this._resourceType;
  }

  method(): string {
    return this._method;
  }

  postData(): string | null {
    return this._postData;
  }

  postDataJSON(): Object | null {
    if (!this._postData)
      return null;

    const contentType = this.headers()['content-type'];
    if (!contentType)
      return null;

    if (contentType === 'application/x-www-form-urlencoded') {
      const entries: Record<string, string> = {};
      const parsed = new URLSearchParams(this._postData);
      for (const [k, v] of parsed.entries())
        entries[k] = v;
      return entries;
    }

    return JSON.parse(this._postData);
  }

  headers(): {[key: string]: string} {
    return { ...this._headers };
  }

  async response(): Promise<Response | null> {
    return Response.fromNullable(await this._channel.response());
  }

  frame(): Frame {
    return this._frame!;
  }

  isNavigationRequest(): boolean {
    return this._isNavigationRequest;
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
}

export class Route extends ChannelOwner<RouteChannel> {
  private _request: Request | undefined;

  static from(route: RouteChannel): Route {
    return route._object;
  }

  constructor(connection: Connection, channel: RouteChannel) {
    super(connection, channel);
  }

  _initialize(params: { request: RequestChannel }) {
    this._request = Request.from(params.request);
  }

  request(): Request {
    return this._request!;
  }

  async abort(errorCode: string = 'failed') {
    await this._channel.abort({ errorCode });
  }

  async fulfill(response: types.FulfillResponse & { path?: string }) {
    await this._channel.fulfill({ response });
  }

  async continue(overrides: { method?: string; headers?: types.Headers; postData?: string } = {}) {
    await this._channel.continue({ overrides });
  }
}

export type RouteHandler = (route: Route, request: Request) => void;

export class Response extends ChannelOwner<ResponseChannel> {
  private _request: Request | undefined;
  private _status: number = 0;
  private _statusText: string = '';
  private _url: string = '';
  private _headers: types.Headers = {};

  static from(response: ResponseChannel): Response {
    return response._object;
  }

  static fromNullable(response: ResponseChannel | null): Response | null {
    return response ? Response.from(response) : null;
  }

  constructor(connection: Connection, channel: ResponseChannel) {
    super(connection, channel);
  }

  _initialize(payload: { request: RequestChannel, url: string, status: number, statusText: string, headers: types.Headers }) {
    this._request = Request.from(payload.request);
    this._status = payload.status;
    this._statusText = payload.statusText;
    this._url = payload.url;
    this._headers = payload.headers;
  }

  url(): string {
    return this._url;
  }

  ok(): boolean {
    return this._status === 0 || (this._status >= 200 && this._status <= 299);
  }

  status(): number {
    return this._status;
  }

  statusText(): string {
    return this._statusText;
  }

  headers(): object {
    return { ...this._headers };
  }

  async finished(): Promise<Error | null> {
    return await this._channel.finished();
  }

  async body(): Promise<Buffer> {
    return await this._channel.body();
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
    return this._request!;
  }

  frame(): Frame {
    return this._request!.frame();
  }
}
