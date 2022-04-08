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
import * as util from 'util';
import type { Serializable } from '../../types/structs';
import type * as api from '../../types/types';
import type { HeadersArray } from '../common/types';
import type * as channels from '../protocol/channels';
import { kBrowserOrContextClosedError } from '../common/errors';
import { assert, headersObjectToArray, isFilePayload, isString, objectToArray } from '../utils';
import { mkdirIfNeeded } from '../utils/fileUtils';
import { ChannelOwner } from './channelOwner';
import * as network from './network';
import { RawHeaders } from './network';
import type { FilePayload, Headers, StorageState } from './types';
import type { Playwright } from './playwright';
import { createInstrumentation } from './clientInstrumentation';
import { Tracing } from './tracing';

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
  readonly _contexts = new Set<APIRequestContext>();

  // Instrumentation.
  _onDidCreateContext?: (context: APIRequestContext) => Promise<void>;
  _onWillCloseContext?: (context: APIRequestContext) => Promise<void>;

  constructor(playwright: Playwright) {
    this._playwright = playwright;
  }

  async newContext(options: NewContextOptions = {}): Promise<APIRequestContext> {
    const storageState = typeof options.storageState === 'string' ?
      JSON.parse(await fs.promises.readFile(options.storageState, 'utf8')) :
      options.storageState;
    const context = APIRequestContext.from((await this._playwright._channel.newRequest({
      ...options,
      extraHTTPHeaders: options.extraHTTPHeaders ? headersObjectToArray(options.extraHTTPHeaders) : undefined,
      storageState,
    })).request);
    context._tracing._localUtils = this._playwright._utils;
    this._contexts.add(context);
    context._request = this;
    await this._onDidCreateContext?.(context);
    return context;
  }
}

export class APIRequestContext extends ChannelOwner<channels.APIRequestContextChannel> implements api.APIRequestContext {
  _request?: APIRequest;
  readonly _tracing: Tracing;

  static from(channel: channels.APIRequestContextChannel): APIRequestContext {
    return (channel as any)._object;
  }

  constructor(parent: ChannelOwner, type: string, guid: string, initializer: channels.APIRequestContextInitializer) {
    super(parent, type, guid, initializer, createInstrumentation());
    this._tracing = Tracing.from(initializer.tracing);
  }

  async dispose(): Promise<void> {
    await this._request?._onWillCloseContext?.(this);
    await this._channel.dispose();
    this._request?._contexts.delete(this);
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
    return this._wrapApiCall(async () => {
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
        if (isString(options.data)) {
          if (isJsonContentType(headers))
            jsonData = options.data;
          else
            postDataBuffer = Buffer.from(options.data, 'utf8');
        } else if (Buffer.isBuffer(options.data)) {
          postDataBuffer = options.data;
        } else if (typeof options.data === 'object' || typeof options.data === 'number' || typeof options.data === 'boolean') {
          jsonData = options.data;
        } else {
          throw new Error(`Unexpected 'data' type`);
        }
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
      const result = await this._channel.fetch({
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
      return new APIResponse(this, result.response);
    });
  }

  async storageState(options: { path?: string } = {}): Promise<StorageState> {
    const state = await this._channel.storageState();
    if (options.path) {
      await mkdirIfNeeded(options.path);
      await fs.promises.writeFile(options.path, JSON.stringify(state, undefined, 2), 'utf8');
    }
    return state;
  }
}

export class APIResponse implements api.APIResponse {
  private readonly _initializer: channels.APIResponse;
  private readonly _headers: RawHeaders;
  readonly _request: APIRequestContext;

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
    try {
      const result = await this._request._channel.fetchResponseBody({ fetchUid: this._fetchUid() });
      if (result.binary === undefined)
        throw new Error('Response has been disposed');
      return Buffer.from(result.binary!, 'base64');
    } catch (e) {
      if (e.message.includes(kBrowserOrContextClosedError))
        throw new Error('Response has been disposed');
      throw e;
    }
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
    await this._request._channel.disposeAPIResponse({ fetchUid: this._fetchUid() });
  }

  [util.inspect.custom]() {
    const headers = this.headersArray().map(({ name, value }) => `  ${name}: ${value}`);
    return `APIResponse: ${this.status()} ${this.statusText()}\n${headers.join('\n')}`;
  }

  _fetchUid(): string {
    return this._initializer.fetchUid;
  }

  async _fetchLog(): Promise<string[]> {
    const { log } = await this._request._channel.fetchLog({ fetchUid: this._fetchUid() });
    return log;
  }
}

type ServerFilePayload = NonNullable<channels.FormField['file']>;

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
    buffer: buffer.toString('base64'),
  };
}

function isJsonContentType(headers?: HeadersArray): boolean {
  if (!headers)
    return false;
  for (const { name, value } of headers) {
    if (name.toLocaleLowerCase() === 'content-type')
      return value === 'application/json';
  }
  return false;
}