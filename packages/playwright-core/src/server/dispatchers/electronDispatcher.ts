/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License");
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

import type { DispatcherScope } from './dispatcher';
import { Dispatcher } from './dispatcher';
import type { Electron } from '../electron/electron';
import { ElectronApplication } from '../electron/electron';
import type * as channels from '../../protocol/channels';
import { BrowserContextDispatcher } from './browserContextDispatcher';
import type { PageDispatcher } from './pageDispatcher';
import { parseArgument, serializeResult } from './jsHandleDispatcher';
import { ElementHandleDispatcher } from './elementHandlerDispatcher';

export class ElectronDispatcher extends Dispatcher<Electron, channels.ElectronChannel> implements channels.ElectronChannel {
  _type_Electron = true;
  constructor(scope: DispatcherScope, electron: Electron) {
    super(scope, electron, 'Electron', {}, true);
  }

  async launch(params: channels.ElectronLaunchParams): Promise<channels.ElectronLaunchResult> {
    const electronApplication = await this._object.launch(params);
    return { electronApplication: new ElectronApplicationDispatcher(this._scope, electronApplication) };
  }
}

export class ElectronApplicationDispatcher extends Dispatcher<ElectronApplication, channels.ElectronApplicationChannel> implements channels.ElectronApplicationChannel {
  _type_EventTarget = true;
  _type_ElectronApplication = true;

  constructor(scope: DispatcherScope, electronApplication: ElectronApplication) {
    super(scope, electronApplication, 'ElectronApplication', {
      context: new BrowserContextDispatcher(scope, electronApplication.context())
    }, true);
    electronApplication.on(ElectronApplication.Events.Close, () => {
      this._dispatchEvent('close');
      this._dispose();
    });
  }

  async browserWindow(params: channels.ElectronApplicationBrowserWindowParams): Promise<channels.ElectronApplicationBrowserWindowResult> {
    const handle = await this._object.browserWindow((params.page as PageDispatcher).page());
    return { handle: ElementHandleDispatcher.fromJSHandle(this._scope, handle) };
  }

  async evaluateExpression(params: channels.ElectronApplicationEvaluateExpressionParams): Promise<channels.ElectronApplicationEvaluateExpressionResult> {
    const handle = await this._object._nodeElectronHandlePromise;
    return { value: serializeResult(await handle.evaluateExpressionAndWaitForSignals(params.expression, params.isFunction, true /* returnByValue */, parseArgument(params.arg))) };
  }

  async evaluateExpressionHandle(params: channels.ElectronApplicationEvaluateExpressionHandleParams): Promise<channels.ElectronApplicationEvaluateExpressionHandleResult> {
    const handle = await this._object._nodeElectronHandlePromise;
    const result = await handle.evaluateExpressionAndWaitForSignals(params.expression, params.isFunction, false /* returnByValue */, parseArgument(params.arg));
    return { handle: ElementHandleDispatcher.fromJSHandle(this._scope, result) };
  }

  async close(): Promise<void> {
    await this._object.close();
  }
}
