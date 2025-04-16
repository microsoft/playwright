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

import { builtins } from '../utils/isomorphic/builtins';
import { source } from '../utils/isomorphic/utilityScriptSerializers';

import type { Builtins } from '../utils/isomorphic/builtins';
import type { SerializedValue } from '../utils/isomorphic/utilityScriptSerializers';

export type BindingPayload = {
  name: string;
  seq: number;
  serializedArgs?: SerializedValue[],
};

function addPageBinding(playwrightBinding: string, bindingName: string, needsHandle: boolean, utilityScriptSerializersFactory: typeof source, builtins: Builtins) {
  const { serializeAsCallArgument } = utilityScriptSerializersFactory(builtins);
  // eslint-disable-next-line no-restricted-globals
  const binding = (globalThis as any)[playwrightBinding];
  // eslint-disable-next-line no-restricted-globals
  (globalThis as any)[bindingName] = (...args: any[]) => {
  // eslint-disable-next-line no-restricted-globals
    const me = (globalThis as any)[bindingName];
    if (needsHandle && args.slice(1).some(arg => arg !== undefined))
      throw new Error(`exposeBindingHandle supports a single argument, ${args.length} received`);
    let callbacks = me['callbacks'];
    if (!callbacks) {
      callbacks = new builtins.Map();
      me['callbacks'] = callbacks;
    }
    const seq: number = (me['lastSeq'] || 0) + 1;
    me['lastSeq'] = seq;
    let handles = me['handles'];
    if (!handles) {
      handles = new builtins.Map();
      me['handles'] = handles;
    }
    const promise = new Promise((resolve, reject) => callbacks.set(seq, { resolve, reject }));
    let payload: BindingPayload;
    if (needsHandle) {
      handles.set(seq, args[0]);
      payload = { name: bindingName, seq };
    } else {
      const serializedArgs = [];
      for (let i = 0; i < args.length; i++) {
        serializedArgs[i] = serializeAsCallArgument(args[i], v => {
          return { fallThrough: v };
        });
      }
      payload = { name: bindingName, seq, serializedArgs };
    }
    binding(JSON.stringify(payload));
    return promise;
  };
  // eslint-disable-next-line no-restricted-globals
  (globalThis as any)[bindingName].__installed = true;
}

export function takeBindingHandle(arg: { name: string, seq: number }) {
  // eslint-disable-next-line no-restricted-globals
  const handles = (globalThis as any)[arg.name]['handles'];
  const handle = handles.get(arg.seq);
  handles.delete(arg.seq);
  return handle;
}

export function deliverBindingResult(arg: { name: string, seq: number, result?: any, error?: any }) {
  // eslint-disable-next-line no-restricted-globals
  const callbacks = (globalThis as any)[arg.name]['callbacks'];
  if ('error' in arg)
    callbacks.get(arg.seq).reject(arg.error);
  else
    callbacks.get(arg.seq).resolve(arg.result);
  callbacks.delete(arg.seq);
}

export function createPageBindingScript(playwrightBinding: string, name: string, needsHandle: boolean) {
  return `(${addPageBinding.toString()})(${JSON.stringify(playwrightBinding)}, ${JSON.stringify(name)}, ${needsHandle}, (${source}), (${builtins})())`;
}
