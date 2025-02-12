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

import { Dispatcher } from './dispatcher';
import { createGuid } from '../utils/crypto';

import type { LocalUtilsDispatcher } from './localUtilsDispatcher';
import type * as channels from '@protocol/channels';

export class JsonPipeDispatcher extends Dispatcher<{ guid: string }, channels.JsonPipeChannel, LocalUtilsDispatcher> implements channels.JsonPipeChannel {
  _type_JsonPipe = true;
  constructor(scope: LocalUtilsDispatcher) {
    super(scope, { guid: 'jsonPipe@' + createGuid() }, 'JsonPipe', {});
  }

  async send(params: channels.JsonPipeSendParams): Promise<channels.JsonPipeSendResult> {
    this.emit('message', params.message);
  }

  async close(): Promise<void> {
    this.emit('close');
    if (!this._disposed) {
      this._dispatchEvent('closed', {});
      this._dispose();
    }
  }

  dispatch(message: Object) {
    if (!this._disposed)
      this._dispatchEvent('message', { message });
  }

  wasClosed(reason?: string): void {
    if (!this._disposed) {
      this._dispatchEvent('closed', { reason });
      this._dispose();
    }
  }

  dispose() {
    this._dispose();
  }
}
