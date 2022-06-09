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

import type * as dom from './dom';
import * as utilityScriptSource from '../generated/utilityScriptSource';
import { serializeAsCallArgument } from './isomorphic/utilityScriptSerializers';
import { type UtilityScript } from './injected/utilityScript';
import { SdkObject } from './instrumentation';
import { ManualPromise } from '../utils/manualPromise';

export type ObjectId = string;
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
  rawEvaluateJSON(expression: string): Promise<any>;
  rawEvaluateHandle(expression: string): Promise<ObjectId>;
  rawCallFunctionNoReply(func: Function, ...args: any[]): void;
  evaluateWithArguments(expression: string, returnByValue: boolean, utilityScript: JSHandle<any>, values: any[], objectIds: ObjectId[]): Promise<any>;
  getProperties(context: ExecutionContext, objectId: ObjectId): Promise<Map<string, JSHandle>>;
  createHandle(context: ExecutionContext, remoteObject: RemoteObject): JSHandle;
  releaseHandle(objectId: ObjectId): Promise<void>;
}

export class ExecutionContext extends SdkObject {
  private _delegate: ExecutionContextDelegate;
  private _utilityScriptPromise: Promise<JSHandle> | undefined;
  private _destroyedPromise = new ManualPromise<Error>();

  constructor(parent: SdkObject, delegate: ExecutionContextDelegate) {
    super(parent, 'execution-context');
    this._delegate = delegate;
  }

  contextDestroyed(error: Error) {
    this._destroyedPromise.resolve(error);
  }

  private _raceAgainstContextDestroyed<T>(promise: Promise<T>): Promise<T> {
    return Promise.race([
      this._destroyedPromise.then(e => { throw e; }),
      promise,
    ]);
  }

  rawEvaluateJSON(expression: string): Promise<any> {
    return this._raceAgainstContextDestroyed(this._delegate.rawEvaluateJSON(expression));
  }

  rawEvaluateHandle(expression: string): Promise<ObjectId> {
    return this._raceAgainstContextDestroyed(this._delegate.rawEvaluateHandle(expression));
  }

  rawCallFunctionNoReply(func: Function, ...args: any[]): void {
    this._delegate.rawCallFunctionNoReply(func, ...args);
  }

  evaluateWithArguments(expression: string, returnByValue: boolean, utilityScript: JSHandle<any>, values: any[], objectIds: ObjectId[]): Promise<any> {
    return this._raceAgainstContextDestroyed(this._delegate.evaluateWithArguments(expression, returnByValue, utilityScript, values, objectIds));
  }

  getProperties(context: ExecutionContext, objectId: ObjectId): Promise<Map<string, JSHandle>> {
    return this._raceAgainstContextDestroyed(this._delegate.getProperties(context, objectId));
  }

  createHandle(remoteObject: RemoteObject): JSHandle {
    return this._delegate.createHandle(this, remoteObject);
  }

  releaseHandle(objectId: ObjectId): Promise<void> {
    return this._delegate.releaseHandle(objectId);
  }

  async waitForSignalsCreatedBy<T>(action: () => Promise<T>): Promise<T> {
    return action();
  }

  adoptIfNeeded(handle: JSHandle): Promise<JSHandle> | null {
    return null;
  }

  utilityScript(): Promise<JSHandle<UtilityScript>> {
    if (!this._utilityScriptPromise) {
      const source = `
      (() => {
        const module = {};
        ${utilityScriptSource.source}
        return new module.exports();
      })();`;
      this._utilityScriptPromise = this._raceAgainstContextDestroyed(this._delegate.rawEvaluateHandle(source).then(objectId => new JSHandle(this, 'object', undefined, objectId)));
    }
    return this._utilityScriptPromise;
  }

  async doSlowMo() {
    // overridden in FrameExecutionContext
  }
}

export class JSHandle<T = any> extends SdkObject {
  readonly _context: ExecutionContext;
  _disposed = false;
  readonly _objectId: ObjectId | undefined;
  readonly _value: any;
  private _objectType: string;
  protected _preview: string;
  private _previewCallback: ((preview: string) => void) | undefined;

  constructor(context: ExecutionContext, type: string, preview: string | undefined, objectId?: ObjectId, value?: any) {
    super(context, 'handle');
    this._context = context;
    this._objectId = objectId;
    this._value = value;
    this._objectType = type;
    this._preview = this._objectId ? preview || `JSHandle@${this._objectType}` : String(value);
  }

  callFunctionNoReply(func: Function, arg: any) {
    this._context.rawCallFunctionNoReply(func, this, arg);
  }

  async evaluate<R, Arg>(pageFunction: FuncOn<T, Arg, R>, arg?: Arg): Promise<R> {
    return evaluate(this._context, true /* returnByValue */, pageFunction, this, arg);
  }

  async evaluateHandle<R, Arg>(pageFunction: FuncOn<T, Arg, R>, arg?: Arg): Promise<SmartHandle<R>> {
    return evaluate(this._context, false /* returnByValue */, pageFunction, this, arg);
  }

  async evaluateExpressionAndWaitForSignals(expression: string, isFunction: boolean | undefined, returnByValue: boolean, arg: any) {
    const value = await evaluateExpressionAndWaitForSignals(this._context, returnByValue, expression, isFunction, this, arg);
    await this._context.doSlowMo();
    return value;
  }

  async getProperty(propertyName: string): Promise<JSHandle> {
    const objectHandle = await this.evaluateHandle((object: any, propertyName) => {
      const result: any = { __proto__: null };
      result[propertyName] = object[propertyName];
      return result;
    }, propertyName);
    const properties = await objectHandle.getProperties();
    const result = properties.get(propertyName)!;
    objectHandle.dispose();
    return result;
  }

  async getProperties(): Promise<Map<string, JSHandle>> {
    if (!this._objectId)
      return new Map();
    return this._context.getProperties(this._context, this._objectId);
  }

  rawValue() {
    return this._value;
  }

  async jsonValue(): Promise<T> {
    if (!this._objectId)
      return this._value;
    const utilityScript = await this._context.utilityScript();
    const script = `(utilityScript, ...args) => utilityScript.jsonValue(...args)`;
    return this._context.evaluateWithArguments(script, true, utilityScript, [true], [this._objectId]);
  }

  asElement(): dom.ElementHandle | null {
    return null;
  }

  dispose() {
    if (this._disposed)
      return;
    this._disposed = true;
    if (this._objectId)
      this._context.releaseHandle(this._objectId).catch(e => {});
  }

  override toString(): string {
    return this._preview;
  }

  _setPreviewCallback(callback: (preview: string) => void) {
    this._previewCallback = callback;
  }

  preview(): string {
    return this._preview;
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

export async function evaluateExpression(context: ExecutionContext, returnByValue: boolean, expression: string, isFunction: boolean | undefined, ...args: any[]): Promise<any> {
  const utilityScript = await context.utilityScript();
  expression = normalizeEvaluationExpression(expression, isFunction);
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

  // See UtilityScript for arguments.
  const utilityScriptValues = [isFunction, returnByValue, expression, args.length, ...args];

  const script = `(utilityScript, ...args) => utilityScript.evaluate(...args)`;
  try {
    return await context.evaluateWithArguments(script, returnByValue, utilityScript, utilityScriptValues, utilityScriptObjectIds);
  } finally {
    toDispose.map(handlePromise => handlePromise.then(handle => handle.dispose()));
  }
}

export async function evaluateExpressionAndWaitForSignals(context: ExecutionContext, returnByValue: boolean, expression: string, isFunction?: boolean, ...args: any[]): Promise<any> {
  return await context.waitForSignalsCreatedBy(() => evaluateExpression(context, returnByValue, expression, isFunction, ...args));
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

export function normalizeEvaluationExpression(expression: string, isFunction: boolean | undefined): string {
  expression = expression.trim();

  if (isFunction) {
    try {
      new Function('(' + expression + ')');
    } catch (e1) {
      // This means we might have a function shorthand. Try another
      // time prefixing 'function '.
      if (expression.startsWith('async '))
        expression = 'async function ' + expression.substring('async '.length);
      else
        expression = 'function ' + expression;
      try {
        new Function('(' + expression  + ')');
      } catch (e2) {
        // We tried hard to serialize, but there's a weird beast here.
        throw new Error('Passed function is not well-serializable!');
      }
    }
  }

  if (/^(async)?\s*function(\s|\()/.test(expression))
    expression = '(' + expression + ')';
  return expression;
}

// Error inside the expression evaluation as opposed to a protocol error.
export class JavaScriptErrorInEvaluate extends Error {
}

export function isJavaScriptErrorInEvaluate(error: Error) {
  return error instanceof JavaScriptErrorInEvaluate;
}
