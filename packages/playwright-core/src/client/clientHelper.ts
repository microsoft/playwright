/**
 * Copyright 2017 Google Inc. All rights reserved.
 * Modifications copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import fs from 'fs';

import { isString } from '@isomorphic/rtti';
import { kBindingsControllerProperty, kFunctionBindingPrefix, serializeAsCallArgument } from '@isomorphic/utilityScriptSerializers';
import { createGuid } from '@utils/crypto';

export function envObjectToArray(env: NodeJS.ProcessEnv): { name: string, value: string }[] {
  const result: { name: string, value: string }[] = [];
  for (const name in env) {
    if (!Object.is(env[name], undefined))
      result.push({ name, value: String(env[name]) });
  }
  return result;
}

export async function evaluationScript(fun: Function | string | { path?: string, content?: string }, arg?: any, addSourceUrl: boolean = true): Promise<string> {
  if (typeof fun === 'function') {
    const source = fun.toString();
    const argString = Object.is(arg, undefined) ? 'undefined' : JSON.stringify(arg);
    return `(${source})(${argString})`;
  }
  if (arg !== undefined)
    throw new Error('Cannot evaluate a string with arguments');
  if (isString(fun))
    return fun;
  if (fun.content !== undefined)
    return fun.content;
  if (fun.path !== undefined) {
    let source = await fs.promises.readFile(fun.path, 'utf8');
    if (addSourceUrl)
      source = addSourceUrlToScript(source, fun.path);
    return source;
  }
  throw new Error('Either path or content property must be present');
}

export async function initScriptSourceWithExposedFunctions(fun: Function, arg: any, expose: (name: string, callback: Function) => Promise<void>): Promise<string> {
  const exposePromises: Promise<void>[] = [];
  const serialized = serializeAsCallArgument(arg, value => {
    if (typeof value === 'function') {
      const name = kFunctionBindingPrefix + createGuid();
      exposePromises.push(expose(name, value));
      return { fn: name };
    }
    return { fallThrough: value };
  });
  await Promise.all(exposePromises);
  // Bindings backing the functions are registered through their own init scripts
  // that are guaranteed to run first, so the controller is available here.
  return `(${fun.toString()})(globalThis['${kBindingsControllerProperty}'].parseInitScriptArg(${JSON.stringify(serialized)}))`;
}

export function addSourceUrlToScript(source: string, path: string): string {
  return `${source}\n//# sourceURL=${path.replace(/\n/g, '')}`;
}
