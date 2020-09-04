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

import * as channels from '../protocol/channels';
import { Dispatcher, DispatcherScope, lookupDispatcher } from './dispatcher';
import { Screencast } from '../server/browserContext';
import { PageDispatcher } from './pageDispatcher';

export class VideoDispatcher extends Dispatcher<Screencast, channels.VideoInitializer> implements channels.VideoChannel {
  constructor(scope: DispatcherScope, screencast: Screencast) {
    super(scope, screencast, 'Video', {
      page: lookupDispatcher<PageDispatcher>(screencast.page),
    });
  }

  async path(): Promise<channels.VideoPathResult> {
    return { value: await this._object.path() };
  }
}
