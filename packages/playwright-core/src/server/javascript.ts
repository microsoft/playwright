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

import { SdkObject } from './instrumentation';
import * as rawUtilityScriptSource from '../generated/utilityScriptSource';
import { isUnderTest } from '../utils';
import { serializeAsCallArgument } from '../utils/isomorphic/utilityScriptSerializers';
import { LongStandingScope } from '../utils/isomorphic/manualPromise';

import type * as dom from './dom';
import type { UtilityScript } from '@injected/utilityScript';

interface TaggedAsJSHandle<T> {
  __jshandle: T;
}
interface TaggedAsElementHandle<T> {
  __elementhandle: T;
}
type NoHandles<Arg> = Arg extends TaggedAsJSHandle<any> ? never : (Arg extends object ? { [Key in keyof Arg]: NoHandles<Arg[Key]> } : Arg);
type Unboxed<Arg> =
  Arg extends TaggedAsElementHandle<infer T> ? T :
  Arg extends TaggedAsJSHandle<infer T> ? T :
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
  rawEvaluateHandle(context: ExecutionContext, expression: string): Promise<JSHandle>;
  evaluateWithArguments(expression: string, returnByValue: boolean, utilityScript: JSHandle, values: any[], handles: JSHandle[]): Promise<any>;
  getProperties(object: JSHandle): Promise<Map<string, JSHandle>>;
  releaseHandle(handle: JSHandle): Promise<void>;
}

export class ExecutionContext extends SdkObject {
  readonly delegate: ExecutionContextDelegate;
  private _utilityScriptPromise: Promise<JSHandle> | undefined;
  private _contextDestroyedScope = new LongStandingScope();
  readonly worldNameForTest: string;

  constructor(parent: SdkObject, delegate: ExecutionContextDelegate, worldNameForTest: string) {
    super(parent, 'execution-context');
    this.worldNameForTest = worldNameForTest;
    this.delegate = delegate;
  }

  contextDestroyed(reason: string) {
    this._contextDestroyedScope.close(new Error(reason));
  }

  async _raceAgainstContextDestroyed<T>(promise: Promise<T>): Promise<T> {
    return this._contextDestroyedScope.race(promise);
  }

  rawEvaluateJSON(expression: string): Promise<any> {
    return this._raceAgainstContextDestroyed(this.delegate.rawEvaluateJSON(expression));
  }

  rawEvaluateHandle(expression: string): Promise<JSHandle> {
    return this._raceAgainstContextDestroyed(this.delegate.rawEvaluateHandle(this, expression));
  }

  async evaluateWithArguments(expression: string, returnByValue: boolean, values: any[], handles: JSHandle[]): Promise<any> {
    const utilityScript = await this.utilityScript();
    return this._raceAgainstContextDestroyed(this.delegate.evaluateWithArguments(expression, returnByValue, utilityScript, values, handles));
  }

  getProperties(object: JSHandle): Promise<Map<string, JSHandle>> {
    return this._raceAgainstContextDestroyed(this.delegate.getProperties(object));
  }

  releaseHandle(handle: JSHandle): Promise<void> {
    return this.delegate.releaseHandle(handle);
  }

  adoptIfNeeded(handle: JSHandle): Promise<JSHandle> | null {
    return null;
  }

  utilityScript(): Promise<JSHandle<UtilityScript>> {
    if (!this._utilityScriptPromise) {
      const source = `
      (() => {
        const module = {};
        ${rawUtilityScriptSource.source}
        return new (module.exports.UtilityScript())(globalThis, ${isUnderTest()});
      })();`;
      this._utilityScriptPromise = this._raceAgainstContextDestroyed(this.delegate.rawEvaluateHandle(this, source))
          .then(handle => {
            handle._setPreview('UtilityScript');
            return handle;
          });
    }
    return this._utilityScriptPromise;
  }

  async doSlowMo() {
    // overridden in FrameExecutionContext
  }
}

export class JSHandle<T = any> extends SdkObject {
  __jshandle: T = true as any;
  readonly _context: ExecutionContext;
  _disposed = false;
  readonly _objectId: string | undefined;
  readonly _value: any;
  private _objectType: string;
  protected _preview: string;
  private _previewCallback: ((preview: string) => void) | undefined;

  constructor(context: ExecutionContext, type: string, preview: string | undefined, objectId?: string, value?: any) {
    super(context, 'handle');
    this._context = context;
    this._objectId = objectId;
    this._value = value;
    this._objectType = type;
    this._preview = this._objectId ? preview || `JSHandle@${this._objectType}` : String(value);
    if (this._objectId && (globalThis as any).leakedJSHandles)
      (globalThis as any).leakedJSHandles.set(this, new Error('Leaked JSHandle'));
  }

  async evaluate<R, Arg>(pageFunction: FuncOn<T, Arg, R>, arg?: Arg): Promise<R> {
    return evaluate(this._context, true /* returnByValue */, pageFunction, this, arg);
  }

  async evaluateHandle<R, Arg>(pageFunction: FuncOn<T, Arg, R>, arg?: Arg): Promise<SmartHandle<R>> {
    return evaluate(this._context, false /* returnByValue */, pageFunction, this, arg);
  }

  async evaluateExpression(expression: string, options: { isFunction?: boolean }, arg: any) {
    const value = await evaluateExpression(this._context, expression, { ...options, returnByValue: true }, this, arg);
    await this._context.doSlowMo();
    return value;
  }

  async evaluateExpressionHandle(expression: string, options: { isFunction?: boolean }, arg: any): Promise<JSHandle<any>> {
    const value = await evaluateExpression(this._context, expression, { ...options, returnByValue: false }, this, arg);
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
    return this._context.getProperties(this);
  }

  rawValue() {
    return this._value;
  }

  async jsonValue(): Promise<T> {
    if (!this._objectId)
      return this._value;
    const script = `(utilityScript, ...args) => utilityScript.jsonValue(...args)`;
    return this._context.evaluateWithArguments(script, true, [true], [this]);
  }

  asElement(): dom.ElementHandle | null {
    return null;
  }

  dispose() {
    if (this._disposed)
      return;
    this._disposed = true;
    if (this._objectId) {
      this._context.releaseHandle(this).catch(e => {});
      if ((globalThis as any).leakedJSHandles)
        (globalThis as any).leakedJSHandles.delete(this);
    }
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

  worldNameForTest(): string {
    return this._context.worldNameForTest;
  }

  _setPreview(preview: string) {
    this._preview = preview;
    if (this._previewCallback)
      this._previewCallback(preview);
  }
}

export async function evaluate(context: ExecutionContext, returnByValue: boolean, pageFunction: Function | string, ...args: any[]): Promise<any> {
  return evaluateExpression(context, String(pageFunction), { returnByValue, isFunction: typeof pageFunction === 'function' }, ...args);
}

export async function evaluateExpression(context: ExecutionContext, expression: string, options: { returnByValue?: boolean, isFunction?: boolean }, ...args: any[]): Promise<any> {
  expression = normalizeEvaluationExpression(expression, options.isFunction);
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
        throw new JavaScriptErrorInEvaluate('JSHandle is disposed!');
      const adopted = context.adoptIfNeeded(handle);
      if (adopted === null)
        return { h: pushHandle(Promise.resolve(handle)) };
      toDispose.push(adopted);
      return { h: pushHandle(adopted) };
    }
    return { fallThrough: handle };
  }));

  const utilityScriptObjects: JSHandle[] = [];
  for (const handle of await Promise.all(handles)) {
    if (handle._context !== context)
      throw new JavaScriptErrorInEvaluate('JSHandles can be evaluated only in the context they were created!');
    utilityScriptObjects.push(handle);
  }

  // See UtilityScript for arguments.
  const utilityScriptValues = [options.isFunction, options.returnByValue, expression, args.length, ...args];

  const script = `(utilityScript, ...args) => utilityScript.evaluate(...args)`;
  try {
    return await context.evaluateWithArguments(script, options.returnByValue || false, utilityScriptValues, utilityScriptObjects);
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

export function sparseArrayToString(entries: { name: string, value?: any }[]): string {
  const arrayEntries = [];
  for (const { name, value } of entries) {
    const index = +name;
    if (isNaN(index) || index < 0)
      continue;
    arrayEntries.push({ index, value });
  }
  arrayEntries.sort((a, b) => a.index - b.index);
  let lastIndex = -1;
  const tokens = [];
  for (const { index, value } of arrayEntries) {
    const emptyItems = index - lastIndex - 1;
    if (emptyItems === 1)
      tokens.push(`empty`);
    else if (emptyItems > 1)
      tokens.push(`empty x ${emptyItems}`);
    tokens.push(String(value));
    lastIndex = index;
  }

  return '[' + tokens.join(', ') + ']';
}
