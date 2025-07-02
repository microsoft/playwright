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

import { Dispatcher } from './dispatcher';
import { ElementHandleDispatcher } from './elementHandlerDispatcher';
import { parseSerializedValue, serializeValue } from '../../protocol/serializers';

import type * as js from '../javascript';
import type { ElectronApplicationDispatcher } from './electronDispatcher';
import type { FrameDispatcher } from './frameDispatcher';
import type { PageDispatcher, WorkerDispatcher } from './pageDispatcher';
import type * as channels from '@protocol/channels';
import type { Progress } from '@protocol/progress';

export type JSHandleDispatcherParentScope = PageDispatcher | FrameDispatcher | WorkerDispatcher | ElectronApplicationDispatcher;

export class JSHandleDispatcher<ParentScope extends JSHandleDispatcherParentScope = JSHandleDispatcherParentScope> extends Dispatcher<js.JSHandle, channels.JSHandleChannel, ParentScope> implements channels.JSHandleChannel {
  _type_JSHandle = true;

  static fromJSHandle(scope: JSHandleDispatcherParentScope, handle: js.JSHandle): JSHandleDispatcher {
    return scope.connection.existingDispatcher<JSHandleDispatcher>(handle) || new JSHandleDispatcher(scope, handle);
  }

  protected constructor(scope: ParentScope, jsHandle: js.JSHandle) {
    // Do not call this directly, use createHandle() instead.
    super(scope, jsHandle, jsHandle.asElement() ? 'ElementHandle' : 'JSHandle', {
      preview: jsHandle.toString(),
    });
    jsHandle._setPreviewCallback(preview => this._dispatchEvent('previewUpdated', { preview }));
  }

  async evaluateExpression(params: channels.JSHandleEvaluateExpressionParams, progress: Progress): Promise<channels.JSHandleEvaluateExpressionResult> {
    const jsHandle = await progress.race(this._object.evaluateExpression(params.expression, { isFunction: params.isFunction }, parseArgument(params.arg)));
    return { value: serializeResult(jsHandle) };
  }

  async evaluateExpressionHandle(params: channels.JSHandleEvaluateExpressionHandleParams, progress: Progress): Promise<channels.JSHandleEvaluateExpressionHandleResult> {
    const jsHandle = await progress.race(this._object.evaluateExpressionHandle(params.expression, { isFunction: params.isFunction }, parseArgument(params.arg)));
    // If "jsHandle" is an ElementHandle, it belongs to the same frame as "this".
    return { handle: ElementHandleDispatcher.fromJSOrElementHandle(this.parentScope() as FrameDispatcher, jsHandle) };
  }

  async getProperty(params: channels.JSHandleGetPropertyParams, progress: Progress): Promise<channels.JSHandleGetPropertyResult> {
    const jsHandle = await progress.race(this._object.getProperty(params.name));
    // If "jsHandle" is an ElementHandle, it belongs to the same frame as "this".
    return { handle: ElementHandleDispatcher.fromJSOrElementHandle(this.parentScope() as FrameDispatcher, jsHandle) };
  }

  async getPropertyList(params: channels.JSHandleGetPropertyListParams, progress: Progress): Promise<channels.JSHandleGetPropertyListResult> {
    const map = await progress.race(this._object.getProperties());
    const properties = [];
    for (const [name, value] of map) {
      // If "jsHandle" is an ElementHandle, it belongs to the same frame as "this".
      properties.push({ name, value: ElementHandleDispatcher.fromJSOrElementHandle(this.parentScope() as FrameDispatcher, value) });
    }
    return { properties };
  }

  async jsonValue(params: channels.JSHandleJsonValueParams, progress: Progress): Promise<channels.JSHandleJsonValueResult> {
    return { value: serializeResult(await progress.race(this._object.jsonValue())) };
  }

  async dispose(_: any, progress: Progress) {
    progress.metadata.potentiallyClosesScope = true;
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
