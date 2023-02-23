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
import type * as channels from '@protocol/channels';
import type { Selectors } from '../selectors';

export class SelectorsDispatcher extends Dispatcher<Selectors, channels.SelectorsChannel, RootDispatcher> implements channels.SelectorsChannel {
  _type_Selectors = true;

  constructor(scope: RootDispatcher, selectors: Selectors) {
    super(scope, selectors, 'Selectors', {});
  }

  async register(params: channels.SelectorsRegisterParams): Promise<void> {
    await this._object.register(params.name, params.source, params.contentScript);
  }

  async setTestIdAttributeName(params: channels.SelectorsSetTestIdAttributeNameParams): Promise<void> {
    this._object.setTestIdAttributeName(params.testIdAttributeName);
  }
}
