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

import { CDPSession } from '../chromium/crConnection';
import type * as channels from '@protocol/channels';
import { Dispatcher } from './dispatcher';
import type { BrowserDispatcher } from './browserDispatcher';
import type { BrowserContextDispatcher } from './browserContextDispatcher';
import type { CallMetadata } from '../instrumentation';

export class CDPSessionDispatcher extends Dispatcher<CDPSession, channels.CDPSessionChannel, BrowserDispatcher | BrowserContextDispatcher> implements channels.CDPSessionChannel {
  _type_CDPSession = true;

  constructor(scope: BrowserDispatcher | BrowserContextDispatcher, cdpSession: CDPSession) {
    super(scope, cdpSession, 'CDPSession', {});
    this.addObjectListener(CDPSession.Events.Event, ({ method, params }) => this._dispatchEvent('event', { method, params }));
    this.addObjectListener(CDPSession.Events.Closed, () => this._dispose());
  }

  async send(params: channels.CDPSessionSendParams): Promise<channels.CDPSessionSendResult> {
    return { result: await this._object.send(params.method as any, params.params) };
  }

  async detach(_: any, metadata: CallMetadata): Promise<void> {
    metadata.potentiallyClosesScope = true;
    await this._object.detach();
  }
}
