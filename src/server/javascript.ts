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

import * as dom from './dom';
import * as utilityScriptSource from '../generated/utilityScriptSource';
import * as sourceMap from '../utils/sourceMap';
import { serializeAsCallArgument } from './common/utilityScriptSerializers';
import type UtilityScript from './injected/utilityScript';

type ObjectId = string;
export type RemoteObject = {
  objectId?: ObjectId,
  value?: any
};

type NoHandles<Arg> = Arg extends JSHandle ? never : (Arg extends object ? { [Key in keyof Arg]: NoHandles<Arg[Key]> } : Arg);
type Unboxed<Arg> =
  Arg extends dom.ElementHandle<infer T> ? T :
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
export type SmartHandle<T> = T extends Node ? dom.ElementHandle<T> : JSHandle<T>;

export interface ExecutionContextDelegate {
  rawEvaluate(expression: string): Promise<ObjectId>;
  evaluateWithArguments(expression: string, returnByValue: boolean, utilityScript: JSHandle<any>, values: any[], objectIds: ObjectId[]): Promise<any>;
  getProperties(handle: JSHandle): Promise<Map<string, JSHandle>>;
  createHandle(context: ExecutionContext, remoteObject: RemoteObject): JSHandle;
  releaseHandle(handle: JSHandle): Promise<void>;
}

export class ExecutionContext {
  readonly _delegate: ExecutionContextDelegate;
  private _utilityScriptPromise: Promise<JSHandle> | undefined;

  constructor(delegate: ExecutionContextDelegate) {
    this._delegate = delegate;
  }

  adoptIfNeeded(handle: JSHandle): Promise<JSHandle> | null {
    return null;
  }

  utilityScript(): Promise<JSHandle<UtilityScript>> {
    if (!this._utilityScriptPromise) {
      const source = `new (${utilityScriptSource.source})()`;
      this._utilityScriptPromise = this._delegate.rawEvaluate(source).then(objectId => new JSHandle(this, 'object', objectId));
    }
    return this._utilityScriptPromise;
  }

  createHandle(remoteObject: RemoteObject): JSHandle {
    return this._delegate.createHandle(this, remoteObject);
  }

  async doSlowMo() {
    // overrided in FrameExecutionContext
  }
}

export class JSHandle<T = any> {
  readonly _context: ExecutionContext;
  _disposed = false;
  readonly _objectId: ObjectId | undefined;
  readonly _value: any;
  private _objectType: string;
  protected _preview: string;
  private _previewCallback: ((preview: string) => void) | undefined;

  constructor(context: ExecutionContext, type: string, objectId?: ObjectId, value?: any) {
    this._context = context;
    this._objectId = objectId;
    this._value = value;
    this._objectType = type;
    if (this._objectId)
      this._value = 'JSHandle@' + this._objectType;
    this._preview = 'JSHandle@' + String(this._objectId ? this._objectType : this._value);
  }

  async evaluate<R, Arg>(pageFunction: FuncOn<T, Arg, R>, arg: Arg): Promise<R>;
  async evaluate<R>(pageFunction: FuncOn<T, void, R>, arg?: any): Promise<R>;
  async evaluate<R, Arg>(pageFunction: FuncOn<T, Arg, R>, arg: Arg): Promise<R> {
    return evaluate(this._context, true /* returnByValue */, pageFunction, this, arg);
  }

  async evaluateHandle<R, Arg>(pageFunction: FuncOn<T, Arg, R>, arg: Arg): Promise<SmartHandle<R>>;
  async evaluateHandle<R>(pageFunction: FuncOn<T, void, R>, arg?: any): Promise<SmartHandle<R>>;
  async evaluateHandle<R, Arg>(pageFunction: FuncOn<T, Arg, R>, arg: Arg): Promise<SmartHandle<R>> {
    return evaluate(this._context, false /* returnByValue */, pageFunction, this, arg);
  }

  async _evaluateExpression(expression: string, isFunction: boolean, returnByValue: boolean, arg: any) {
    const value = await evaluateExpression(this._context, returnByValue, expression, isFunction, this, arg);1;
    await this._context.doSlowMo();
    return value;
  }

  async getProperty(propertyName: string): Promise<JSHandle> {
    const objectHandle = await this.evaluateHandle((object: any, propertyName) => {
      const result: any = {__proto__: null};
      result[propertyName] = object[propertyName];
      return result;
    }, propertyName);
    const properties = await objectHandle.getProperties();
    const result = properties.get(propertyName)!;
    objectHandle.dispose();
    return result;
  }

  getProperties(): Promise<Map<string, JSHandle>> {
    return this._context._delegate.getProperties(this);
  }

  async jsonValue(): Promise<T> {
    if (!this._objectId)
      return this._value;
    const utilityScript = await this._context.utilityScript();
    const script = `(utilityScript, ...args) => utilityScript.jsonValue(...args)` + sourceMap.generateSourceUrl();
    return this._context._delegate.evaluateWithArguments(script, true, utilityScript, [true], [this._objectId]);
  }

  asElement(): dom.ElementHandle | null {
    return null;
  }

  async dispose() {
    if (this._disposed)
      return;
    this._disposed = true;
    await this._context._delegate.releaseHandle(this);
  }

  toString(): string {
    return this._preview;
  }

  _setPreviewCallback(callback: (preview: string) => void) {
    this._previewCallback = callback;
  }

  _setPreview(preview: string) {
    this._preview = preview;
    if (this._previewCallback)
      this._previewCallback(preview);
  }
}

export async function evaluate(context: ExecutionContext, returnByValue: boolean, pageFunction: Function | string, ...args: any[]): Promise<any> {
  return evaluateExpression(context, returnByValue, String(pageFunction), typeof pageFunction === 'function', ...args);
}

export async function evaluateExpression(context: ExecutionContext, returnByValue: boolean, expression: string, isFunction: boolean, ...args: any[]): Promise<any> {
  const utilityScript = await context.utilityScript();
  if (!isFunction) {
    const script = `(utilityScript, ...args) => utilityScript.evaluate(...args)` + sourceMap.generateSourceUrl();
    return context._delegate.evaluateWithArguments(script, returnByValue, utilityScript, [returnByValue, sourceMap.ensureSourceUrl(expression)], []);
  }

  let functionText = expression;
  try {
    new Function('(' + functionText + ')');
  } catch (e1) {
    // This means we might have a function shorthand. Try another
    // time prefixing 'function '.
    if (functionText.startsWith('async '))
      functionText = 'async function ' + functionText.substring('async '.length);
    else
      functionText = 'function ' + functionText;
    try {
      new Function('(' + functionText  + ')');
    } catch (e2) {
      // We tried hard to serialize, but there's a weird beast here.
      throw new Error('Passed function is not well-serializable!');
    }
  }

  const handles: (Promise<JSHandle>)[] = [];
  const toDispose: Promise<JSHandle>[] = [];
  const pushHandle = (handle: Promise<JSHandle>): number => {
    handles.push(handle);
    return handles.length - 1;
  };

  args = args.map(arg => serializeAsCallArgument(arg, handle => {
    if (handle instanceof JSHandle) {
      if (!handle._objectId)
        return { fallThrough: handle._value };
      if (handle._disposed)
        throw new Error('JSHandle is disposed!');
      const adopted = context.adoptIfNeeded(handle);
      if (adopted === null)
        return { h: pushHandle(Promise.resolve(handle)) };
      toDispose.push(adopted);
      return { h: pushHandle(adopted) };
    }
    return { fallThrough: handle };
  }));

  const utilityScriptObjectIds: ObjectId[] = [];
  for (const handle of await Promise.all(handles)) {
    if (handle._context !== context)
      throw new Error('JSHandles can be evaluated only in the context they were created!');
    utilityScriptObjectIds.push(handle._objectId!);
  }

  functionText += await sourceMap.generateSourceMapUrl(expression, functionText);
  // See UtilityScript for arguments.
  const utilityScriptValues = [returnByValue, functionText, args.length, ...args];

  const script = `(utilityScript, ...args) => utilityScript.callFunction(...args)` + sourceMap.generateSourceUrl();
  try {
    return await context._delegate.evaluateWithArguments(script, returnByValue, utilityScript, utilityScriptValues, utilityScriptObjectIds);
  } finally {
    toDispose.map(handlePromise => handlePromise.then(handle => handle.dispose()));
  }
}

export function parseUnserializableValue(unserializableValue: string): any {
  if (unserializableValue === 'NaN')
    return NaN;
  if (unserializableValue === 'Infinity')
    return Infinity;
  if (unserializableValue === '-Infinity')
    return -Infinity;
  if (unserializableValue === '-0')
    return -0;
}
