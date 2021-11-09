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

import fs from 'fs';
import path from 'path';
import * as mime from 'mime';
import { Serializable } from '../../types/structs';
import * as api from '../../types/types';
import { HeadersArray } from '../common/types';
import * as channels from '../protocol/channels';
import { kBrowserOrContextClosedError } from '../utils/errors';
import { assert, headersObjectToArray, isFilePayload, isString, mkdirIfNeeded, objectToArray } from '../utils/utils';
import { ChannelOwner } from './channelOwner';
import * as network from './network';
import { RawHeaders } from './network';
import { FilePayload, Headers, StorageState } from './types';
import { Playwright } from './playwright';

export type FetchOptions = {
  params?: { [key: string]: string; },
  method?: string,
  headers?: Headers,
  data?: string | Buffer | Serializable,
  form?: { [key: string]: string|number|boolean; };
  multipart?: { [key: string]: string|number|boolean|fs.ReadStream|FilePayload; };
  timeout?: number,
  failOnStatusCode?: boolean,
  ignoreHTTPSErrors?: boolean,
};

type NewContextOptions = Omit<channels.PlaywrightNewRequestOptions, 'extraHTTPHeaders' | 'storageState'> & {
  extraHTTPHeaders?: Headers,
  storageState?: string | StorageState,
};

type RequestWithBodyOptions = Omit<FetchOptions, 'method'>;
type RequestWithoutBodyOptions = Omit<RequestWithBodyOptions, 'data'|'form'|'multipart'>;

export class APIRequest implements api.APIRequest {
  private _playwright: Playwright;
  constructor(playwright: Playwright) {
    this._playwright = playwright;
  }

  async newContext(options: NewContextOptions = {}): Promise<APIRequestContext> {
    return await this._playwright._wrapApiCall(async (channel: channels.PlaywrightChannel) => {
      const storageState = typeof options.storageState === 'string' ?
        JSON.parse(await fs.promises.readFile(options.storageState, 'utf8')) :
        options.storageState;
      return APIRequestContext.from((await channel.newRequest({
        ...options,
        extraHTTPHeaders: options.extraHTTPHeaders ? headersObjectToArray(options.extraHTTPHeaders) : undefined,
        storageState,
      })).request);
    });
  }
}

export class APIRequestContext extends ChannelOwner<channels.APIRequestContextChannel, channels.APIRequestContextInitializer> implements api.APIRequestContext {
  static from(channel: channels.APIRequestContextChannel): APIRequestContext {
    return (channel as any)._object;
  }

  constructor(parent: ChannelOwner, type: string, guid: string, initializer: channels.APIRequestContextInitializer) {
    super(parent, type, guid, initializer);
  }

  dispose(): Promise<void> {
    return this._wrapApiCall(async (channel: channels.APIRequestContextChannel) => {
      await channel.dispose();
    });
  }

  async delete(url: string, options?: RequestWithBodyOptions): Promise<APIResponse> {
    return this.fetch(url, {
      ...options,
      method: 'DELETE',
    });
  }

  async head(url: string, options?: RequestWithoutBodyOptions): Promise<APIResponse> {
    return this.fetch(url, {
      ...options,
      method: 'HEAD',
    });
  }

  async get(url: string, options?: RequestWithoutBodyOptions): Promise<APIResponse> {
    return this.fetch(url, {
      ...options,
      method: 'GET',
    });
  }

  async patch(url: string, options?: RequestWithBodyOptions): Promise<APIResponse> {
    return this.fetch(url, {
      ...options,
      method: 'PATCH',
    });
  }

  async post(url: string, options?: RequestWithBodyOptions): Promise<APIResponse> {
    return this.fetch(url, {
      ...options,
      method: 'POST',
    });
  }

  async put(url: string, options?: RequestWithBodyOptions): Promise<APIResponse> {
    return this.fetch(url, {
      ...options,
      method: 'PUT',
    });
  }

  async fetch(urlOrRequest: string | api.Request, options: FetchOptions = {}): Promise<APIResponse> {
    return this._wrapApiCall(async (channel: channels.APIRequestContextChannel) => {
      const request: network.Request | undefined = (urlOrRequest instanceof network.Request) ? urlOrRequest as network.Request : undefined;
      assert(request || typeof urlOrRequest === 'string', 'First argument must be either URL string or Request');
      assert((options.data === undefined ? 0 : 1) + (options.form === undefined ? 0 : 1) + (options.multipart === undefined ? 0 : 1) <= 1, `Only one of 'data', 'form' or 'multipart' can be specified`);
      const url = request ? request.url() : urlOrRequest as string;
      const params = objectToArray(options.params);
      const method = options.method || request?.method();
      // Cannot call allHeaders() here as the request may be paused inside route handler.
      const headersObj = options.headers || request?.headers() ;
      const headers = headersObj ? headersObjectToArray(headersObj) : undefined;
      let jsonData: any;
      let formData: channels.NameValue[] | undefined;
      let multipartData: channels.FormField[] | undefined;
      let postDataBuffer: Buffer | undefined;
      if (options.data !== undefined) {
        if (isString(options.data))
          postDataBuffer = Buffer.from(options.data, 'utf8');
        else if (Buffer.isBuffer(options.data))
          postDataBuffer = options.data;
        else if (typeof options.data === 'object')
          jsonData = options.data;
        else
          throw new Error(`Unexpected 'data' type`);
      } else if (options.form) {
        formData = objectToArray(options.form);
      } else if (options.multipart) {
        multipartData = [];
        // Convert file-like values to ServerFilePayload structs.
        for (const [name, value] of Object.entries(options.multipart)) {
          if (isFilePayload(value)) {
            const payload = value as FilePayload;
            if (!Buffer.isBuffer(payload.buffer))
              throw new Error(`Unexpected buffer type of 'data.${name}'`);
            multipartData.push({ name, file: filePayloadToJson(payload) });
          } else if (value instanceof fs.ReadStream) {
            multipartData.push({ name, file: await readStreamToJson(value as fs.ReadStream) });
          } else {
            multipartData.push({ name, value: String(value) });
          }
        }
      }
      if (postDataBuffer === undefined && jsonData === undefined && formData === undefined && multipartData === undefined)
        postDataBuffer = request?.postDataBuffer() || undefined;
      const postData = (postDataBuffer ? postDataBuffer.toString('base64') : undefined);
      const result = await channel.fetch({
        url,
        params,
        method,
        headers,
        postData,
        jsonData,
        formData,
        multipartData,
        timeout: options.timeout,
        failOnStatusCode: options.failOnStatusCode,
        ignoreHTTPSErrors: options.ignoreHTTPSErrors,
      });
      if (result.error)
        throw new Error(result.error);
      return new APIResponse(this, result.response!);
    });
  }

  async storageState(options: { path?: string } = {}): Promise<StorageState> {
    return await this._wrapApiCall(async (channel: channels.APIRequestContextChannel) => {
      const state = await channel.storageState();
      if (options.path) {
        await mkdirIfNeeded(options.path);
        await fs.promises.writeFile(options.path, JSON.stringify(state, undefined, 2), 'utf8');
      }
      return state;
    });
  }
}

export class APIResponse implements api.APIResponse {
  private readonly _initializer: channels.APIResponse;
  private readonly _headers: RawHeaders;
  private readonly _request: APIRequestContext;

  constructor(context: APIRequestContext, initializer: channels.APIResponse) {
    this._request = context;
    this._initializer = initializer;
    this._headers = new RawHeaders(this._initializer.headers);
  }

  ok(): boolean {
    return this._initializer.status >= 200 && this._initializer.status <= 299;
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
    return this._request._wrapApiCall(async (channel: channels.APIRequestContextChannel) => {
      try {
        const result = await channel.fetchResponseBody({ fetchUid: this._fetchUid() });
        if (result.binary === undefined)
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
    return this._request._wrapApiCall(async (channel: channels.APIRequestContextChannel) => {
      await channel.disposeAPIResponse({ fetchUid: this._fetchUid() });
    });
  }

  _fetchUid(): string {
    return this._initializer.fetchUid;
  }
}

type ServerFilePayload = {
  name: string,
  mimeType: string,
  buffer: string,
};

function filePayloadToJson(payload: FilePayload): ServerFilePayload {
  return {
    name: payload.name,
    mimeType: payload.mimeType,
    buffer: payload.buffer.toString('base64'),
  };
}

async function readStreamToJson(stream: fs.ReadStream): Promise<ServerFilePayload> {
  const buffer = await new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', chunk => chunks.push(chunk as Buffer));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', err => reject(err));
  });
  const streamPath: string = Buffer.isBuffer(stream.path) ? stream.path.toString('utf8') : stream.path;
  return {
    name: path.basename(streamPath),
    mimeType: mime.getType(streamPath) || 'application/octet-stream',
    buffer: buffer.toString('base64'),
  };
}