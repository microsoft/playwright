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

import { toClientCertificatesProtocol } from './browserContext';
import { ChannelOwner } from './channelOwner';
import { TargetClosedError, isTargetClosedError } from './errors';
import { RawHeaders } from './network';
import { Tracing } from './tracing';
import { assert } from '../utils/isomorphic/assert';
import { mkdirIfNeeded } from './fileUtils';
import { headersObjectToArray } from '../utils/isomorphic/headers';
import { isString } from '../utils/isomorphic/rtti';
import { TimeoutSettings } from './timeoutSettings';

import type { Playwright } from './playwright';
import type { ClientCertificate, FilePayload, Headers, SetStorageState, StorageState, TimeoutOptions } from './types';
import type { Serializable } from '../../types/structs';
import type * as api from '../../types/types';
import type { HeadersArray, NameValue } from '../utils/isomorphic/types';
import type { Platform } from './platform';
import type * as channels from '@protocol/channels';
import type * as fs from 'fs';

export type FetchOptions = {
  params?: { [key: string]: string | number | boolean; } | URLSearchParams | string,
  method?: string,
  headers?: Headers,
  data?: string | Buffer | Serializable,
  form?: { [key: string]: string|number|boolean; } | FormData;
  multipart?: { [key: string]: string|number|boolean|fs.ReadStream|FilePayload; } | FormData;
  timeout?: number,
  failOnStatusCode?: boolean,
  ignoreHTTPSErrors?: boolean,
  maxRedirects?: number,
  maxRetries?: number,
};

type NewContextOptions = Omit<channels.PlaywrightNewRequestOptions, 'extraHTTPHeaders' | 'clientCertificates' | 'storageState' | 'tracesDir'> & {
  extraHTTPHeaders?: Headers,
  storageState?: string | SetStorageState,
  clientCertificates?: ClientCertificate[];
};

type RequestWithBodyOptions = Omit<FetchOptions, 'method'>;

export class APIRequest implements api.APIRequest {
  private _playwright: Playwright;
  readonly _contexts = new Set<APIRequestContext>();

  constructor(playwright: Playwright) {
    this._playwright = playwright;
  }

  async newContext(options: NewContextOptions & TimeoutOptions = {}): Promise<APIRequestContext> {
    options = {
      ...this._playwright._defaultContextOptions,
      ...options,
    };
    const storageState = typeof options.storageState === 'string' ?
      JSON.parse(await this._playwright._platform.fs().promises.readFile(options.storageState, 'utf8')) :
      options.storageState;
    const context = APIRequestContext.from((await this._playwright._channel.newRequest({
      ...options,
      extraHTTPHeaders: options.extraHTTPHeaders ? headersObjectToArray(options.extraHTTPHeaders) : undefined,
      storageState,
      tracesDir: this._playwright._defaultLaunchOptions?.tracesDir, // We do not expose tracesDir in the API, so do not allow options to accidentally override it.
      clientCertificates: await toClientCertificatesProtocol(this._playwright._platform, options.clientCertificates),
    })).request);
    this._contexts.add(context);
    context._request = this;
    context._timeoutSettings.setDefaultTimeout(options.timeout ?? this._playwright._defaultContextTimeout);
    context._tracing._tracesDir = this._playwright._defaultLaunchOptions?.tracesDir;
    await context._instrumentation.runAfterCreateRequestContext(context);
    return context;
  }
}

export class APIRequestContext extends ChannelOwner<channels.APIRequestContextChannel> implements api.APIRequestContext {
  _request?: APIRequest;
  readonly _tracing: Tracing;
  private _closeReason: string | undefined;
  _timeoutSettings: TimeoutSettings;

  static from(channel: channels.APIRequestContextChannel): APIRequestContext {
    return (channel as any)._object;
  }

  constructor(parent: ChannelOwner, type: string, guid: string, initializer: channels.APIRequestContextInitializer) {
    super(parent, type, guid, initializer);
    this._tracing = Tracing.from(initializer.tracing);
    this._timeoutSettings = new TimeoutSettings(this._platform);
  }

  async [Symbol.asyncDispose]() {
    await this.dispose();
  }

  async dispose(options: { reason?: string } = {}): Promise<void> {
    this._closeReason = options.reason;
    await this._instrumentation.runBeforeCloseRequestContext(this);
    try {
      await this._channel.dispose(options);
    } catch (e) {
      if (isTargetClosedError(e))
        return;
      throw e;
    }
    this._tracing._resetStackCounter();
    this._request?._contexts.delete(this);
  }

  async delete(url: string, options?: RequestWithBodyOptions): Promise<APIResponse> {
    return await this.fetch(url, {
      ...options,
      method: 'DELETE',
    });
  }

  async head(url: string, options?: RequestWithBodyOptions): Promise<APIResponse> {
    return await this.fetch(url, {
      ...options,
      method: 'HEAD',
    });
  }

  async get(url: string, options?: RequestWithBodyOptions): Promise<APIResponse> {
    return await this.fetch(url, {
      ...options,
      method: 'GET',
    });
  }

  async patch(url: string, options?: RequestWithBodyOptions): Promise<APIResponse> {
    return await this.fetch(url, {
      ...options,
      method: 'PATCH',
    });
  }

  async post(url: string, options?: RequestWithBodyOptions): Promise<APIResponse> {
    return await this.fetch(url, {
      ...options,
      method: 'POST',
    });
  }

  async put(url: string, options?: RequestWithBodyOptions): Promise<APIResponse> {
    return await this.fetch(url, {
      ...options,
      method: 'PUT',
    });
  }

  async fetch(urlOrRequest: string | api.Request, options: FetchOptions = {}): Promise<APIResponse> {
    const url = isString(urlOrRequest) ? urlOrRequest : undefined;
    const request = isString(urlOrRequest) ? undefined : urlOrRequest;
    return await this._innerFetch({ url, request, ...options });
  }

  async _innerFetch(options: FetchOptions & { url?: string, request?: api.Request } = {}): Promise<APIResponse> {
    return await this._wrapApiCall(async () => {
      if (this._closeReason)
        throw new TargetClosedError(this._closeReason);
      assert(options.request || typeof options.url === 'string', 'First argument must be either URL string or Request');
      assert((options.data === undefined ? 0 : 1) + (options.form === undefined ? 0 : 1) + (options.multipart === undefined ? 0 : 1) <= 1, `Only one of 'data', 'form' or 'multipart' can be specified`);
      assert(options.maxRedirects === undefined || options.maxRedirects >= 0, `'maxRedirects' must be greater than or equal to '0'`);
      assert(options.maxRetries === undefined || options.maxRetries >= 0, `'maxRetries' must be greater than or equal to '0'`);
      const url = options.url !== undefined ? options.url : options.request!.url();
      const method = options.method || options.request?.method();
      let encodedParams = undefined;
      if (typeof options.params === 'string')
        encodedParams = options.params;
      else if (options.params instanceof URLSearchParams)
        encodedParams = options.params.toString();
      // Cannot call allHeaders() here as the request may be paused inside route handler.
      const headersObj = options.headers || options.request?.headers();
      const headers = headersObj ? headersObjectToArray(headersObj) : undefined;
      let jsonData: any;
      let formData: channels.NameValue[] | undefined;
      let multipartData: channels.FormField[] | undefined;
      let postDataBuffer: Buffer | undefined;
      if (options.data !== undefined) {
        if (isString(options.data)) {
          if (isJsonContentType(headers))
            jsonData = isJsonParsable(options.data) ? options.data : JSON.stringify(options.data);
          else
            postDataBuffer = Buffer.from(options.data, 'utf8');
        } else if (Buffer.isBuffer(options.data)) {
          postDataBuffer = options.data;
        } else if (typeof options.data === 'object' || typeof options.data === 'number' || typeof options.data === 'boolean') {
          jsonData = JSON.stringify(options.data);
        } else {
          throw new Error(`Unexpected 'data' type`);
        }
      } else if (options.form) {
        if (globalThis.FormData && options.form instanceof FormData) {
          formData = [];
          for (const [name, value] of options.form.entries()) {
            if (typeof value !== 'string')
              throw new Error(`Expected string for options.form["${name}"], found File. Please use options.multipart instead.`);
            formData.push({ name, value });
          }
        } else {
          formData = objectToArray(options.form);
        }
      } else if (options.multipart) {
        multipartData = [];
        if (globalThis.FormData && options.multipart instanceof FormData) {
          const form = options.multipart;
          for (const [name, value] of form.entries()) {
            if (isString(value)) {
              multipartData.push({ name, value });
            } else {
              const file: ServerFilePayload = {
                name: value.name,
                mimeType: value.type,
                buffer: Buffer.from(await value.arrayBuffer()),
              };
              multipartData.push({ name, file });
            }
          }
        } else {
          // Convert file-like values to ServerFilePayload structs.
          for (const [name, value] of Object.entries(options.multipart))
            multipartData.push(await toFormField(this._platform, name, value));
        }
      }
      if (postDataBuffer === undefined && jsonData === undefined && formData === undefined && multipartData === undefined)
        postDataBuffer = options.request?.postDataBuffer() || undefined;
      const fixtures = {
        __testHookLookup: (options as any).__testHookLookup
      };
      const result = await this._channel.fetch({
        url,
        params: typeof options.params === 'object' ? objectToArray(options.params) : undefined,
        encodedParams,
        method,
        headers,
        postData: postDataBuffer,
        jsonData,
        formData,
        multipartData,
        timeout: this._timeoutSettings.timeout(options),
        failOnStatusCode: options.failOnStatusCode,
        ignoreHTTPSErrors: options.ignoreHTTPSErrors,
        maxRedirects: options.maxRedirects,
        maxRetries: options.maxRetries,
        ...fixtures
      });
      return new APIResponse(this, result.response);
    });
  }

  async storageState(options: { path?: string, indexedDB?: boolean } = {}): Promise<StorageState> {
    const state = await this._channel.storageState({ indexedDB: options.indexedDB });
    if (options.path) {
      await mkdirIfNeeded(this._platform, options.path);
      await this._platform.fs().promises.writeFile(options.path, JSON.stringify(state, undefined, 2), 'utf8');
    }
    return state;
  }
}

async function toFormField(platform: Platform, name: string, value: string | number | boolean | fs.ReadStream | FilePayload): Promise<channels.FormField> {
  const typeOfValue = typeof value;
  if (isFilePayload(value)) {
    const payload = value as FilePayload;
    if (!Buffer.isBuffer(payload.buffer))
      throw new Error(`Unexpected buffer type of 'data.${name}'`);
    return { name, file: filePayloadToJson(payload) };
  } else if (typeOfValue === 'string' || typeOfValue === 'number' || typeOfValue === 'boolean') {
    return { name, value: String(value) };
  } else {
    return { name, file: await readStreamToJson(platform, value as fs.ReadStream) };
  }
}

function isJsonParsable(value: any) {
  if (typeof value !== 'string')
    return false;
  try {
    JSON.parse(value);
    return true;
  } catch (e) {
    if (e instanceof SyntaxError)
      return false;
    else
      throw e;
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

    if (context._platform.inspectCustom)
      (this as any)[context._platform.inspectCustom] = () => this._inspect();
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
    return await this._request._wrapApiCall(async () => {
      try {
        const result = await this._request._channel.fetchResponseBody({ fetchUid: this._fetchUid() });
        if (result.binary === undefined)
          throw new Error('Response has been disposed');
        return result.binary;
      } catch (e) {
        if (isTargetClosedError(e))
          throw new Error('Response has been disposed');
        throw e;
      }
    }, { internal: true });
  }

  async text(): Promise<string> {
    const content = await this.body();
    return content.toString('utf8');
  }

  async json(): Promise<object> {
    const content = await this.text();
    return JSON.parse(content);
  }

  async [Symbol.asyncDispose]() {
    await this.dispose();
  }

  async dispose(): Promise<void> {
    await this._request._channel.disposeAPIResponse({ fetchUid: this._fetchUid() });
  }

  private _inspect() {
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
    buffer: payload.buffer,
  };
}

async function readStreamToJson(platform: Platform, stream: fs.ReadStream): Promise<ServerFilePayload> {
  const buffer = await new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', chunk => chunks.push(chunk as Buffer));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', err => reject(err));
  });
  const streamPath: string = Buffer.isBuffer(stream.path) ? stream.path.toString('utf8') : stream.path;
  return {
    name: platform.path().basename(streamPath),
    buffer,
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

function objectToArray(map?: { [key: string]: any }): NameValue[] | undefined {
  if (!map)
    return undefined;
  const result = [];
  for (const [name, value] of Object.entries(map)) {
    if (value !== undefined)
      result.push({ name, value: String(value) });
  }
  return result;
}

function isFilePayload(value: any): boolean {
  return typeof value === 'object' && value['name'] && value['mimeType'] && value['buffer'];
}
