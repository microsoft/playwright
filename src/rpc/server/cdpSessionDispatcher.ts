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

import { CRSession, CRSessionEvents } from '../../chromium/crConnection';
import { CDPSessionChannel, CDPSessionInitializer, SerializedValue } from '../channels';
import { Dispatcher, DispatcherScope } from './dispatcher';
import { serializeResult, parseValue } from './jsHandleDispatcher';

export class CDPSessionDispatcher extends Dispatcher<CRSession, CDPSessionInitializer> implements CDPSessionChannel {
  constructor(scope: DispatcherScope, crSession: CRSession) {
    super(scope, crSession, 'CDPSession', {}, true);
    crSession._eventListener = (method, cdpParams) => {
      const params = cdpParams ? serializeResult(cdpParams) : undefined;
      this._dispatchEvent('event', { method, params });
    };
    crSession.on(CRSessionEvents.Disconnected, () => {
      this._dispatchEvent('disconnected');
      this._dispose();
    });
  }

  async send(params: { method: string, params?: SerializedValue }): Promise<{ result: SerializedValue }> {
    const cdpParams = params.params ? parseValue(params.params) : undefined;
    return { result: serializeResult(await this._object.send(params.method as any, cdpParams)) };
  }

  async detach(): Promise<void> {
    return this._object.detach();
  }
}
