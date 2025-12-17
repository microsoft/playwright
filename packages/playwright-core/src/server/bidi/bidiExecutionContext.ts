/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an 'AS IS' BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { assert } from '../../utils';
import { parseEvaluationResultValue } from '../../utils/isomorphic/utilityScriptSerializers';
import * as js from '../javascript';
import * as dom from '../dom';
import * as bidi from './third_party/bidiProtocol';
import { BidiSerializer } from './third_party/bidiSerializer';
import { deserializeBidiValue } from './bidiDeserializer';

import type { BidiSession } from './bidiConnection';

export class BidiExecutionContext implements js.ExecutionContextDelegate {
  private readonly _session: BidiSession;
  readonly _target: bidi.Script.Target;

  constructor(session: BidiSession, realmInfo: bidi.Script.RealmInfo) {
    this._session = session;
    if (realmInfo.type === 'window') {
      // Simple realm does not seem to work for Window contexts.
      this._target = {
        context: realmInfo.context,
        sandbox: realmInfo.sandbox,
      };
    } else {
      this._target = {
        realm: realmInfo.realm
      };
    }
  }

  async rawEvaluateJSON(expression: string): Promise<any> {
    const response = await this._session.send('script.evaluate', {
      expression,
      target: this._target,
      serializationOptions: {
        maxObjectDepth: 10,
        maxDomDepth: 10,
      },
      awaitPromise: true,
      userActivation: true,
    });
    if (response.type === 'success')
      return deserializeBidiValue(response.result);
    if (response.type === 'exception')
      throw new js.JavaScriptErrorInEvaluate(response.exceptionDetails.text);
    throw new js.JavaScriptErrorInEvaluate('Unexpected response type: ' + JSON.stringify(response));
  }

  async rawEvaluateHandle(context: js.ExecutionContext, expression: string): Promise<js.JSHandle> {
    const response = await this._session.send('script.evaluate', {
      expression,
      target: this._target,
      resultOwnership: bidi.Script.ResultOwnership.Root, // Necessary for the handle to be returned.
      serializationOptions: { maxObjectDepth: 0, maxDomDepth: 0 },
      awaitPromise: true,
      userActivation: true,
    });
    if (response.type === 'success') {
      if ('handle' in response.result)
        return createHandle(context, response.result);
      throw new js.JavaScriptErrorInEvaluate('Cannot get handle: ' + JSON.stringify(response.result));
    }
    if (response.type === 'exception')
      throw new js.JavaScriptErrorInEvaluate(response.exceptionDetails.text);
    throw new js.JavaScriptErrorInEvaluate('Unexpected response type: ' + JSON.stringify(response));
  }

  async evaluateWithArguments(functionDeclaration: string, returnByValue: boolean, utilityScript: js.JSHandle, values: any[], handles: js.JSHandle[]): Promise<any> {
    const response = await this._session.send('script.callFunction', {
      functionDeclaration,
      target: this._target,
      arguments: [
        { handle: utilityScript._objectId! },
        ...values.map(BidiSerializer.serialize),
        ...handles.map(handle => ({ handle: handle._objectId! })),
      ],
      resultOwnership: returnByValue ? undefined : bidi.Script.ResultOwnership.Root, // Necessary for the handle to be returned.
      serializationOptions: returnByValue ? {} : { maxObjectDepth: 0, maxDomDepth: 0 },
      awaitPromise: true,
      userActivation: true,
    });
    if (response.type === 'exception')
      throw new js.JavaScriptErrorInEvaluate(response.exceptionDetails.text);
    if (response.type === 'success') {
      if (returnByValue)
        return parseEvaluationResultValue(deserializeBidiValue(response.result));
      return createHandle(utilityScript._context, response.result);
    }
    throw new js.JavaScriptErrorInEvaluate('Unexpected response type: ' + JSON.stringify(response));
  }

  async getProperties(handle: js.JSHandle): Promise<Map<string, js.JSHandle>> {
    const names = await handle.evaluate(object => {
      const names = [];
      const descriptors = Object.getOwnPropertyDescriptors(object);
      for (const name in descriptors) {
        if (descriptors[name]?.enumerable)
          names.push(name);
      }
      return names;
    });
    const values = await Promise.all(names.map(async name => {
      const value = await this._rawCallFunction('(object, name) => object[name]', [{ handle: handle._objectId! }, { type: 'string', value: name }], true, false);
      return createHandle(handle._context, value);
    }));
    const map = new Map<string, js.JSHandle>();
    for (let i = 0; i < names.length; i++)
      map.set(names[i], values[i]);
    return map;
  }

  async releaseHandle(handle: js.JSHandle): Promise<void> {
    if (!handle._objectId)
      return;
    await this._session.send('script.disown', {
      target: this._target,
      handles: [handle._objectId],
    });
  }


  async nodeIdForElementHandle(handle: dom.ElementHandle): Promise<bidi.Script.SharedReference> {
    const shared = await this._remoteValueForReference({ handle: handle._objectId });
    // TODO: store sharedId in the handle.
    if (!('sharedId' in shared))
      throw new Error('Element is not a node');
    return {
      sharedId: shared.sharedId!,
    };
  }

  async remoteObjectForNodeId(context: dom.FrameExecutionContext, nodeId: bidi.Script.SharedReference): Promise<dom.ElementHandle> {
    const result = await this._remoteValueForReference(nodeId, true);
    if (!('handle' in result))
      throw new Error('Can\'t get remote object for nodeId');
    return createHandle(context, result) as dom.ElementHandle;
  }

  async contentFrameIdForFrame(handle: dom.ElementHandle) {
    const contentWindow = await this._rawCallFunction('e => e.contentWindow', [{ handle: handle._objectId }]);
    if (contentWindow?.type === 'window')
      return contentWindow.value.context;
    return null;
  }

  async frameIdForWindowHandle(handle: js.JSHandle): Promise<string | null> {
    if (!handle._objectId)
      throw new Error('JSHandle is not a DOM node handle');
    const contentWindow = await this._remoteValueForReference({ handle: handle._objectId });
    if (contentWindow.type === 'window')
      return contentWindow.value.context;
    return null;
  }

  private async _remoteValueForReference(reference: bidi.Script.RemoteReference, createHandle?: boolean) {
    return await this._rawCallFunction('e => e', [reference], createHandle);
  }

  private async _rawCallFunction(functionDeclaration: string, args: bidi.Script.LocalValue[], createHandle?: boolean, awaitPromise = true): Promise<bidi.Script.RemoteValue> {
    const response = await this._session.send('script.callFunction', {
      functionDeclaration,
      target: this._target,
      arguments: args,
      // "Root" is necessary for the handle to be returned.
      resultOwnership: createHandle ? bidi.Script.ResultOwnership.Root : bidi.Script.ResultOwnership.None,
      serializationOptions: { maxObjectDepth: 0, maxDomDepth: 0 },
      awaitPromise,
      userActivation: true,
    });
    if (response.type === 'exception')
      throw new js.JavaScriptErrorInEvaluate(response.exceptionDetails.text);
    if (response.type === 'success')
      return response.result;
    throw new js.JavaScriptErrorInEvaluate('Unexpected response type: ' + JSON.stringify(response));
  }
}

function renderPreview(remoteObject: bidi.Script.RemoteValue, nested = false): string {
  switch (remoteObject.type) {
    case 'undefined':
    case 'null':
      return remoteObject.type;
    case 'number':
    case 'boolean':
    case 'string':
      return String(remoteObject.value);
    case 'bigint':
      return `${remoteObject.value}n`;
    case 'date':
      return String(new Date(remoteObject.value));
    case 'regexp':
      return String(new RegExp(remoteObject.value.pattern, remoteObject.value.flags));
    case 'node':
      return remoteObject.value?.localName || 'Node';
    case 'object':
      if (nested)
        return 'Object';
      const tokens = [];
      for (const [name, value] of remoteObject.value || []) {
        if (typeof name === 'string')
          tokens.push(`${name}: ${renderPreview(value, true)}`);
      }
      return `{${tokens.join(', ')}}`;
    case 'array':
    case 'htmlcollection':
    case 'nodelist':
      if (nested || !remoteObject.value)
        return remoteObject.value ? `Array(${remoteObject.value.length})` : 'Array';
      return `[${remoteObject.value.map(v => renderPreview(v, true)).join(', ')}]`;
    case 'map':
      return remoteObject.value ? `Map(${remoteObject.value.length})` : 'Map';
    case 'set':
      return remoteObject.value ? `Set(${remoteObject.value.length})` : 'Set';
    case 'arraybuffer':
      return 'ArrayBuffer';
    case 'error':
      return 'Error';
    case 'function':
      return 'Function';
    case 'generator':
      return 'Generator';
    case 'promise':
      return 'Promise';
    case 'proxy':
      return 'Proxy';
    case 'symbol':
      return 'Symbol()';
    case 'typedarray':
      return 'TypedArray';
    case 'weakmap':
      return 'WeakMap';
    case 'weakset':
      return 'WeakSet';
    case 'window':
      return 'Window';
  }
}

export function createHandle(context: js.ExecutionContext, remoteObject: bidi.Script.RemoteValue): js.JSHandle {
  if (remoteObject.type === 'node') {
    assert(context instanceof dom.FrameExecutionContext);
    return new dom.ElementHandle(context, remoteObject.handle!);
  }
  const objectId = 'handle' in remoteObject ? remoteObject.handle : undefined;
  const preview = renderPreview(remoteObject);
  const handle = new js.JSHandle(context, remoteObject.type, preview, objectId, deserializeBidiValue(remoteObject));
  handle._setPreview(preview);
  return handle;
}
