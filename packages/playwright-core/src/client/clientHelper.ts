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
import { DisposableObject, DisposableStub, disposeAll } from './disposable';

import type { Disposable } from './disposable';
import type * as channels from './channels';
import type * as structs from '../../types/structs';

export function envObjectToArray(env: NodeJS.ProcessEnv): { name: string, value: string }[] {
  const result: { name: string, value: string }[] = [];
  for (const name in env) {
    if (!Object.is(env[name], undefined))
      result.push({ name, value: String(env[name]) });
  }
  return result;
}

function serializeArgument(arg: any): string {
  return Object.is(arg, undefined) ? 'undefined' : JSON.stringify(arg);
}

export async function evaluationScript(fun: Function | string | { path?: string, content?: string }, arg?: any, addSourceUrl: boolean = true): Promise<string> {
  if (typeof fun === 'function')
    return `(${fun.toString()})(${serializeArgument(arg)})`;
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

export function addSourceUrlToScript(source: string, path: string): string {
  return `${source}\n//# sourceURL=${path.replace(/\n/g, '')}`;
}

export async function exposeCallbackBinding(
  bindings: Map<string, (source: structs.BindingSource, ...args: any[]) => any>,
  exposeBinding: (params: { name: string, noGlobal: boolean }) => Promise<channels.DisposableChannel>,
  name: string,
  callback: Function,
): Promise<Disposable> {
  bindings.set(name, (source, ...args) => callback(...args));
  let channel: channels.DisposableChannel;
  try {
    channel = await exposeBinding({ name, noGlobal: true });
  } catch (error) {
    bindings.delete(name);
    throw error;
  }
  const binding = DisposableObject.from(channel);
  return new DisposableStub(async () => {
    try {
      await binding.dispose();
    } finally {
      bindings.delete(name);
    }
  });
}

export async function addInitScript(
  script: Function | string | { path?: string, content?: string },
  arg: any,
  exposeCallback: (name: string, callback: Function) => Promise<Disposable>,
  installInitScript: (source: string) => Promise<channels.DisposableChannel>,
) {
  // String or file scripts take no `arg`, and functions without an `arg` cannot carry callbacks.
  if (typeof script !== 'function' || arg === undefined)
    return DisposableObject.from(await installInitScript(await evaluationScript(script, arg)));

  const callbacksToExpose: { name: string, callback: Function }[] = [];
  const serialized = serializeAsCallArgument(arg, value => {
    if (typeof value === 'function') {
      const name = kFunctionBindingPrefix + createGuid();
      callbacksToExpose.push({ name, callback: value });
      return { fn: name };
    }
    return { fallThrough: value };
  });

  if (!callbacksToExpose.length)
    return DisposableObject.from(await installInitScript(await evaluationScript(script, arg)));

  const source = `(${script.toString()})(globalThis['${kBindingsControllerProperty}'].parseArgument(${JSON.stringify(serialized)}))`;

  const disposables: Disposable[] = [];
  let scriptChannel: channels.DisposableChannel;
  try {
    for (const { name, callback } of callbacksToExpose)
      disposables.push(await exposeCallback(name, callback));
    scriptChannel = await installInitScript(source);
  } catch (error) {
    await disposeAll(disposables).catch(() => {});
    throw error;
  }

  const scriptDisposable = DisposableObject.from(scriptChannel);
  return new DisposableStub(async () => {
    try {
      await scriptDisposable.dispose();
    } finally {
      await disposeAll(disposables);
    }
  });
}
