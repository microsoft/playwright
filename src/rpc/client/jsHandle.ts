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

import { JSHandleChannel, JSHandleInitializer, SerializedArgument, Channel } from '../channels';
import { ElementHandle } from './elementHandle';
import { ChannelOwner } from './channelOwner';
import { serializeAsCallArgument, parseEvaluationResultValue, SerializedValue } from '../../common/utilityScriptSerializers';

type NoHandles<Arg> = Arg extends JSHandle ? never : (Arg extends object ? { [Key in keyof Arg]: NoHandles<Arg[Key]> } : Arg);
type Unboxed<Arg> =
  Arg extends ElementHandle<infer T> ? T :
  Arg extends JSHandle<infer T> ? T :
  Arg extends NoHandles<Arg> ? Arg :
  Arg extends [infer A0] ? [Unboxed<A0>] :
  Arg extends [infer A0, infer A1] ? [Unboxed<A0>, Unboxed<A1>] :
  Arg extends [infer A0, infer A1, infer A2] ? [Unboxed<A0>, Unboxed<A1>, Unboxed<A2>] :
  Arg extends Array<infer T> ? Array<Unboxed<T>> :
  Arg extends object ? { [Key in keyof Arg]: Unboxed<Arg[Key]> } :
  Arg;
export type Func0<R> = string | (() => R | Promise<R>);
export type Func1<Arg, R> = string | ((arg: Unboxed<Arg>) => R | Promise<R>);
export type FuncOn<On, Arg2, R> = string | ((on: On, arg2: Unboxed<Arg2>) => R | Promise<R>);
export type SmartHandle<T> = T extends Node ? ElementHandle<T> : JSHandle<T>;

export class JSHandle<T = any> extends ChannelOwner<JSHandleChannel, JSHandleInitializer> {
  private _preview: string;

  static from(handle: JSHandleChannel): JSHandle {
    return (handle as any)._object;
  }

  static fromNullable(handle: JSHandleChannel | null): JSHandle | null {
    return handle ? JSHandle.from(handle) : null;
  }

  constructor(parent: ChannelOwner, type: string, guid: string, initializer: JSHandleInitializer) {
    super(parent, type, guid, initializer);
    this._preview = this._initializer.preview;
    this._channel.on('previewUpdated', ({preview}) => this._preview = preview);
  }

  async evaluate<R, Arg>(pageFunction: FuncOn<T, Arg, R>, arg: Arg): Promise<R>;
  async evaluate<R>(pageFunction: FuncOn<T, void, R>, arg?: any): Promise<R>;
  async evaluate<R, Arg>(pageFunction: FuncOn<T, Arg, R>, arg: Arg): Promise<R> {
    const result = await this._channel.evaluateExpression({ expression: String(pageFunction), isFunction: typeof pageFunction === 'function', arg: serializeArgument(arg) });
    return parseResult(result.value);
  }

  async evaluateHandle<R, Arg>(pageFunction: FuncOn<T, Arg, R>, arg: Arg): Promise<SmartHandle<R>>;
  async evaluateHandle<R>(pageFunction: FuncOn<T, void, R>, arg?: any): Promise<SmartHandle<R>>;
  async evaluateHandle<R, Arg>(pageFunction: FuncOn<T, Arg, R>, arg: Arg): Promise<SmartHandle<R>> {
    const result = await this._channel.evaluateExpressionHandle({ expression: String(pageFunction), isFunction: typeof pageFunction === 'function', arg: serializeArgument(arg) });
    return JSHandle.from(result.handle) as SmartHandle<R>;
  }

  async getProperty(name: string): Promise<JSHandle> {
    const result = await this._channel.getProperty({ name });
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

  asElement(): ElementHandle | null {
    return null;
  }

  async dispose() {
    return await this._channel.dispose();
  }

  toString(): string {
    return this._preview;
  }
}

// This function takes care of converting all JSHandles to their channels,
// so that generic channel serializer converts them to guids.
export function serializeArgument(arg: any): SerializedArgument {
  const handles: Channel[] = [];
  const pushHandle = (channel: Channel): number => {
    handles.push(channel);
    return handles.length - 1;
  };
  const value = serializeAsCallArgument(arg, value => {
    if (value instanceof JSHandle)
      return { h: pushHandle(value._channel) };
    return { fallThrough: value };
  });
  return { value, handles };
}

export function parseResult(arg: SerializedValue): any {
  return parseEvaluationResultValue(arg, []);
}
