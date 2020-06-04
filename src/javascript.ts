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
import { helper } from './helper';

type ObjectId = string;
export type RemoteObject = {
  objectId?: ObjectId,
  value?: any
};

export interface ExecutionContextDelegate {
  rawEvaluate(expression: string): Promise<ObjectId>;
  evaluateWithArguments(expression: string, returnByValue: boolean, utilityScript: JSHandle<any>, values: any[], objectIds: ObjectId[]): Promise<any>;
  getProperties(handle: JSHandle): Promise<Map<string, JSHandle>>;
  createHandle(context: ExecutionContext, remoteObject: RemoteObject): JSHandle;
  releaseHandle(handle: JSHandle): Promise<void>;
}

export class ExecutionContext {
  readonly _delegate: ExecutionContextDelegate;
  readonly _logger: InnerLogger;
  private _utilityScriptPromise: Promise<JSHandle> | undefined;

  constructor(delegate: ExecutionContextDelegate, logger: InnerLogger) {
    this._delegate = delegate;
    this._logger = logger;
  }

  adoptIfNeeded(handle: JSHandle): Promise<JSHandle> | null {
    return null;
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
  readonly _objectId: ObjectId | undefined;
  readonly _value: any;
  private _objectType: string;

  constructor(context: ExecutionContext, type: string, objectId?: ObjectId, value?: any) {
    this._context = context;
    this._objectId = objectId;
    this._value = value;
    this._objectType = type;
  }

  async evaluate<R, Arg>(pageFunction: types.FuncOn<T, Arg, R>, arg: Arg): Promise<R>;
  async evaluate<R>(pageFunction: types.FuncOn<T, void, R>, arg?: any): Promise<R>;
  async evaluate<R, Arg>(pageFunction: types.FuncOn<T, Arg, R>, arg: Arg): Promise<R> {
    return evaluate(this._context, true /* returnByValue */, pageFunction, this, arg);
  }

  async evaluateHandle<R, Arg>(pageFunction: types.FuncOn<T, Arg, R>, arg: Arg): Promise<types.SmartHandle<R>>;
  async evaluateHandle<R>(pageFunction: types.FuncOn<T, void, R>, arg?: any): Promise<types.SmartHandle<R>>;
  async evaluateHandle<R, Arg>(pageFunction: types.FuncOn<T, Arg, R>, arg: Arg): Promise<types.SmartHandle<R>> {
    return evaluate(this._context, false /* returnByValue */, pageFunction, this, arg);
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
    const script = `(utilityScript, ...args) => utilityScript.jsonValue(...args)` + debugSupport.generateSourceUrl();
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

  _handleToString(includeType: boolean): string {
    if (this._objectId)
      return 'JSHandle@' + this._objectType;
    return (includeType ? 'JSHandle:' : '') + this._value;
  }

  toString(): string {
    return this._handleToString(true);
  }
}

export async function evaluate(context: ExecutionContext, returnByValue: boolean, pageFunction: Function | string, ...args: any[]): Promise<any> {
  const utilityScript = await context.utilityScript();
  if (helper.isString(pageFunction)) {
    const script = `(utilityScript, ...args) => utilityScript.evaluate(...args)` + debugSupport.generateSourceUrl();
    return context._delegate.evaluateWithArguments(script, returnByValue, utilityScript, [returnByValue, debugSupport.ensureSourceUrl(pageFunction)], []);
  }
  if (typeof pageFunction !== 'function')
    throw new Error(`Expected to get |string| or |function| as the first argument, but got "${pageFunction}" instead.`);

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

  const utilityScriptObjectIds: ObjectId[] = [];
  for (const handle of await Promise.all(handles)) {
    if (handle._context !== context)
      throw new Error('JSHandles can be evaluated only in the context they were created!');
    utilityScriptObjectIds.push(handle._objectId!);
  }

  functionText += await debugSupport.generateSourceMapUrl(originalText, functionText);
  // See UtilityScript for arguments.
  const utilityScriptValues = [returnByValue, functionText, args.length, ...args];

  const script = `(utilityScript, ...args) => utilityScript.callFunction(...args)` + debugSupport.generateSourceUrl();
  try {
    return context._delegate.evaluateWithArguments(script, returnByValue, utilityScript, utilityScriptValues, utilityScriptObjectIds);
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
