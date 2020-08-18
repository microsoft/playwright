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
import * as types from './types';

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

export function headersObjectToArray(headers: { [key: string]: string }): types.HeadersArray {
  const result: types.HeadersArray = [];
  for (const name in headers) {
    if (!Object.is(headers[name], undefined))
      result.push({ name, value: headers[name] });
  }
  return result;
}

export function headersArrayToObject(headers: types.HeadersArray, lowerCase: boolean): { [key: string]: string } {
  const result: { [key: string]: string } = {};
  for (const { name, value } of headers)
    result[lowerCase ? name.toLowerCase() : name] = value;
  return result;
}
