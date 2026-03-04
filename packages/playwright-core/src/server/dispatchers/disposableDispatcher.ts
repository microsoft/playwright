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

import { Dispatcher } from './dispatcher';

import type { DisposableObject } from '../disposable';
import type { DispatcherScope } from './dispatcher';
import type * as channels from '@protocol/channels';
import type { Progress } from '@protocol/progress';

export class DisposableDispatcher extends Dispatcher<DisposableObject, channels.DisposableChannel, DispatcherScope> implements channels.DisposableChannel {
  _type_Disposable = true;

  constructor(scope: DispatcherScope, disposable: DisposableObject) {
    super(scope, disposable, 'Disposable', {});
  }

  async dispose(_: any, progress: Progress) {
    progress.metadata.potentiallyClosesScope = true;
    await this._object.dispose();
    this._dispose();
  }
}
