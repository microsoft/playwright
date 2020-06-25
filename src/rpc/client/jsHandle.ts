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

import { JSHandleChannel } from '../channels';
import { ElementHandle } from './elementHandle';
import { ChannelOwner } from './channelOwner';
import { Connection } from '../connection';

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

export class JSHandle<T = any> extends ChannelOwner<JSHandleChannel> {
  protected _jsChannel: JSHandleChannel;
  private _preview: string | undefined;

  static from(handle: JSHandleChannel): JSHandle {
    return handle._object;
  }

  static fromNullable(handle: JSHandleChannel | null): JSHandle | null {
    return handle ? JSHandle.from(handle) : null;
  }

  constructor(conection: Connection, channel: JSHandleChannel) {
    super(conection, channel);
    this._jsChannel = channel;
  }

  _initialize(params: { preview: string }) {
    this._preview = params.preview;
  }

  async evaluate<R, Arg>(pageFunction: FuncOn<T, Arg, R>, arg: Arg): Promise<R>;
  async evaluate<R>(pageFunction: FuncOn<T, void, R>, arg?: any): Promise<R>;
  async evaluate<R, Arg>(pageFunction: FuncOn<T, Arg, R>, arg: Arg): Promise<R> {
    return await this._jsChannel.evaluateExpression({ expression: String(pageFunction), isFunction: typeof pageFunction === 'function', arg: convertArg(arg) });
  }

  async evaluateHandle<R, Arg>(pageFunction: FuncOn<T, Arg, R>, arg: Arg): Promise<SmartHandle<R>>;
  async evaluateHandle<R>(pageFunction: FuncOn<T, void, R>, arg?: any): Promise<SmartHandle<R>>;
  async evaluateHandle<R, Arg>(pageFunction: FuncOn<T, Arg, R>, arg: Arg): Promise<SmartHandle<R>> {
    const handleChannel = await this._jsChannel.evaluateExpressionHandle({  expression: String(pageFunction), isFunction: typeof pageFunction === 'function', arg: convertArg(arg) });
    return JSHandle.from(handleChannel) as SmartHandle<R>;
  }

  async getProperty(propertyName: string): Promise<JSHandle> {
    const objectHandle = await this.evaluateHandle((object: any, propertyName: string) => {
      const result: any = {__proto__: null};
      result[propertyName] = object[propertyName];
      return result;
    }, propertyName);
    const properties = await objectHandle.getProperties();
    const result = properties.get(propertyName)!;
    objectHandle.dispose();
    return result;
  }

  async getProperties(): Promise<Map<string, JSHandle>> {
    const map = new Map<string, JSHandle>();
    for (const { name, value } of await this._jsChannel.getPropertyList())
      map.set(name, JSHandle.from(value));
    return map;
  }

  async jsonValue(): Promise<T> {
    return await this._jsChannel.jsonValue();
  }

  asElement(): ElementHandle | null {
    return null;
  }

  async dispose() {
    return await this._jsChannel.dispose();
  }

  toString(): string {
    return this._preview!;
  }
}

export function convertArg(arg: any): any {
  if (arg === null)
    return null;
  if (Array.isArray(arg))
    return arg.map(item => convertArg(item));
  if (arg instanceof ChannelOwner)
    return arg._channel;
  if (typeof arg === 'object') {
    const result: any = {};
    for (const key of Object.keys(arg))
      result[key] = convertArg(arg[key]);
    return result;
  }
  return arg;
}
