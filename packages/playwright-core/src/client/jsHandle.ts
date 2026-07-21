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

import { kFunctionBindingPrefix } from '@isomorphic/utilityScriptSerializers';
import { parseSerializedValue, serializeValue } from '@protocol/serializers';
import { createGuid } from '@utils/crypto';
import { ChannelOwner } from './channelOwner';
import { isTargetClosedError } from './errors';
import { kNoTimeout } from './timeoutSettings';

import type * as structs from '../../types/structs';
import type * as api from '../../types/types';
import type * as channels from './channels';
import type { Page } from './page';


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

  async evaluate<R, Arg>(pageFunction: structs.PageFunctionOn<T, Arg, R>, arg?: Arg, options?: EvaluateOptions): Promise<R> {
    assertEvaluateOptions(options);
    const serializedArg = options?.exposeFunctions ? await serializeArgumentWithCallbacks(this, this._parentOfType('Page') as Page | undefined, arg) : serializeArgument(arg);
    const result = await this._channel.evaluateExpression({ expression: String(pageFunction), isFunction: typeof pageFunction === 'function', arg: serializedArg }, kNoTimeout);
    return parseResult(result.value);
  }

  async evaluateHandle<R, Arg>(pageFunction: structs.PageFunctionOn<T, Arg, R>, arg?: Arg, options?: EvaluateOptions): Promise<structs.SmartHandle<R>> {
    assertEvaluateOptions(options);
    const serializedArg = options?.exposeFunctions ? await serializeArgumentWithCallbacks(this, this._parentOfType('Page') as Page | undefined, arg) : serializeArgument(arg);
    const result = await this._channel.evaluateExpressionHandle({ expression: String(pageFunction), isFunction: typeof pageFunction === 'function', arg: serializedArg }, kNoTimeout);
    return JSHandle.from(result.handle) as any as structs.SmartHandle<R>;
  }

  async getProperty(propertyName: string): Promise<JSHandle> {
    const result = await this._channel.getProperty({ name: propertyName }, kNoTimeout);
    return JSHandle.from(result.handle);
  }

  async getProperties(): Promise<Map<string, JSHandle>> {
    const map = new Map<string, JSHandle>();
    for (const { name, value } of (await this._channel.getPropertyList({}, kNoTimeout)).properties)
      map.set(name, JSHandle.from(value));
    return map;
  }

  async jsonValue(): Promise<T> {
    return parseResult((await this._channel.jsonValue({}, kNoTimeout)).value);
  }

  asElement(): T extends Node ? api.ElementHandle<T> : null {
    return null as any;
  }

  async [Symbol.asyncDispose]() {
    await this.dispose();
  }

  async dispose() {
    try {
      await this._channel.dispose({}, kNoTimeout);
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
export function serializeArgument(arg: any, registerCallback?: (callback: Function) => string): channels.SerializedArgument {
  const handles: channels.Channel[] = [];
  const pushHandle = (channel: channels.Channel): number => {
    handles.push(channel);
    return handles.length - 1;
  };
  const value = serializeValue(arg, value => {
    if (value instanceof JSHandle)
      return { h: pushHandle(value._channel) };
    if (typeof value === 'function' && registerCallback)
      return { fn: registerCallback(value as Function) };
    return { fallThrough: value };
  });
  return { value, handles };
}

export type EvaluateOptions = { exposeFunctions?: boolean };

export async function serializeArgumentWithCallbacks(owner: ChannelOwner<any>, page: Page | undefined, arg: any): Promise<channels.SerializedArgument> {
  return await owner._wrapApiCall(async () => {
    const exposePromises: Promise<void>[] = [];
    const serialized = serializeArgument(arg, callback => {
      if (!page)
        throw new Error('Passing a function is not supported as an argument here');
      const name = kFunctionBindingPrefix + createGuid();
      exposePromises.push(page._exposeEvaluateCallback(name, callback));
      return name;
    });
    await Promise.all(exposePromises);
    return serialized;
  }, { internal: true });
}

export function parseResult(value: channels.SerializedValue): any {
  return parseSerializedValue(value, undefined);
}

export function assertMaxArguments(count: number, max: number): asserts count {
  if (count > max)
    throw new Error('Too many arguments. If you need to pass more than 1 argument to the function wrap them in an object.');
}

export function assertEvaluateOptions(options: any) {
  if (options !== undefined && (typeof options !== 'object' || options === null || Array.isArray(options)))
    throw new Error('Too many arguments. If you need to pass more than 1 argument to the function wrap them in an object.');
}
