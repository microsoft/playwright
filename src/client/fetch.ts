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

import { ReadStream } from 'fs';
import path from 'path';
import * as mime from 'mime';
import { Serializable } from '../../types/structs';
import * as api from '../../types/types';
import { HeadersArray } from '../common/types';
import * as channels from '../protocol/channels';
import { kBrowserOrContextClosedError } from '../utils/errors';
import { assert, headersObjectToArray, isString, objectToArray } from '../utils/utils';
import { ChannelOwner } from './channelOwner';
import * as network from './network';
import { RawHeaders } from './network';
import { FilePayload, Headers } from './types';

export type FetchOptions = {
  params?: { [key: string]: string; },
  method?: string,
  headers?: Headers,
  data?: string | Buffer | Serializable,
  timeout?: number,
  failOnStatusCode?: boolean,
};

export class FetchRequest extends ChannelOwner<channels.FetchRequestChannel, channels.FetchRequestInitializer> implements api.FetchRequest {
  static from(channel: channels.FetchRequestChannel): FetchRequest {
    return (channel as any)._object;
  }

  constructor(parent: ChannelOwner, type: string, guid: string, initializer: channels.FetchRequestInitializer) {
    super(parent, type, guid, initializer);
  }

  dispose(): Promise<void> {
    return this._wrapApiCall(async (channel: channels.FetchRequestChannel) => {
      await channel.dispose();
    });
  }

  async get(
    urlOrRequest: string | api.Request,
    options?: {
      params?: { [key: string]: string; };
      headers?: { [key: string]: string; };
      timeout?: number;
      failOnStatusCode?: boolean;
    }): Promise<FetchResponse> {
    return this.fetch(urlOrRequest, {
      ...options,
      method: 'GET',
    });
  }

  async post(
    urlOrRequest: string | api.Request,
    options?: {
      params?: { [key: string]: string; };
      headers?: { [key: string]: string; };
      data?: string | Buffer | Serializable;
      timeout?: number;
      failOnStatusCode?: boolean;
    }): Promise<FetchResponse> {
    return this.fetch(urlOrRequest, {
      ...options,
      method: 'POST',
    });
  }

  async fetch(urlOrRequest: string | api.Request, options: FetchOptions = {}): Promise<FetchResponse> {
    return this._wrapApiCall(async (channel: channels.FetchRequestChannel) => {
      const request: network.Request | undefined = (urlOrRequest instanceof network.Request) ? urlOrRequest as network.Request : undefined;
      assert(request || typeof urlOrRequest === 'string', 'First argument must be either URL string or Request');
      const url = request ? request.url() : urlOrRequest as string;
      const params = objectToArray(options.params);
      const method = options.method || request?.method();
      // Cannot call allHeaders() here as the request may be paused inside route handler.
      let headersObj = options.headers || request?.headers() ;
      let formData: channels.FormField[] | undefined;
      let postDataBuffer: Buffer | undefined;
      if (options.data) {
        if (isString(options.data)) {
          postDataBuffer = Buffer.from(options.data, 'utf8');
        } else if (Buffer.isBuffer(options.data)) {
          postDataBuffer = options.data;
        } else {
          let contentTypeHeaderName = 'content-type';
          let contentType = 'application/json';
          if (headersObj) {
            for (const [name, value] of Object.entries(headersObj)) {
              if (name.toLocaleLowerCase() === 'content-type') {
                contentTypeHeaderName = name;
                contentType = value;
                break;
              }
            }
          }
          if (contentType === 'application/json') {
            const json = JSON.stringify(options.data);
            postDataBuffer = Buffer.from(json, 'utf8');
            if (!headersObj?.[contentTypeHeaderName]) {
              headersObj ??= {};
              headersObj[contentTypeHeaderName] = contentType;
            }
          } else if (contentType === 'application/x-www-form-urlencoded') {
            formData = [];
            for (const [name, value] of Object.entries(options.data))
              formData.push({name, value: String(value)});
          } else if (contentType === 'multipart/form-data') {
            formData = [];
            for (const [name, value] of Object.entries(options.data)) {
              if (typeof value === 'object' && (value as any)?.['name'] && (value as any)?.['mimeType'] && (value as any)?.['buffer']) {
                const payload = value as FilePayload;
                if (!Buffer.isBuffer(payload.buffer))
                  throw new Error(`Unexpected buffer type of 'data.${name}'`);
                formData.push({
                  name,
                  file: {
                    name: payload.name,
                    mimeType: payload.mimeType,
                    buffer: payload.buffer.toString('base64'),
                  }
                });
              } else if (value instanceof ReadStream) {
                const stream = value as ReadStream;
                const buffer = await new Promise<Buffer>((resolve, reject) => {
                  const chunks: Buffer[] = [];
                  stream.on('data', chunk => chunks.push(chunk));
                  stream.on('end', () => resolve(Buffer.concat(chunks)));
                  stream.on('error', err => reject(err));
                });
                const streamPath: string = Buffer.isBuffer(stream.path) ? stream.path.toString('utf8') : stream.path;
                formData.push({
                  name,
                  file: {
                    name: path.basename(streamPath),
                    mimeType: mime.getType(streamPath) || 'application/octet-stream',
                    buffer: buffer.toString('base64'),
                  }
                });
              } else {
                formData.push({name, value: String(value)});
              }
            }
          } else {
            throw new Error(`Cannot serialize data using content type: ${contentType}`);
          }
        }
        if (postDataBuffer === undefined && formData === undefined)
          postDataBuffer = request?.postDataBuffer() || undefined;
      }
      const headers = headersObj ? headersObjectToArray(headersObj) : undefined;
      const postData = (postDataBuffer ? postDataBuffer.toString('base64') : undefined);
      const result = await channel.fetch({
        url,
        params,
        method,
        headers,
        postData,
        formData,
        timeout: options.timeout,
        failOnStatusCode: options.failOnStatusCode,
      });
      if (result.error)
        throw new Error(`Request failed: ${result.error}`);
      return new FetchResponse(this, result.response!);
    });
  }
}

export class FetchResponse implements api.FetchResponse {
  private readonly _initializer: channels.FetchResponse;
  private readonly _headers: RawHeaders;
  private readonly _request: FetchRequest;

  constructor(context: FetchRequest, initializer: channels.FetchResponse) {
    this._request = context;
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
    return this._request._wrapApiCall(async (channel: channels.FetchRequestChannel) => {
      try {
        const result = await channel.fetchResponseBody({ fetchUid: this._fetchUid() });
        if (!result.binary)
          throw new Error('Response has been disposed');
        return Buffer.from(result.binary!, 'base64');
      } catch (e) {
        if (e.message === kBrowserOrContextClosedError)
          throw new Error('Response has been disposed');
        throw e;
      }
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
    return this._request._wrapApiCall(async (channel: channels.FetchRequestChannel) => {
      await channel.disposeFetchResponse({ fetchUid: this._fetchUid() });
    });
  }

  _fetchUid(): string {
    return this._initializer.fetchUid;
  }
}
