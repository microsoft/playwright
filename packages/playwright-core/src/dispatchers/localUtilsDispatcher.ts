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
import { LocalUtils } from '../server/localUtils';
import { Dispatcher, DispatcherScope } from './dispatcher';

export class LocalUtilsDispatcher extends Dispatcher<LocalUtils, channels.LocalUtilsChannel> implements channels.LocalUtilsChannel {
  _type_LocalUtils: boolean;
  constructor(scope: DispatcherScope, utils: LocalUtils) {
    super(scope, utils, 'LocalUtils', {});
    this._type_LocalUtils = true;
  }
  async zipTrace(params: channels.LocalUtilsZipTraceParams, metadata?: channels.Metadata): Promise<void> {
    await this._object.zipTrace(params);
  }

  async addSourcesToTrace(params: channels.LocalUtilsAddSourcesToTraceParams, metadata?: channels.Metadata): Promise<void> {
    await this._object.addSourcesToTrace(params);
  }
}
