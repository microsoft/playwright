/**
 * Copyright 2017 Google Inc. All rights reserved.
 * Modifications copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import * as fs from 'fs';
import {helper, assert, debugError} from '../helper';
import { CDPSession } from './Connection';
import { Protocol } from './protocol';

const openAsync = helper.promisify(fs.open);
const writeAsync = helper.promisify(fs.write);
const closeAsync = helper.promisify(fs.close);


export function getExceptionMessage(exceptionDetails: Protocol.Runtime.ExceptionDetails): string {
  if (exceptionDetails.exception)
    return exceptionDetails.exception.description || exceptionDetails.exception.value;
  let message = exceptionDetails.text;
  if (exceptionDetails.stackTrace) {
    for (const callframe of exceptionDetails.stackTrace.callFrames) {
      const location = callframe.url + ':' + callframe.lineNumber + ':' + callframe.columnNumber;
      const functionName = callframe.functionName || '<anonymous>';
      message += `\n    at ${functionName} (${location})`;
    }
  }
  return message;
}

export function valueFromRemoteObject(remoteObject: Protocol.Runtime.RemoteObject): any {
  assert(!remoteObject.objectId, 'Cannot extract value when objectId is given');
  if (remoteObject.unserializableValue) {
    if (remoteObject.type === 'bigint' && typeof BigInt !== 'undefined')
      return BigInt(remoteObject.unserializableValue.replace('n', ''));
    switch (remoteObject.unserializableValue) {
      case '-0':
        return -0;
      case 'NaN':
        return NaN;
      case 'Infinity':
        return Infinity;
      case '-Infinity':
        return -Infinity;
      default:
        throw new Error('Unsupported unserializable value: ' + remoteObject.unserializableValue);
    }
  }
  return remoteObject.value;
}

export async function releaseObject(client: CDPSession, remoteObject: Protocol.Runtime.RemoteObject) {
  if (!remoteObject.objectId)
    return;
  await client.send('Runtime.releaseObject', {objectId: remoteObject.objectId}).catch(error => {
    // Exceptions might happen in case of a page been navigated or closed.
    // Swallow these since they are harmless and we don't leak anything in this case.
    debugError(error);
  });
}

export async function readProtocolStream(client: CDPSession, handle: string, path: string | null): Promise<Buffer> {
  let eof = false;
  let file;
  if (path)
    file = await openAsync(path, 'w');
  const bufs = [];
  while (!eof) {
    const response = await client.send('IO.read', {handle});
    eof = response.eof;
    const buf = Buffer.from(response.data, response.base64Encoded ? 'base64' : undefined);
    bufs.push(buf);
    if (path)
      await writeAsync(file, buf);
  }
  if (path)
    await closeAsync(file);
  await client.send('IO.close', {handle});
  let resultBuffer = null;
  try {
    resultBuffer = Buffer.concat(bufs);
  } finally {
    return resultBuffer;
  }
}


