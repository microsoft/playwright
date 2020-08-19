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

import { Dispatcher, DispatcherScope, lookupDispatcher } from './dispatcher';
import { Electron, ElectronApplication, ElectronEvents, ElectronPage } from '../../server/electron';
import { ElectronApplicationChannel, ElectronApplicationInitializer, PageChannel, JSHandleChannel, ElectronInitializer, ElectronChannel, SerializedArgument, ElectronLaunchParams, SerializedValue } from '../channels';
import { BrowserContextDispatcher } from './browserContextDispatcher';
import { PageDispatcher } from './pageDispatcher';
import { parseArgument, serializeResult } from './jsHandleDispatcher';
import { createHandle } from './elementHandlerDispatcher';

export class ElectronDispatcher extends Dispatcher<Electron, ElectronInitializer> implements ElectronChannel {
  constructor(scope: DispatcherScope, electron: Electron) {
    super(scope, electron, 'Electron', {}, true);
  }

  async launch(params: ElectronLaunchParams): Promise<{ electronApplication: ElectronApplicationChannel }> {
    const electronApplication = await this._object.launch(params.executablePath, params);
    return { electronApplication: new ElectronApplicationDispatcher(this._scope, electronApplication) };
  }
}

export class ElectronApplicationDispatcher extends Dispatcher<ElectronApplication, ElectronApplicationInitializer> implements ElectronApplicationChannel {
  constructor(scope: DispatcherScope, electronApplication: ElectronApplication) {
    super(scope, electronApplication, 'ElectronApplication', {}, true);
    this._dispatchEvent('context', { context: new BrowserContextDispatcher(this._scope, electronApplication.context()) });
    electronApplication.on(ElectronEvents.ElectronApplication.Close, () => {
      this._dispatchEvent('close');
      this._dispose();
    });
    electronApplication.on(ElectronEvents.ElectronApplication.Window, (page: ElectronPage) => {
      this._dispatchEvent('window', {
        page: lookupDispatcher<PageDispatcher>(page),
        browserWindow: createHandle(this._scope, page.browserWindow),
      });
    });
  }

  async newBrowserWindow(params: { arg: SerializedArgument }): Promise<{ page: PageChannel }> {
    const page = await this._object.newBrowserWindow(parseArgument(params.arg));
    return { page: lookupDispatcher<PageChannel>(page) };
  }

  async evaluateExpression(params: { expression: string, isFunction: boolean, arg: SerializedArgument }): Promise<{ value: SerializedValue }> {
    const handle = this._object._nodeElectronHandle!;
    return { value: serializeResult(await handle._evaluateExpression(params.expression, params.isFunction, true /* returnByValue */, parseArgument(params.arg))) };
  }

  async evaluateExpressionHandle(params: { expression: string, isFunction: boolean, arg: SerializedArgument }): Promise<{ handle: JSHandleChannel }> {
    const handle = this._object._nodeElectronHandle!;
    const result = await handle._evaluateExpression(params.expression, params.isFunction, false /* returnByValue */, parseArgument(params.arg));
    return { handle: createHandle(this._scope, result) };
  }

  async close(): Promise<void> {
    await this._object.close();
  }
}
