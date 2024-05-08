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

import type * as js from '../javascript';
import type * as channels from '@protocol/channels';
import { Dispatcher } from './dispatcher';
import { ElementHandleDispatcher } from './elementHandlerDispatcher';
import { parseSerializedValue, serializeValue } from '../../protocol/serializers';
import type { PageDispatcher, WorkerDispatcher } from './pageDispatcher';
import type { ElectronApplicationDispatcher } from './electronDispatcher';
import type { FrameDispatcher } from './frameDispatcher';
import type { CallMetadata } from '../instrumentation';

export type JSHandleDispatcherParentScope = PageDispatcher | FrameDispatcher | WorkerDispatcher | ElectronApplicationDispatcher;

export class JSHandleDispatcher extends Dispatcher<js.JSHandle, channels.JSHandleChannel, JSHandleDispatcherParentScope> implements channels.JSHandleChannel {
  _type_JSHandle = true;

  protected constructor(scope: JSHandleDispatcherParentScope, jsHandle: js.JSHandle) {
    // Do not call this directly, use createHandle() instead.
    super(scope, jsHandle, jsHandle.asElement() ? 'ElementHandle' : 'JSHandle', {
      preview: jsHandle.toString(),
    });
    jsHandle._setPreviewCallback(preview => this._dispatchEvent('previewUpdated', { preview }));
  }

  async evaluateExpression(params: channels.JSHandleEvaluateExpressionParams): Promise<channels.JSHandleEvaluateExpressionResult> {
    return { value: serializeResult(await this._object.evaluateExpression(params.expression, { isFunction: params.isFunction }, parseArgument(params.arg))) };
  }

  async evaluateExpressionHandle(params: channels.JSHandleEvaluateExpressionHandleParams): Promise<channels.JSHandleEvaluateExpressionHandleResult> {
    const jsHandle = await this._object.evaluateExpressionHandle(params.expression, { isFunction: params.isFunction }, parseArgument(params.arg));
    return { handle: ElementHandleDispatcher.fromJSHandle(this.parentScope(), jsHandle) };
  }

  async getProperty(params: channels.JSHandleGetPropertyParams): Promise<channels.JSHandleGetPropertyResult> {
    const jsHandle = await this._object.getProperty(params.name);
    return { handle: ElementHandleDispatcher.fromJSHandle(this.parentScope(), jsHandle) };
  }

  async getPropertyList(): Promise<channels.JSHandleGetPropertyListResult> {
    const map = await this._object.getProperties();
    const properties = [];
    for (const [name, value] of map)
      properties.push({ name, value: ElementHandleDispatcher.fromJSHandle(this.parentScope(), value) });
    return { properties };
  }

  async jsonValue(): Promise<channels.JSHandleJsonValueResult> {
    return { value: serializeResult(await this._object.jsonValue()) };
  }

  async objectCount(params?: channels.JSHandleObjectCountParams | undefined): Promise<channels.JSHandleObjectCountResult> {
    return { count: await this._object.objectCount() };
  }

  async dispose(_: any, metadata: CallMetadata) {
    metadata.potentiallyClosesScope = true;
    this._object.dispose();
    this._dispose();
  }
}

// Generic channel parser converts guids to JSHandleDispatchers,
// and this function takes care of converting them into underlying JSHandles.
export function parseArgument(arg: channels.SerializedArgument): any {
  return parseSerializedValue(arg.value, arg.handles.map(a => (a as JSHandleDispatcher)._object));
}

export function parseValue(v: channels.SerializedValue): any {
  return parseSerializedValue(v, []);
}

export function serializeResult(arg: any): channels.SerializedValue {
  return serializeValue(arg, value => ({ fallThrough: value }));
}
