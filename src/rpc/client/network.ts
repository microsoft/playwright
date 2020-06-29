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
import { RequestChannel, ResponseChannel, RouteChannel, RequestInitializer, ResponseInitializer, RouteInitializer } from '../channels';
import { ChannelOwner } from './channelOwner';
import { Frame } from './frame';
import { Connection } from '../connection';
import { normalizeFulfillParameters } from '../serializers';

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

export class Request extends ChannelOwner<RequestChannel, RequestInitializer> {
  private _redirectedFrom: Request | null = null;
  private _redirectedTo: Request | null = null;
  _failureText: string | null = null;

  static from(request: RequestChannel): Request {
    return request._object;
  }

  static fromNullable(request: RequestChannel | null): Request | null {
    return request ? Request.from(request) : null;
  }

  constructor(connection: Connection, channel: RequestChannel, initializer: RequestInitializer) {
    super(connection, channel, initializer);
    this._redirectedFrom = Request.fromNullable(initializer.redirectedFrom);
    if (this._redirectedFrom)
      this._redirectedFrom._redirectedTo = this;
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
    return this._initializer.postData;
  }

  postDataJSON(): Object | null {
    if (!this._initializer.postData)
      return null;

    const contentType = this.headers()['content-type'];
    if (!contentType)
      return null;

    if (contentType === 'application/x-www-form-urlencoded') {
      const entries: Record<string, string> = {};
      const parsed = new URLSearchParams(this._initializer.postData);
      for (const [k, v] of parsed.entries())
        entries[k] = v;
      return entries;
    }

    return JSON.parse(this._initializer.postData);
  }

  headers(): {[key: string]: string} {
    return { ...this._initializer.headers };
  }

  async response(): Promise<Response | null> {
    return Response.fromNullable(await this._channel.response());
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
}

export class Route extends ChannelOwner<RouteChannel, RouteInitializer> {
  static from(route: RouteChannel): Route {
    return route._object;
  }

  constructor(connection: Connection, channel: RouteChannel, initializer: RouteInitializer) {
    super(connection, channel, initializer);
  }

  request(): Request {
    return Request.from(this._initializer.request);
  }

  async abort(errorCode: string = 'failed') {
    await this._channel.abort({ errorCode });
  }

  async fulfill(response: types.FulfillResponse & { path?: string }) {
    const normalized = await normalizeFulfillParameters(response);
    await this._channel.fulfill({ response: {
      status: normalized.status,
      headers: normalized.headers,
      contentType: normalized.contentType,
      body: (typeof normalized.body === 'string' ? Buffer.from(normalized.body) : normalized.body).toString('base64')
    }});
  }

  async continue(overrides: { method?: string; headers?: types.Headers; postData?: string } = {}) {
    await this._channel.continue({ overrides });
  }
}

export type RouteHandler = (route: Route, request: Request) => void;

export class Response extends ChannelOwner<ResponseChannel, ResponseInitializer> {
  static from(response: ResponseChannel): Response {
    return response._object;
  }

  static fromNullable(response: ResponseChannel | null): Response | null {
    return response ? Response.from(response) : null;
  }

  constructor(connection: Connection, channel: ResponseChannel, initializer: ResponseInitializer) {
    super(connection, channel, initializer);
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

  headers(): object {
    return { ...this._initializer.headers };
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
    return Request.from(this._initializer.request);
  }

  frame(): Frame {
    return Request.from(this._initializer.request).frame();
  }
}
