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

import type * as channels from '@protocol/channels';
import { eventsHelper } from '../../utils';
import type { RegisteredListener } from '../../utils/eventsHelper';
import type { DebugController } from '../debugController';
import type { DispatcherConnection, RootDispatcher } from './dispatcher';
import { Dispatcher } from './dispatcher';

export class DebugControllerDispatcher extends Dispatcher<DebugController, channels.DebugControllerChannel, RootDispatcher> implements channels.DebugControllerChannel {
  _type_DebugController;
  private _listeners: RegisteredListener[];

  constructor(connection: DispatcherConnection, debugController: DebugController) {
    super(connection, debugController, 'DebugController', {});
    this._type_DebugController = true;
    this._listeners = [
      this._object.addManagedListener('stateChanged', params => {
        this._dispatchEvent('stateChanged', params);
      }),
      this._object.addManagedListener('inspectRequested', ({ selector, locator }) => {
        this._dispatchEvent('inspectRequested', { selector, locator });
      }),
      this._object.addManagedListener('sourceChanged', ({ text, header, footer, actions }) => {
        this._dispatchEvent('sourceChanged', ({ text, header, footer, actions }));
      }),
      this._object.addManagedListener('paused', ({ paused }) => {
        this._dispatchEvent('paused', ({ paused }));
      }),
      this._object.addManagedListener('setModeRequested', ({ mode }) => {
        this._dispatchEvent('setModeRequested', ({ mode }));
      }),
    ];
  }

  async initialize(params: channels.DebugControllerInitializeParams) {
    this._object.initialize(params.codegenId, params.sdkLanguage);
  }

  async setReportStateChanged(params: channels.DebugControllerSetReportStateChangedParams) {
    this._object.setReportStateChanged(params.enabled);
  }

  async resetForReuse() {
    await this._object.resetForReuse();
  }

  async navigate(params: channels.DebugControllerNavigateParams) {
    await this._object.navigate(params.url);
  }

  async setRecorderMode(params: channels.DebugControllerSetRecorderModeParams) {
    await this._object.setRecorderMode(params);
  }

  async highlight(params: channels.DebugControllerHighlightParams) {
    await this._object.highlight(params.selector);
  }

  async hideHighlight() {
    await this._object.hideHighlight();
  }

  async resume() {
    await this._object.resume();
  }

  async kill() {
    await this._object.kill();
  }

  async closeAllBrowsers() {
    await this._object.closeAllBrowsers();
  }

  override _onDispose() {
    eventsHelper.removeEventListeners(this._listeners);
    this._object.dispose();
  }
}
