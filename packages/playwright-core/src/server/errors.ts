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

import type { SerializedError } from '@protocol/channels';
import { isError } from '../utils';
import { parseSerializedValue, serializeValue } from '../protocol/serializers';
import { JavaScriptErrorInEvaluate } from './javascript';

class CustomError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class TimeoutError extends CustomError {}

export class TargetClosedError extends CustomError {
  constructor(cause?: string, logs?: string) {
    super((cause || 'Target page, context or browser has been closed') + (logs || ''));
  }
}

export function isTargetClosedError(error: Error) {
  return error instanceof TargetClosedError || error.name === 'TargetClosedError';
}

export class OverriddenAPIError extends JavaScriptErrorInEvaluate {
  public apiNameOverride: string;

  constructor(error: JavaScriptErrorInEvaluate, apiNameOverride: string) {
    super(error.message);
    this.name = error.name;
    this.stack = error.stack;
    this.apiNameOverride = apiNameOverride;
  }
}

export function isOverriddenAPIError(error: Error) {
  return error instanceof OverriddenAPIError;
}

export function serializeError(e: any): SerializedError {
  if (isError(e)) {
    const serializedError: {
      error: {
        message: any,
        stack: any,
        name: string,
        apiNameOverride?: string;
      }
    } = {
      error: {
        message: e.message,
        stack: e.stack,
        name: e.name
      }
    };

    if (isOverriddenAPIError(e))
      serializedError.error.apiNameOverride = e.apiNameOverride;

    return serializedError;
  }
  return { value: serializeValue(e, value => ({ fallThrough: value })) };
}

export function parseError(error: SerializedError): Error {
  if (!error.error) {
    if (error.value === undefined)
      throw new Error('Serialized error must have either an error or a value');
    return parseSerializedValue(error.value, undefined);
  }
  const e = new Error(error.error.message);
  e.stack = error.error.stack || '';
  e.name = error.error.name;
  return e;
}
