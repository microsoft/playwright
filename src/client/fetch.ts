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

import * as api from '../../types/types';
import { HeadersArray } from '../common/types';
import * as channels from '../protocol/channels';
import { assert, headersObjectToArray, isString } from '../utils/utils';
import { BrowserContext } from './browserContext';
import * as network from './network';
import { RawHeaders } from './network';
import { Headers } from './types';

export type FetchOptions = { method?: string, headers?: Headers, data?: string | Buffer, timeout?: number };

export class FetchRequest implements api.FetchRequest {
  private _context: BrowserContext;

  constructor(context: BrowserContext) {
    this._context = context;
  }

  async get(
    urlOrRequest: string | api.Request,
    options?: {
      headers?: { [key: string]: string; };
      timeout?: number;
    }): Promise<FetchResponse> {
    return this.fetch(urlOrRequest, {
      ...options,
      method: 'GET',
    });
  }

  async post(
    urlOrRequest: string | api.Request,
    options?: {
      headers?: { [key: string]: string; };
      data?: string | Buffer;
      timeout?: number;
    }): Promise<FetchResponse> {
    return this.fetch(urlOrRequest, {
      ...options,
      method: 'POST',
    });
  }

  async fetch(urlOrRequest: string | api.Request, options: FetchOptions = {}): Promise<FetchResponse> {
    return this._context._wrapApiCall(async (channel: channels.BrowserContextChannel) => {
      const request: network.Request | undefined = (urlOrRequest instanceof network.Request) ? urlOrRequest as network.Request : undefined;
      assert(request || typeof urlOrRequest === 'string', 'First argument must be either URL string or Request');
      const url = request ? request.url() : urlOrRequest as string;
      const method = options.method || request?.method();
      // Cannot call allHeaders() here as the request may be paused inside route handler.
      const headersObj = options.headers || request?.headers() ;
      const headers = headersObj ? headersObjectToArray(headersObj) : undefined;
      let postDataBuffer = isString(options.data) ? Buffer.from(options.data, 'utf8') : options.data;
      if (postDataBuffer === undefined)
        postDataBuffer = request?.postDataBuffer() || undefined;
      const postData = (postDataBuffer ? postDataBuffer.toString('base64') : undefined);
      const result = await channel.fetch({
        url,
        method,
        headers,
        postData,
        timeout: options.timeout,
      });
      if (result.error)
        throw new Error(`Request failed: ${result.error}`);
      return new FetchResponse(this._context, result.response!);
    });
  }
}

export class FetchResponse implements api.FetchResponse {
  private readonly _initializer: channels.FetchResponse;
  private readonly _headers: RawHeaders;
  private readonly _context: BrowserContext;

  constructor(context: BrowserContext, initializer: channels.FetchResponse) {
    this._context = context;
    this._initializer = initializer;
    this._headers = new RawHeaders(this._initializer.headers);
  }

  ok(): boolean {
    return this._initializer.status === 0 || (this._initializer.status >= 200 && this._initializer.status <= 299);
  }

  url(): string {
    return this._initializer.url;
  }

  status(): number {
    return this._initializer.status;
  }

  statusText(): string {
    return this._initializer.statusText;
  }

  headers(): Headers {
    return this._headers.headers();
  }

  headersArray(): HeadersArray {
    return this._headers.headersArray();
  }

  async body(): Promise<Buffer> {
    return this._context._wrapApiCall(async (channel: channels.BrowserContextChannel) => {
      const result = await channel.fetchResponseBody({ fetchUid: this._fetchUid() });
      if (!result.binary)
        throw new Error('Response has been disposed');
      return Buffer.from(result.binary!, 'base64');
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

  async dispose(): Promise<void> {
    return this._context._wrapApiCall(async (channel: channels.BrowserContextChannel) => {
      await channel.disposeFetchResponse({ fetchUid: this._fetchUid() });
    });
  }

  _fetchUid(): string {
    return this._initializer.fetchUid;
  }
}
