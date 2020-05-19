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
import * as fs from 'fs';
import * as util from 'util';
import { helper, getCallerFilePath, isDebugMode } from './helper';
import { InnerLogger } from './logger';

export interface ExecutionContextDelegate {
  evaluate(context: ExecutionContext, returnByValue: boolean, pageFunction: string | Function, ...args: any[]): Promise<any>;
  getProperties(handle: JSHandle): Promise<Map<string, JSHandle>>;
  releaseHandle(handle: JSHandle): Promise<void>;
  handleToString(handle: JSHandle, includeType: boolean): string;
  handleJSONValue<T>(handle: JSHandle<T>): Promise<T>;
}

export class ExecutionContext {
  readonly _delegate: ExecutionContextDelegate;
  readonly _logger: InnerLogger;

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

  createHandle(remoteObject: any): JSHandle {
    return new JSHandle(this, remoteObject);
  }
}

export class JSHandle<T = any> {
  readonly _context: ExecutionContext;
  readonly _remoteObject: any;
  _disposed = false;

  constructor(context: ExecutionContext, remoteObject: any) {
    this._context = context;
    this._remoteObject = remoteObject;
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

  toString(): string {
    return this._context._delegate.handleToString(this, true /* includeType */);
  }
}

export async function prepareFunctionCall<T>(
  pageFunction: Function,
  context: ExecutionContext,
  args: any[],
  toCallArgumentIfNeeded: (value: any) => { handle?: T, value?: any }): Promise<{ functionText: string, values: any[], handles: T[], dispose: () => void }> {

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

  const guids: string[] = [];
  const handles: (Promise<JSHandle | T>)[] = [];
  const toDispose: Promise<JSHandle>[] = [];
  const pushHandle = (handle: Promise<JSHandle | T>): string => {
    const guid = helper.guid();
    guids.push(guid);
    handles.push(handle);
    return guid;
  };

  const visited = new Set<any>();
  let error: string | undefined;
  const visit = (arg: any, depth: number): any => {
    if (!depth) {
      error = 'Argument nesting is too deep';
      return;
    }
    if (visited.has(arg)) {
      error = 'Argument is a circular structure';
      return;
    }
    if (Array.isArray(arg)) {
      visited.add(arg);
      const result = [];
      for (let i = 0; i < arg.length; ++i)
        result.push(visit(arg[i], depth - 1));
      visited.delete(arg);
      return result;
    }
    if (arg && (typeof arg === 'object') && !(arg instanceof JSHandle)) {
      visited.add(arg);
      const result: any = {};
      for (const name of Object.keys(arg))
        result[name] = visit(arg[name], depth - 1);
      visited.delete(arg);
      return result;
    }
    if (arg && (arg instanceof JSHandle)) {
      if (arg._disposed)
        throw new Error('JSHandle is disposed!');
      const adopted = context.adoptIfNeeded(arg);
      if (adopted === null)
        return pushHandle(Promise.resolve(arg));
      toDispose.push(adopted);
      return pushHandle(adopted);
    }
    const { handle, value } = toCallArgumentIfNeeded(arg);
    if (handle)
      return pushHandle(Promise.resolve(handle));
    return value;
  };

  args = args.map(arg => visit(arg, 100));
  if (error)
    throw new Error(error);

  if (!guids.length) {
    const sourceMapUrl = await generateSourceMapUrl(originalText, { line: 0, column: 0 });
    functionText += sourceMapUrl;
    return { functionText, values: args, handles: [], dispose: () => {} };
  }

  const wrappedFunctionText = `(...__playwright__args__) => {
    return (${functionText})(...(() => {
      const args = __playwright__args__;
      __playwright__args__ = undefined;
      const argCount = args[0];
      const handleCount = args[argCount + 1];
      const handles = { __proto__: null };
      for (let i = 0; i < handleCount; i++)
        handles[args[argCount + 2 + i]] = args[argCount + 2 + handleCount + i];
      const visit = (arg) => {
        if ((typeof arg === 'string') && (arg in handles))
          return handles[arg];
        if (arg && (typeof arg === 'object')) {
          for (const name of Object.keys(arg))
            arg[name] = visit(arg[name]);
        }
        return arg;
      };
      const result = [];
      for (let i = 0; i < argCount; i++)
        result[i] = visit(args[i + 1]);
      return result;
    })());
  }`;
  const compiledPosition = findPosition(wrappedFunctionText, wrappedFunctionText.indexOf(functionText));
  functionText = wrappedFunctionText;

  const resolved = await Promise.all(handles);
  const resultHandles: T[] = [];
  for (let i = 0; i < resolved.length; i++) {
    const handle = resolved[i];
    if (handle instanceof JSHandle) {
      if (handle._context !== context)
        throw new Error('JSHandles can be evaluated only in the context they were created!');
      resultHandles.push(toCallArgumentIfNeeded(handle).handle!);
    } else {
      resultHandles.push(handle);
    }
  }
  const dispose = () => {
    toDispose.map(handlePromise => handlePromise.then(handle => handle.dispose()));
  };

  const sourceMapUrl = await generateSourceMapUrl(originalText, compiledPosition);
  functionText += sourceMapUrl;
  return { functionText, values: [ args.length, ...args, guids.length, ...guids ], handles: resultHandles, dispose };
}

let sourceUrlCounter = 0;
const playwrightSourceUrlPrefix = '__playwright_evaluation_script__';
const sourceUrlRegex = /^[\040\t]*\/\/[@#] sourceURL=\s*(\S*?)\s*$/m;
export function generateSourceUrl(): string {
  return `\n//# sourceURL=${playwrightSourceUrlPrefix}${sourceUrlCounter++}\n`;
}

export function isPlaywrightSourceUrl(s: string): boolean {
  return s.startsWith(playwrightSourceUrlPrefix);
}

export function ensureSourceUrl(expression: string): string {
  return sourceUrlRegex.test(expression) ? expression : expression + generateSourceUrl();
}

type Position = {
  line: number;
  column: number;
};

async function generateSourceMapUrl(functionText: string, compiledPosition: Position): Promise<string> {
  if (!isDebugMode())
    return generateSourceUrl();
  const filePath = getCallerFilePath();
  if (!filePath)
    return generateSourceUrl();
  try {
    const source = await util.promisify(fs.readFile)(filePath, 'utf8');
    const index = source.indexOf(functionText);
    if (index === -1)
      return generateSourceUrl();
    const sourcePosition = findPosition(source, index);
    const delta = findPosition(functionText, functionText.length);
    const sourceMap = generateSourceMap(filePath, sourcePosition, compiledPosition, delta);
    return `\n//# sourceMappingURL=data:application/json;base64,${Buffer.from(sourceMap).toString('base64')}\n`;
  } catch (e) {
    return generateSourceUrl();
  }
}

const VLQ_BASE_SHIFT = 5;
const VLQ_BASE = 1 << VLQ_BASE_SHIFT;
const VLQ_BASE_MASK = VLQ_BASE - 1;
const VLQ_CONTINUATION_BIT = VLQ_BASE;
const BASE64_DIGITS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function base64VLQ(value: number): string {
  if (value < 0)
    value = ((-value) << 1) | 1;
  else
    value <<= 1;
  let result = '';
  do {
    let digit = value & VLQ_BASE_MASK;
    value >>>= VLQ_BASE_SHIFT;
    if (value > 0)
      digit |= VLQ_CONTINUATION_BIT;
    result += BASE64_DIGITS[digit];
  } while (value > 0);
  return result;
}

function generateSourceMap(filePath: string, sourcePosition: Position, compiledPosition: Position, delta: Position): any {
  const mappings = [];
  let lastCompiled = { line: 0, column: 0 };
  let lastSource = { line: 0, column: 0 };
  for (let line = 0; line < delta.line; line++) {
    // We need at least a mapping per line. This will yield an execution line at the start of each line.
    // Note: for more granular mapping, we can do word-by-word.
    const source = advancePosition(sourcePosition, { line, column: 0 });
    const compiled = advancePosition(compiledPosition, { line, column: 0 });
    while (lastCompiled.line < compiled.line) {
      mappings.push(';');
      lastCompiled.line++;
      lastCompiled.column = 0;
    }
    mappings.push(base64VLQ(compiled.column - lastCompiled.column));
    mappings.push(base64VLQ(0)); // Source index.
    mappings.push(base64VLQ(source.line - lastSource.line));
    mappings.push(base64VLQ(source.column - lastSource.column));
    lastCompiled = compiled;
    lastSource = source;
  }
  return JSON.stringify({
    version: 3,
    sources: ['file://' + filePath],
    names: [],
    mappings: mappings.join(''),
  });
}

function findPosition(source: string, offset: number): Position {
  const result: Position = { line: 0, column: 0 };
  let index = 0;
  while (true) {
    const newline = source.indexOf('\n', index);
    if (newline === -1 || newline >= offset)
      break;
    result.line++;
    index = newline + 1;
  }
  result.column = offset - index;
  return result;
}

function advancePosition(position: Position, delta: Position) {
  return {
    line: position.line + delta.line,
    column: delta.column + (delta.line ? 0 : position.column),
  };
}
