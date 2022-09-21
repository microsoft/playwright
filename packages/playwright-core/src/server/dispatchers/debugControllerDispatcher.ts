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
import { DebugController } from '../debugController';
import type { DispatcherConnection, RootDispatcher } from './dispatcher';
import { Dispatcher } from './dispatcher';

export class DebugControllerDispatcher extends Dispatcher<DebugController, channels.DebugControllerChannel, RootDispatcher> implements channels.DebugControllerChannel {
  _type_DebugController;

  constructor(connection: DispatcherConnection, debugController: DebugController) {
    super(connection, debugController, 'DebugController', {});
    this._type_DebugController = true;
    this._object.on(DebugController.Events.BrowsersChanged, browsers => {
      this._dispatchEvent('browsersChanged', { browsers });
    });
    this._object.on(DebugController.Events.InspectRequested, selector => {
      this._dispatchEvent('inspectRequested', { selector });
    });
    this._object.on(DebugController.Events.SourcesChanged, sources => {
      this._dispatchEvent('sourcesChanged', { sources });
    });
  }

  async setTrackHierarchy(params: channels.DebugControllerSetTrackHierarchyParams) {
    this._object.setTrackHierarcy(params.enabled);
  }

  async setReuseBrowser(params: channels.DebugControllerSetReuseBrowserParams) {
    this._object.setReuseBrowser(params.enabled);
  }

  async resetForReuse() {
    await this._object.resetForReuse();
  }

  async navigateAll(params: channels.DebugControllerNavigateAllParams) {
    await this._object.navigateAll(params.url);
  }

  async setRecorderMode(params: channels.DebugControllerSetRecorderModeParams) {
    await this._object.setRecorderMode(params);
  }

  async highlightAll(params: channels.DebugControllerHighlightAllParams) {
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
