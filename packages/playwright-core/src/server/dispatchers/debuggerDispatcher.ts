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

import { renderTitleForCall } from '@isomorphic/protocolFormatter';
import { Dispatcher } from './dispatcher';
import { Debugger } from '../debugger';

import type { BrowserContextDispatcher } from './browserContextDispatcher';
import type * as channels from '@protocol/channels';
import type { Progress } from '@protocol/progress';

export class DebuggerDispatcher extends Dispatcher<Debugger, channels.DebuggerChannel, BrowserContextDispatcher> implements channels.DebuggerChannel {
  _type_EventTarget = true;
  _type_Debugger = true;

  static from(scope: BrowserContextDispatcher, debugger_: Debugger): DebuggerDispatcher {
    const result = scope.connection.existingDispatcher<DebuggerDispatcher>(debugger_);
    return result || new DebuggerDispatcher(scope, debugger_);
  }

  constructor(scope: BrowserContextDispatcher, debugger_: Debugger) {
    super(scope, debugger_, 'Debugger', {});
    this.addObjectListener(Debugger.Events.PausedStateChanged, () => {
      this._dispatchEvent('pausedStateChanged', { pausedDetails: this._serializePausedDetails() });
    });
    this._dispatchEvent('pausedStateChanged', { pausedDetails: this._serializePausedDetails() });
  }

  private _serializePausedDetails(): channels.DebuggerPausedStateChangedEvent['pausedDetails'] {
    const details = this._object.pausedDetails();
    if (!details)
      return undefined;
    const { metadata } = details;
    return {
      location: {
        file: metadata.location?.file ?? '<unknown>',
        line: metadata.location?.line,
        column: metadata.location?.column,
      },
      title: renderTitleForCall(metadata),
    };
  }

  async requestPause(params: channels.DebuggerRequestPauseParams, progress: Progress): Promise<void> {
    this._object.requestPause(progress);
  }

  async resume(params: channels.DebuggerResumeParams, progress: Progress): Promise<void> {
    this._object.doResume(progress);
  }

  async next(params: channels.DebuggerNextParams, progress: Progress): Promise<void> {
    this._object.next(progress);
  }

  async runTo(params: channels.DebuggerRunToParams, progress: Progress): Promise<void> {
    this._object.runTo(progress, params.location);
  }
}
