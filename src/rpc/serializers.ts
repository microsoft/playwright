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

import * as fs from 'fs';
import * as mime from 'mime';
import * as path from 'path';
import * as util from 'util';
import { TimeoutError } from '../errors';
import * as types from '../types';
import { helper, assert } from '../helper';


export function serializeError(e: any): types.Error {
  if (helper.isError(e))
    return { message: e.message, stack: e.stack, name: e.name };
  return { value: e };
}

export function parseError(error: types.Error): any {
  if (error.message === undefined)
    return error.value;
  if (error.name === 'TimeoutError') {
    const e = new TimeoutError(error.message);
    e.stack = error.stack;
    return e;
  }
  const e = new Error(error.message);
  e.stack = error.stack;
  return e;
}

export async function normalizeFilePayloads(files: string | types.FilePayload | string[] | types.FilePayload[]): Promise<types.FilePayload[]> {
  let ff: string[] | types.FilePayload[];
  if (!Array.isArray(files))
    ff = [ files ] as string[] | types.FilePayload[];
  else
    ff = files;
  const filePayloads: types.FilePayload[] = [];
  for (const item of ff) {
    if (typeof item === 'string') {
      const file: types.FilePayload = {
        name: path.basename(item),
        mimeType: mime.getType(item) || 'application/octet-stream',
        buffer: await util.promisify(fs.readFile)(item)
      };
      filePayloads.push(file);
    } else {
      filePayloads.push(item);
    }
  }
  return filePayloads;
}

export async function normalizeFulfillParameters(params: types.FulfillResponse & { path?: string }): Promise<types.NormalizedFulfillResponse> {
  let body = '';
  let isBase64 = false;
  let length = 0;
  if (params.path) {
    const buffer = await util.promisify(fs.readFile)(params.path);
    body = buffer.toString('base64');
    isBase64 = true;
    length = buffer.length;
  } else if (helper.isString(params.body)) {
    body = params.body;
    isBase64 = false;
    length = Buffer.byteLength(body);
  } else if (params.body) {
    body = params.body.toString('base64');
    isBase64 = true;
    length = params.body.length;
  }
  const headers: types.Headers = {};
  for (const header of Object.keys(params.headers || {}))
    headers[header.toLowerCase()] = String(params.headers![header]);
  if (params.contentType)
    headers['content-type'] = String(params.contentType);
  else if (params.path)
    headers['content-type'] = mime.getType(params.path) || 'application/octet-stream';
  if (length && !('content-length' in headers))
    headers['content-length'] = String(length);

  return {
    status: params.status || 200,
    headers: headersObjectToArray(headers),
    body,
    isBase64
  };
}

export function normalizeContinueOverrides(overrides: types.ContinueOverrides): types.NormalizedContinueOverrides {
  return {
    method: overrides.method,
    headers: overrides.headers ? headersObjectToArray(overrides.headers) : undefined,
    postData: overrides.postData,
  };
}

export function headersObjectToArray(headers: types.Headers): types.HeadersArray {
  const result: types.HeadersArray = [];
  for (const name in headers) {
    if (!Object.is(headers[name], undefined)) {
      const value = headers[name];
      assert(helper.isString(value), `Expected value of header "${name}" to be String, but "${typeof value}" is found.`);
      result.push({ name, value });
    }
  }
  return result;
}

export function headersArrayToObject(headers: types.HeadersArray): types.Headers {
  const result: types.Headers = {};
  for (const { name, value } of headers)
    result[name] = value;
  return result;
}

export function envObjectToArray(env: types.Env): types.EnvArray {
  const result: types.EnvArray = [];
  for (const name in env) {
    if (!Object.is(env[name], undefined))
      result.push({ name, value: String(env[name]) });
  }
  return result;
}

export function envArrayToObject(env: types.EnvArray): types.Env {
  const result: types.Env = {};
  for (const { name, value } of env)
    result[name] = value;
  return result;
}
