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

import type * as channels from '../../protocol/channels';
import { ReuseController } from '../reuseController';
import type { DispatcherConnection, RootDispatcher } from './dispatcher';
import { Dispatcher } from './dispatcher';

export class ReuseControllerDispatcher extends Dispatcher<ReuseController, channels.ReuseControllerChannel, RootDispatcher> implements channels.ReuseControllerChannel {
  _type_ReuseController;

  constructor(connection: DispatcherConnection, reuseController: ReuseController) {
    super(connection, reuseController, 'ReuseController', {});
    this._type_ReuseController = true;
    this._object.on(ReuseController.Events.BrowsersChanged, browsers => {
      this._dispatchEvent('browsersChanged', { browsers });
    });
    this._object.on(ReuseController.Events.InspectRequested, selector => {
      this._dispatchEvent('inspectRequested', { selector });
    });
  }

  async setTrackHierarchy(params: channels.ReuseControllerSetTrackHierarchyParams) {
    this._object.setTrackHierarcy(params.enabled);
  }

  async setReuseBrowser(params: channels.ReuseControllerSetReuseBrowserParams) {
    this._object.setReuseBrowser(params.enabled);
  }

  async resetForReuse() {
    await this._object.resetForReuse();
  }

  async navigateAll(params: channels.ReuseControllerNavigateAllParams) {
    await this._object.navigateAll(params.url);
  }

  async setRecorderMode(params: channels.ReuseControllerSetRecorderModeParams) {
    await this._object.setRecorderMode(params);
  }

  async setAutoClose(params: channels.ReuseControllerSetAutoCloseParams) {
    await this._object.setAutoCloseEnabled(params.enabled);
  }

  async highlightAll(params: channels.ReuseControllerHighlightAllParams) {
    await this._object.highlightAll(params.selector);
  }

  async hideHighlightAll() {
    await this._object.hideHighlightAll();
  }

  async kill() {
    await this._object.kill();
  }

  async closeAllBrowsers() {
    await this._object.closeAllBrowsers();
  }

  override _dispose() {
    super._dispose();
    this._object.dispose();
  }
}
