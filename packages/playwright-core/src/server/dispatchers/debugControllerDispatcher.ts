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

import { eventsHelper } from '../../utils';
import { DebugController } from '../debugController';
import { Dispatcher } from './dispatcher';

import type { DispatcherConnection, RootDispatcher } from './dispatcher';
import type { RegisteredListener } from '../utils/eventsHelper';
import type * as channels from '@protocol/channels';
import type { Progress } from '@protocol/progress';


export class DebugControllerDispatcher extends Dispatcher<DebugController, channels.DebugControllerChannel, RootDispatcher> implements channels.DebugControllerChannel {
  _type_DebugController;
  private _listeners: RegisteredListener[];

  constructor(connection: DispatcherConnection, debugController: DebugController) {
    super(connection, debugController, 'DebugController', {});
    this._type_DebugController = true;
    this._listeners = [
      eventsHelper.addEventListener(this._object, DebugController.Events.StateChanged, params => {
        this._dispatchEvent('stateChanged', params);
      }),
      eventsHelper.addEventListener(this._object, DebugController.Events.InspectRequested, ({ selector, locator, ariaSnapshot }) => {
        this._dispatchEvent('inspectRequested', { selector, locator, ariaSnapshot });
      }),
      eventsHelper.addEventListener(this._object, DebugController.Events.SourceChanged, ({ text, header, footer, actions }) => {
        this._dispatchEvent('sourceChanged', ({ text, header, footer, actions }));
      }),
      eventsHelper.addEventListener(this._object, DebugController.Events.Paused, ({ paused }) => {
        this._dispatchEvent('paused', ({ paused }));
      }),
      eventsHelper.addEventListener(this._object, DebugController.Events.SetModeRequested, ({ mode }) => {
        this._dispatchEvent('setModeRequested', ({ mode }));
      }),
    ];
  }

  async initialize(params: channels.DebugControllerInitializeParams, progress: Progress) {
    this._object.initialize(params.codegenId, params.sdkLanguage);
  }

  async setReportStateChanged(params: channels.DebugControllerSetReportStateChangedParams, progress: Progress) {
    this._object.setReportStateChanged(params.enabled);
  }

  async resetForReuse(params: channels.DebugControllerResetForReuseParams, progress: Progress) {
    await this._object.resetForReuse(progress);
  }

  async navigate(params: channels.DebugControllerNavigateParams, progress: Progress) {
    await this._object.navigate(progress, params.url);
  }

  async setRecorderMode(params: channels.DebugControllerSetRecorderModeParams, progress: Progress) {
    await this._object.setRecorderMode(progress, params);
  }

  async highlight(params: channels.DebugControllerHighlightParams, progress: Progress) {
    await this._object.highlight(progress, params);
  }

  async hideHighlight(params: channels.DebugControllerHideHighlightParams, progress: Progress) {
    await this._object.hideHighlight(progress);
  }

  async resume(params: channels.DebugControllerResumeParams, progress: Progress) {
    await this._object.resume(progress);
  }

  async kill(params: channels.DebugControllerKillParams, progress: Progress) {
    this._object.kill();
  }

  async closeAllBrowsers(params: channels.DebugControllerCloseAllBrowsersParams, progress: Progress) {
    await this._object.closeAllBrowsers();
  }

  override _onDispose() {
    eventsHelper.removeEventListeners(this._listeners);
    this._object.dispose();
  }
}
