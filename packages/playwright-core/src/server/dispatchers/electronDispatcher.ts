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

import type { RootDispatcher } from './dispatcher';
import { Dispatcher } from './dispatcher';
import type { Electron } from '../electron/electron';
import { ElectronApplication } from '../electron/electron';
import type * as channels from '@protocol/channels';
import { BrowserContextDispatcher } from './browserContextDispatcher';
import type { PageDispatcher } from './pageDispatcher';
import type { ConsoleMessage } from '../console';
import { parseArgument, serializeResult } from './jsHandleDispatcher';
import { ElementHandleDispatcher } from './elementHandlerDispatcher';

export class ElectronDispatcher extends Dispatcher<Electron, channels.ElectronChannel, RootDispatcher> implements channels.ElectronChannel {
  _type_Electron = true;

  constructor(scope: RootDispatcher, electron: Electron) {
    super(scope, electron, 'Electron', {});
  }

  async launch(params: channels.ElectronLaunchParams): Promise<channels.ElectronLaunchResult> {
    const electronApplication = await this._object.launch(params);
    return { electronApplication: new ElectronApplicationDispatcher(this, electronApplication) };
  }
}

export class ElectronApplicationDispatcher extends Dispatcher<ElectronApplication, channels.ElectronApplicationChannel, ElectronDispatcher> implements channels.ElectronApplicationChannel {
  _type_EventTarget = true;
  _type_ElectronApplication = true;
  private readonly _subscriptions = new Set<channels.ElectronApplicationUpdateSubscriptionParams['event']>();

  constructor(scope: ElectronDispatcher, electronApplication: ElectronApplication) {
    super(scope, electronApplication, 'ElectronApplication', {
      context: new BrowserContextDispatcher(scope, electronApplication.context())
    });
    this.addObjectListener(ElectronApplication.Events.Close, () => {
      this._dispatchEvent('close');
      this._dispose();
    });
    this.addObjectListener(ElectronApplication.Events.Console, (message: ConsoleMessage) => {
      if (!this._subscriptions.has('console'))
        return;
      this._dispatchEvent('console', {
        type: message.type(),
        text: message.text(),
        args: message.args().map(a => ElementHandleDispatcher.fromJSHandle(this, a)),
        location: message.location()
      });
    });
  }

  async browserWindow(params: channels.ElectronApplicationBrowserWindowParams): Promise<channels.ElectronApplicationBrowserWindowResult> {
    const handle = await this._object.browserWindow((params.page as PageDispatcher).page());
    return { handle: ElementHandleDispatcher.fromJSHandle(this, handle) };
  }

  async evaluateExpression(params: channels.ElectronApplicationEvaluateExpressionParams): Promise<channels.ElectronApplicationEvaluateExpressionResult> {
    const handle = await this._object._nodeElectronHandlePromise;
    return { value: serializeResult(await handle.evaluateExpression(params.expression, { isFunction: params.isFunction }, parseArgument(params.arg))) };
  }

  async evaluateExpressionHandle(params: channels.ElectronApplicationEvaluateExpressionHandleParams): Promise<channels.ElectronApplicationEvaluateExpressionHandleResult> {
    const handle = await this._object._nodeElectronHandlePromise;
    const result = await handle.evaluateExpressionHandle(params.expression, { isFunction: params.isFunction }, parseArgument(params.arg));
    return { handle: ElementHandleDispatcher.fromJSHandle(this, result) };
  }

  async updateSubscription(params: channels.ElectronApplicationUpdateSubscriptionParams): Promise<void> {
    if (params.enabled)
      this._subscriptions.add(params.event);
    else
      this._subscriptions.delete(params.event);
  }

  async close(): Promise<void> {
    await this._object.close();
  }
}
