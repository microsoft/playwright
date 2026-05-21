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

import { BrowserContextDispatcher } from './browserContextDispatcher';
import { Dispatcher } from './dispatcher';
import { JSHandleDispatcher, parseArgument, serializeResult } from './jsHandleDispatcher';
import { ElectronApplication } from '../electron/electron';
import { ElectronDialog, ElectronFileChooser } from '../electron/electronDialogs';

import type { RootDispatcher } from './dispatcher';
import type { PageDispatcher } from './pageDispatcher';
import type { ConsoleMessage } from '../console';
import type { Electron } from '../electron/electron';
import type * as channels from '@protocol/channels';
import type { Progress } from '@protocol/progress';


export class ElectronDispatcher extends Dispatcher<Electron, channels.ElectronChannel, RootDispatcher> implements channels.ElectronChannel {
  _type_Electron = true;
  _denyLaunch: boolean;

  constructor(scope: RootDispatcher, electron: Electron, denyLaunch: boolean) {
    super(scope, electron, 'Electron', {});
    this._denyLaunch = denyLaunch;
  }

  async launch(params: channels.ElectronLaunchParams, progress: Progress): Promise<channels.ElectronLaunchResult> {
    if (this._denyLaunch)
      throw new Error(`Launching more browsers is not allowed.`);
    const electronApplication = await this._object.launch(progress, params);
    return { electronApplication: new ElectronApplicationDispatcher(this, electronApplication) };
  }
}

export class ElectronApplicationDispatcher extends Dispatcher<ElectronApplication, channels.ElectronApplicationChannel, ElectronDispatcher> implements channels.ElectronApplicationChannel {
  _type_EventTarget = true;
  _type_ElectronApplication = true;
  private readonly _subscriptions = new Set<channels.ElectronApplicationUpdateSubscriptionParams['event']>();

  constructor(scope: ElectronDispatcher, electronApplication: ElectronApplication) {
    super(scope, electronApplication, 'ElectronApplication', {
      context: BrowserContextDispatcher.from(scope, electronApplication.context())
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
        args: message.args().map(a => JSHandleDispatcher.fromJSHandle(this, a)),
        location: message.location(),
        timestamp: message.timestamp(),
      });
    });
    this.addObjectListener(ElectronApplication.Events.Dialog, (dialog: ElectronDialog) => {
      if (!this._subscriptions.has('dialog')) {
        dialog.dismiss().catch(() => {});
        return;
      }
      this._dispatchEvent('dialog', { dialog: new ElectronDialogDispatcher(this, dialog) });
    });
    this.addObjectListener(ElectronApplication.Events.FileChooser, (fileChooser: ElectronFileChooser) => {
      if (!this._subscriptions.has('fileChooser')) {
        fileChooser.cancel().catch(() => {});
        return;
      }
      this._dispatchEvent('fileChooser', { fileChooser: new ElectronFileChooserDispatcher(this, fileChooser) });
    });
  }

  async browserWindow(params: channels.ElectronApplicationBrowserWindowParams, progress: Progress): Promise<channels.ElectronApplicationBrowserWindowResult> {
    const handle = await this._object.browserWindow(progress, (params.page as PageDispatcher).page());
    return { handle: JSHandleDispatcher.fromJSHandle(this, handle) };
  }

  async evaluateExpression(params: channels.ElectronApplicationEvaluateExpressionParams, progress: Progress): Promise<channels.ElectronApplicationEvaluateExpressionResult> {
    const handle = await progress.race(this._object._nodeElectronHandlePromise);
    return { value: serializeResult(await handle.evaluateExpression(progress, params.expression, { isFunction: params.isFunction }, parseArgument(params.arg))) };
  }

  async evaluateExpressionHandle(params: channels.ElectronApplicationEvaluateExpressionHandleParams, progress: Progress): Promise<channels.ElectronApplicationEvaluateExpressionHandleResult> {
    const handle = await progress.race(this._object._nodeElectronHandlePromise);
    const result = await handle.evaluateExpressionHandle(progress, params.expression, { isFunction: params.isFunction }, parseArgument(params.arg));
    return { handle: JSHandleDispatcher.fromJSHandle(this, result) };
  }

  async updateSubscription(params: channels.ElectronApplicationUpdateSubscriptionParams, progress: Progress): Promise<void> {
    if (params.enabled)
      this._subscriptions.add(params.event);
    else
      this._subscriptions.delete(params.event);
    if (params.event === 'dialog' || params.event === 'fileChooser')
      await progress.race(this._object.setDialogInterception(params.event, params.enabled));
  }
}

class ElectronDialogDispatcher extends Dispatcher<ElectronDialog, channels.ElectronDialogChannel, ElectronApplicationDispatcher> implements channels.ElectronDialogChannel {
  _type_ElectronDialog = true;

  constructor(scope: ElectronApplicationDispatcher, dialog: ElectronDialog) {
    super(scope, dialog, 'ElectronDialog', {
      method: dialog.method(),
      options: dialog.options(),
    });
  }

  async accept(params: channels.ElectronDialogAcceptParams, progress: Progress): Promise<void> {
    await progress.race(this._object.accept(params.result));
  }

  async dismiss(_: channels.ElectronDialogDismissParams, progress: Progress): Promise<void> {
    await progress.race(this._object.dismiss());
  }
}

class ElectronFileChooserDispatcher extends Dispatcher<ElectronFileChooser, channels.ElectronFileChooserChannel, ElectronApplicationDispatcher> implements channels.ElectronFileChooserChannel {
  _type_ElectronFileChooser = true;

  constructor(scope: ElectronApplicationDispatcher, fileChooser: ElectronFileChooser) {
    super(scope, fileChooser, 'ElectronFileChooser', {
      method: fileChooser.method(),
      options: fileChooser.options(),
    });
  }

  async setFiles(params: channels.ElectronFileChooserSetFilesParams, progress: Progress): Promise<void> {
    await progress.race(this._object.setFiles(params.filePaths));
  }

  async cancel(_: channels.ElectronFileChooserCancelParams, progress: Progress): Promise<void> {
    await progress.race(this._object.cancel());
  }
}
