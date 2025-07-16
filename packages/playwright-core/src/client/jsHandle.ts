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

import { ChannelOwner } from './channelOwner';
import { isTargetClosedError } from './errors';
import { parseSerializedValue, serializeValue } from '../protocol/serializers';

import type * as structs from '../../types/structs';
import type * as api from '../../types/types';
import type * as channels from '@protocol/channels';


export class JSHandle<T = any> extends ChannelOwner<channels.JSHandleChannel> implements api.JSHandle {
  private _preview: string;

  static from(handle: channels.JSHandleChannel): JSHandle {
    return (handle as any)._object;
  }

  constructor(parent: ChannelOwner, type: string, guid: string, initializer: channels.JSHandleInitializer) {
    super(parent, type, guid, initializer);
    this._preview = this._initializer.preview;
    this._channel.on('previewUpdated', ({ preview }) => this._preview = preview);
  }

  async evaluate<R, Arg>(pageFunction: structs.PageFunctionOn<T, Arg, R>, arg?: Arg): Promise<R> {
    const result = await this._channel.evaluateExpression({ expression: String(pageFunction), isFunction: typeof pageFunction === 'function', arg: serializeArgument(arg) });
    return parseResult(result.value);
  }

  async _evaluateFunction(functionDeclaration: string) {
    const result = await this._channel.evaluateExpression({ expression: functionDeclaration, isFunction: true, arg: serializeArgument(undefined) });
    return parseResult(result.value);
  }

  async evaluateHandle<R, Arg>(pageFunction: structs.PageFunctionOn<T, Arg, R>, arg?: Arg): Promise<structs.SmartHandle<R>> {
    const result = await this._channel.evaluateExpressionHandle({ expression: String(pageFunction), isFunction: typeof pageFunction === 'function', arg: serializeArgument(arg) });
    return JSHandle.from(result.handle) as any as structs.SmartHandle<R>;
  }

  async getProperty(propertyName: string): Promise<JSHandle> {
    const result = await this._channel.getProperty({ name: propertyName });
    return JSHandle.from(result.handle);
  }

  async getProperties(): Promise<Map<string, JSHandle>> {
    const map = new Map<string, JSHandle>();
    for (const { name, value } of (await this._channel.getPropertyList()).properties)
      map.set(name, JSHandle.from(value));
    return map;
  }

  async jsonValue(): Promise<T> {
    return parseResult((await this._channel.jsonValue()).value);
  }

  asElement(): T extends Node ? api.ElementHandle<T> : null {
    return null as any;
  }

  async [Symbol.asyncDispose]() {
    await this.dispose();
  }

  async dispose() {
    try {
      await this._channel.dispose();
    } catch (e) {
      if (isTargetClosedError(e))
        return;
      throw e;
    }
  }

  override toString(): string {
    return this._preview;
  }
}

// This function takes care of converting all JSHandles to their channels,
// so that generic channel serializer converts them to guids.
export function serializeArgument(arg: any): channels.SerializedArgument {
  const handles: channels.Channel[] = [];
  const pushHandle = (channel: channels.Channel): number => {
    handles.push(channel);
    return handles.length - 1;
  };
  const value = serializeValue(arg, value => {
    if (value instanceof JSHandle)
      return { h: pushHandle(value._channel) };
    return { fallThrough: value };
  });
  return { value, handles };
}

export function parseResult(value: channels.SerializedValue): any {
  return parseSerializedValue(value, undefined);
}

export function assertMaxArguments(count: number, max: number): asserts count {
  if (count > max)
    throw new Error('Too many arguments. If you need to pass more than 1 argument to the function wrap them in an object.');
}
