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

import * as types from './types';
import * as dom from './dom';
import * as utilityScriptSource from './generated/utilityScriptSource';
import { InnerLogger } from './logger';
import * as debugSupport from './debug/debugSupport';
import { serializeAsCallArgument } from './utilityScriptSerializers';

export type RemoteObject = {
  objectId?: string,
  value?: any
};

export interface ExecutionContextDelegate {
  evaluate(context: ExecutionContext, returnByValue: boolean, pageFunction: string | Function, ...args: any[]): Promise<any>;
  rawEvaluate(pageFunction: string): Promise<string>;
  getProperties(handle: JSHandle): Promise<Map<string, JSHandle>>;
  createHandle(context: ExecutionContext, remoteObject: RemoteObject): JSHandle;
  releaseHandle(handle: JSHandle): Promise<void>;
  handleJSONValue<T>(handle: JSHandle<T>): Promise<T>;
}

export class ExecutionContext {
  readonly _delegate: ExecutionContextDelegate;
  readonly _logger: InnerLogger;
  private _utilityScriptPromise: Promise<JSHandle> | undefined;

  constructor(delegate: ExecutionContextDelegate, logger: InnerLogger) {
    this._delegate = delegate;
    this._logger = logger;
  }

  doEvaluateInternal(returnByValue: boolean, waitForNavigations: boolean, pageFunction: string | Function, ...args: any[]): Promise<any> {
    return this._delegate.evaluate(this, returnByValue, pageFunction, ...args);
  }

  adoptIfNeeded(handle: JSHandle): Promise<JSHandle> | null {
    return null;
  }

  async evaluateInternal<R>(pageFunction: types.Func0<R>): Promise<R>;
  async evaluateInternal<Arg, R>(pageFunction: types.Func1<Arg, R>, arg: Arg): Promise<R>;
  async evaluateInternal(pageFunction: never, ...args: never[]): Promise<any> {
    return this.doEvaluateInternal(true /* returnByValue */, true /* waitForNavigations */, pageFunction, ...args);
  }

  async evaluateHandleInternal<R>(pageFunction: types.Func0<R>): Promise<types.SmartHandle<R>>;
  async evaluateHandleInternal<Arg, R>(pageFunction: types.Func1<Arg, R>, arg: Arg): Promise<types.SmartHandle<R>>;
  async evaluateHandleInternal(pageFunction: never, ...args: never[]): Promise<any> {
    return this.doEvaluateInternal(false /* returnByValue */, true /* waitForNavigations */, pageFunction, ...args);
  }

  utilityScript(): Promise<JSHandle> {
    if (!this._utilityScriptPromise) {
      const source = `new (${utilityScriptSource.source})()`;
      this._utilityScriptPromise = this._delegate.rawEvaluate(source).then(objectId => new JSHandle(this, 'object', objectId));
    }
    return this._utilityScriptPromise;
  }

  createHandle(remoteObject: RemoteObject): JSHandle {
    return this._delegate.createHandle(this, remoteObject);
  }
}

export class JSHandle<T = any> {
  readonly _context: ExecutionContext;
  _disposed = false;
  readonly _objectId: string | undefined;
  readonly _value: any;
  private _type: string;

  constructor(context: ExecutionContext, type: string, objectId?: string, value?: any) {
    this._context = context;
    this._objectId = objectId;
    this._value = value;
    this._type = type;
  }

  async evaluate<R, Arg>(pageFunction: types.FuncOn<T, Arg, R>, arg: Arg): Promise<R>;
  async evaluate<R>(pageFunction: types.FuncOn<T, void, R>, arg?: any): Promise<R>;
  async evaluate<R, Arg>(pageFunction: types.FuncOn<T, Arg, R>, arg: Arg): Promise<R> {
    return this._context.doEvaluateInternal(true /* returnByValue */, true /* waitForNavigations */, pageFunction, this, arg);
  }

  async evaluateHandle<R, Arg>(pageFunction: types.FuncOn<T, Arg, R>, arg: Arg): Promise<types.SmartHandle<R>>;
  async evaluateHandle<R>(pageFunction: types.FuncOn<T, void, R>, arg?: any): Promise<types.SmartHandle<R>>;
  async evaluateHandle<R, Arg>(pageFunction: types.FuncOn<T, Arg, R>, arg: Arg): Promise<types.SmartHandle<R>> {
    return this._context.doEvaluateInternal(false /* returnByValue */, true /* waitForNavigations */, pageFunction, this, arg);
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

  jsonValue(): Promise<T> {
    return this._context._delegate.handleJSONValue(this);
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

  _handleToString(includeType: boolean): string {
    if (this._objectId)
      return 'JSHandle@' + this._type;
    return (includeType ? 'JSHandle:' : '') + this._value;
  }

  toString(): string {
    return this._handleToString(true);
  }
}

type CallArgument = {
  value?: any,
  objectId?: string
}

export async function prepareFunctionCall(
  pageFunction: Function,
  context: ExecutionContext,
  args: any[]): Promise<{ functionText: string, values: any[], handles: CallArgument[], dispose: () => void }> {

  const originalText = pageFunction.toString();
  let functionText = originalText;
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

  args = args.map(arg => serializeAsCallArgument(arg, (handle: any): { h?: number, fallThrough?: any } => {
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
  const resultHandles: CallArgument[] = [];
  for (const handle of await Promise.all(handles)) {
    if (handle._context !== context)
      throw new Error('JSHandles can be evaluated only in the context they were created!');
    resultHandles.push({ objectId: handle._objectId });
  }
  const dispose = () => {
    toDispose.map(handlePromise => handlePromise.then(handle => handle.dispose()));
  };

  functionText += await debugSupport.generateSourceMapUrl(originalText, functionText);
  return { functionText, values: [ args.length, ...args ], handles: resultHandles, dispose };
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
