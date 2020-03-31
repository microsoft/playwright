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

import { EventEmitter } from './platform';
import { helper } from './helper';

export class ExtendedEventEmitter extends EventEmitter {
  protected _abortPromiseForEvent(event: string) {
    return new Promise<Error>(() => void 0);
  }

  protected _timeoutForEvent(event: string): number {
    throw new Error('unimplemented');
  }

  async waitForEvent(event: string, optionsOrPredicate: Function|{ predicate?: Function, timeout?: number } = {}): Promise<any> {
    const {
      predicate = () => true,
      timeout = this._timeoutForEvent(event)
    } = typeof optionsOrPredicate === 'function' ? {predicate: optionsOrPredicate} : optionsOrPredicate;
    return helper.waitForEvent(this, event, predicate, timeout, this._abortPromiseForEvent(event));
  }
}
