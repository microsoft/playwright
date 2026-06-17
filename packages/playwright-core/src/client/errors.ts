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

import { isError } from '@isomorphic/rtti';
import { parseSerializedValue, serializeValue } from '../protocol/serializers';

import type { SerializedError } from './channels';

export class PlaywrightError extends Error {
  log: string[] = [];
  details?: any;  // As declared in the protocol.
}

export class TimeoutError extends PlaywrightError {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

export class TargetClosedError extends PlaywrightError {
  constructor(cause?: string) {
    super(cause || 'Target page, context or browser has been closed');
  }
}

export function isTargetClosedError(error: Error) {
  return error instanceof TargetClosedError;
}

export function serializeError(e: any): SerializedError {
  if (isError(e))
    return { error: { message: e.message, stack: e.stack, name: e.name } };
  return { value: serializeValue(e, value => ({ fallThrough: value })) };
}

export function parseError(error: SerializedError): PlaywrightError {
  if (!error.error) {
    if (error.value === undefined)
      throw new Error('Serialized error must have either an error or a value');
    return parseSerializedValue(error.value, undefined);
  }
  let e: PlaywrightError;
  if (error.error.name === 'TimeoutError')
    e = new TimeoutError(error.error.message);
  else if (error.error.name === 'TargetClosedError')
    e = new TargetClosedError(error.error.message);
  else
    e = Object.assign(new PlaywrightError(error.error.message), { name: error.error.name });
  e.stack = error.error.stack || '';
  return e;
}
