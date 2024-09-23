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

import { parseEvaluationResultValue } from '../isomorphic/utilityScriptSerializers';
import * as js from '../javascript';
import type { BidiSession } from './bidiConnection';
import { BidiDeserializer } from './third_party/bidiDeserializer';
import * as bidi from './third_party/bidiProtocol';
import { BidiSerializer } from './third_party/bidiSerializer';

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
      return BidiDeserializer.deserialize(response.result);
    if (response.type === 'exception')
      throw new js.JavaScriptErrorInEvaluate(response.exceptionDetails.text + '\nFull val: ' + JSON.stringify(response.exceptionDetails));
    throw new js.JavaScriptErrorInEvaluate('Unexpected response type: ' + JSON.stringify(response));
  }

  async rawEvaluateHandle(expression: string): Promise<js.ObjectId> {
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
        return response.result.handle!;
      throw new js.JavaScriptErrorInEvaluate('Cannot get handle: ' + JSON.stringify(response.result));
    }
    if (response.type === 'exception')
      throw new js.JavaScriptErrorInEvaluate(response.exceptionDetails.text + '\nFull val: ' + JSON.stringify(response.exceptionDetails));
    throw new js.JavaScriptErrorInEvaluate('Unexpected response type: ' + JSON.stringify(response));
  }

  rawCallFunctionNoReply(func: Function, ...args: any[]) {
    throw new Error('Method not implemented.');
  }

  async evaluateWithArguments(functionDeclaration: string, returnByValue: boolean, utilityScript: js.JSHandle<any>, values: any[], objectIds: string[]): Promise<any> {
    const response = await this._session.send('script.callFunction', {
      functionDeclaration,
      target: this._target,
      arguments: [
        { handle: utilityScript._objectId! },
        ...values.map(BidiSerializer.serialize),
        ...objectIds.map(handle => ({ handle })),
      ],
      resultOwnership: returnByValue ? undefined : bidi.Script.ResultOwnership.Root, // Necessary for the handle to be returned.
      serializationOptions: returnByValue ? {} : { maxObjectDepth: 0, maxDomDepth: 0 },
      awaitPromise: true,
      userActivation: true,
    });
    if (response.type === 'exception')
      throw new js.JavaScriptErrorInEvaluate(response.exceptionDetails.text + '\nFull val: ' + JSON.stringify(response.exceptionDetails));
    if (response.type === 'success') {
      if (returnByValue)
        return parseEvaluationResultValue(BidiDeserializer.deserialize(response.result));
      const objectId = 'handle' in response.result ? response.result.handle : undefined ;
      return utilityScript._context.createHandle({ objectId, ...response.result });
    }
    throw new js.JavaScriptErrorInEvaluate('Unexpected response type: ' + JSON.stringify(response));
  }

  async getProperties(context: js.ExecutionContext, objectId: js.ObjectId): Promise<Map<string, js.JSHandle>> {
    throw new Error('Method not implemented.');
  }

  createHandle(context: js.ExecutionContext, jsRemoteObject: js.RemoteObject): js.JSHandle {
    const remoteObject: bidi.Script.RemoteValue = jsRemoteObject as bidi.Script.RemoteValue;
    return new js.JSHandle(context, remoteObject.type, renderPreview(remoteObject), jsRemoteObject.objectId, remoteObjectValue(remoteObject));
  }

  async releaseHandle(objectId: js.ObjectId): Promise<void> {
    await this._session.send('script.disown', {
      target: this._target,
      handles: [objectId],
    });
  }

  objectCount(objectId: js.ObjectId): Promise<number> {
    throw new Error('Method not implemented.');
  }

  async rawCallFunction(functionDeclaration: string, arg: bidi.Script.LocalValue): Promise<bidi.Script.RemoteValue> {
    const response = await this._session.send('script.callFunction', {
      functionDeclaration,
      target: this._target,
      arguments: [arg],
      resultOwnership: bidi.Script.ResultOwnership.Root, // Necessary for the handle to be returned.
      serializationOptions: { maxObjectDepth: 0, maxDomDepth: 0 },
      awaitPromise: true,
      userActivation: true,
    });
    if (response.type === 'exception')
      throw new js.JavaScriptErrorInEvaluate(response.exceptionDetails.text + '\nFull val: ' + JSON.stringify(response.exceptionDetails));
    if (response.type === 'success')
      return response.result;
    throw new js.JavaScriptErrorInEvaluate('Unexpected response type: ' + JSON.stringify(response));
  }
}

function renderPreview(remoteObject: bidi.Script.RemoteValue): string | undefined {
  if (remoteObject.type === 'undefined')
    return 'undefined';
  if (remoteObject.type === 'null')
    return 'null';
  if ('value' in remoteObject)
    return String(remoteObject.value);
  return `<${remoteObject.type}>`;
}

function remoteObjectValue(remoteObject: bidi.Script.RemoteValue): any {
  if (remoteObject.type === 'undefined')
    return undefined;
  if (remoteObject.type === 'null')
    return null;
  if (remoteObject.type === 'number' && typeof remoteObject.value === 'string')
    return js.parseUnserializableValue(remoteObject.value);
  if ('value' in remoteObject)
    return remoteObject.value;
  return undefined;
}
