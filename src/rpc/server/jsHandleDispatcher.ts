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

import * as js from '../../javascript';
import { JSHandleChannel, JSHandleInitializer } from '../channels';
import { Dispatcher, DispatcherScope } from '../dispatcher';
import { convertArg } from './frameDispatcher';
import { ElementHandleDispatcher } from './elementHandlerDispatcher';

export class JSHandleDispatcher extends Dispatcher<js.JSHandle, JSHandleInitializer> implements JSHandleChannel {

  constructor(scope: DispatcherScope, jsHandle: js.JSHandle) {
    super(scope, jsHandle, jsHandle.asElement() ? 'elementHandle' : 'jsHandle', {
      preview: jsHandle.toString(),
    });
  }

  async evaluateExpression(params: { expression: string, isFunction: boolean, arg: any }): Promise<any> {
    return this._object._evaluateExpression(params.expression, params.isFunction, true /* returnByValue */, convertArg(this._scope, params.arg));
  }

  async evaluateExpressionHandle(params: { expression: string, isFunction: boolean, arg: any}): Promise<JSHandleChannel> {
    const jsHandle = await this._object._evaluateExpression(params.expression, params.isFunction, false /* returnByValue */, convertArg(this._scope, params.arg));
    return ElementHandleDispatcher.from(this._scope, jsHandle);
  }

  async getPropertyList(): Promise<{ name: string, value: JSHandleChannel }[]> {
    const map = await this._object.getProperties();
    const result = [];
    for (const [name, value] of map)
      result.push({ name, value: new JSHandleDispatcher(this._scope, value) });
    return result;
  }

  async jsonValue(): Promise<any> {
    return this._object.jsonValue();
  }

  async dispose() {
    await this._object.dispose();
  }
}
