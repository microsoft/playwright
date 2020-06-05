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

import { EventEmitter } from 'events';
import { helper, RegisteredListener } from './helper';
import { ProgressController } from './progress';
import { InnerLogger } from './logger';
import { TimeoutSettings } from './timeoutSettings';

export abstract class ExtendedEventEmitter extends EventEmitter {
  protected _abortPromiseForEvent(event: string) {
    return new Promise<Error>(() => void 0);
  }
  protected abstract _getLogger(): InnerLogger;
  protected abstract _getTimeoutSettings(): TimeoutSettings;

  async waitForEvent(event: string, optionsOrPredicate: Function | { predicate?: Function, timeout?: number } = {}): Promise<any> {
    const options = typeof optionsOrPredicate === 'function' ? { predicate: optionsOrPredicate } : optionsOrPredicate;
    const { predicate = () => true } = options;

    const progressController = new ProgressController(this._getLogger(), this._getTimeoutSettings().timeout(options));
    this._abortPromiseForEvent(event).then(error => progressController.abort(error));

    return progressController.run(async progress => {
      const listeners: RegisteredListener[] = [];
      const promise = new Promise((resolve, reject) => {
        listeners.push(helper.addEventListener(this, event, eventArg => {
          try {
            if (!predicate(eventArg))
              return;
            resolve(eventArg);
          } catch (e) {
            reject(e);
          }
        }));
      });
      progress.cleanupWhenAborted(() => helper.removeEventListeners(listeners));

      const result = await promise;
      helper.removeEventListeners(listeners);
      return result;
    });
  }
}
