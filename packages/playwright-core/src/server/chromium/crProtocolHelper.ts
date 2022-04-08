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

import type { CRSession } from './crConnection';
import type { Protocol } from './protocol';
import fs from 'fs';
import type * as types from '../types';
import { mkdirIfNeeded } from '../../utils/fileUtils';
import { splitErrorMessage } from '../../utils/stackTrace';

export function getExceptionMessage(exceptionDetails: Protocol.Runtime.ExceptionDetails): string {
  if (exceptionDetails.exception)
    return exceptionDetails.exception.description || String(exceptionDetails.exception.value);
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

export async function releaseObject(client: CRSession, objectId: string) {
  await client.send('Runtime.releaseObject', { objectId }).catch(error => {});
}

export async function readProtocolStream(client: CRSession, handle: string, path: string | null): Promise<Buffer> {
  let eof = false;
  let fd: fs.promises.FileHandle | undefined;
  if (path) {
    await mkdirIfNeeded(path);
    fd = await fs.promises.open(path, 'w');
  }
  const bufs = [];
  while (!eof) {
    const response = await client.send('IO.read', { handle });
    eof = response.eof;
    const buf = Buffer.from(response.data, response.base64Encoded ? 'base64' : undefined);
    bufs.push(buf);
    if (fd)
      await fd.write(buf);
  }
  if (fd)
    await fd.close();
  await client.send('IO.close', { handle });
  return Buffer.concat(bufs);
}

export function toConsoleMessageLocation(stackTrace: Protocol.Runtime.StackTrace | undefined): types.ConsoleMessageLocation {
  return stackTrace && stackTrace.callFrames.length ? {
    url: stackTrace.callFrames[0].url,
    lineNumber: stackTrace.callFrames[0].lineNumber,
    columnNumber: stackTrace.callFrames[0].columnNumber,
  } : { url: '', lineNumber: 0, columnNumber: 0 };
}

export function exceptionToError(exceptionDetails: Protocol.Runtime.ExceptionDetails): Error {
  const messageWithStack = getExceptionMessage(exceptionDetails);
  const lines = messageWithStack.split('\n');
  const firstStackTraceLine = lines.findIndex(line => line.startsWith('    at'));
  let messageWithName = '';
  let stack = '';
  if (firstStackTraceLine === -1) {
    messageWithName = messageWithStack;
  } else {
    messageWithName = lines.slice(0, firstStackTraceLine).join('\n');
    stack = messageWithStack;
  }
  const { name, message } = splitErrorMessage(messageWithName);

  const err = new Error(message);
  err.stack = stack;
  err.name = name;
  return err;
}

export function toModifiersMask(modifiers: Set<types.KeyboardModifier>): number {
  let mask = 0;
  if (modifiers.has('Alt'))
    mask |= 1;
  if (modifiers.has('Control'))
    mask |= 2;
  if (modifiers.has('Meta'))
    mask |= 4;
  if (modifiers.has('Shift'))
    mask |= 8;
  return mask;
}

export function toButtonsMask(buttons: Set<types.MouseButton>): number {
  let mask = 0;
  if (buttons.has('left'))
    mask |= 1;
  if (buttons.has('right'))
    mask |= 2;
  if (buttons.has('middle'))
    mask |= 4;
  return mask;
}
