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

import * as js from '../server/javascript';
import * as channels from '../protocol/channels';
import { Dispatcher, DispatcherScope } from './dispatcher';
import { createHandle } from './elementHandlerDispatcher';
import { parseSerializedValue, serializeValue } from '../protocol/serializers';

export class JSHandleDispatcher extends Dispatcher<js.JSHandle, channels.JSHandleInitializer> implements channels.JSHandleChannel {

  constructor(scope: DispatcherScope, jsHandle: js.JSHandle) {
    super(scope, jsHandle, jsHandle.asElement() ? 'ElementHandle' : 'JSHandle', {
      preview: jsHandle.toString(),
    });
    jsHandle._setPreviewCallback(preview => this._dispatchEvent('previewUpdated', { preview }));
  }

  async evaluateExpression(params: channels.JSHandleEvaluateExpressionParams): Promise<channels.JSHandleEvaluateExpressionResult> {
    return { value: serializeResult(await this._object._evaluateExpression(params.expression, params.isFunction, true /* returnByValue */, parseArgument(params.arg))) };
  }

  async evaluateExpressionHandle(params: channels.JSHandleEvaluateExpressionHandleParams): Promise<channels.JSHandleEvaluateExpressionHandleResult> {
    const jsHandle = await this._object._evaluateExpression(params.expression, params.isFunction, false /* returnByValue */, parseArgument(params.arg));
    return { handle: createHandle(this._scope, jsHandle) };
  }

  async getProperty(params: channels.JSHandleGetPropertyParams): Promise<channels.JSHandleGetPropertyResult> {
    const jsHandle = await this._object.getProperty(params.name);
    return { handle: createHandle(this._scope, jsHandle) };
  }

  async getPropertyList(): Promise<channels.JSHandleGetPropertyListResult> {
    const map = await this._object.getProperties();
    const properties = [];
    for (const [name, value] of map)
      properties.push({ name, value: new JSHandleDispatcher(this._scope, value) });
    return { properties };
  }

  async jsonValue(): Promise<channels.JSHandleJsonValueResult> {
    return { value: serializeResult(await this._object.jsonValue()) };
  }

  async dispose() {
    await this._object.dispose();
  }
}

// Generic channel parser converts guids to JSHandleDispatchers,
// and this function takes care of coverting them into underlying JSHandles.
export function parseArgument(arg: channels.SerializedArgument): any {
  return parseSerializedValue(arg.value, arg.handles.map(a => (a as JSHandleDispatcher)._object));
}

export function parseValue(v: channels.SerializedValue): any {
  return parseSerializedValue(v, []);
}

export function serializeResult(arg: any): channels.SerializedValue {
  return serializeValue(arg, value => ({ fallThrough: value }), new Set());
}
