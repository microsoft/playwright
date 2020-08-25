/**
 * Copyright 2017 Google Inc. All rights reserved.
 * Modifications copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { assert } from '../utils/utils';
import { debugLogger } from '../utils/debugLogger';

type OnHandle = (accept: boolean, promptText?: string) => Promise<void>;

export type DialogType = 'alert' | 'beforeunload' | 'confirm' | 'prompt';

export class Dialog {
  private _type: string;
  private _message: string;
  private _onHandle: OnHandle;
  private _handled = false;
  private _defaultValue: string;

  constructor(type: string, message: string, onHandle: OnHandle, defaultValue?: string) {
    this._type = type;
    this._message = message;
    this._onHandle = onHandle;
    this._defaultValue = defaultValue || '';
    debugLogger.log('api', `  ${this._preview()} was shown`);
  }

  type(): string {
    return this._type;
  }

  message(): string {
    return this._message;
  }

  defaultValue(): string {
    return this._defaultValue;
  }

  async accept(promptText: string | undefined) {
    assert(!this._handled, 'Cannot accept dialog which is already handled!');
    this._handled = true;
    debugLogger.log('api', `  ${this._preview()} was accepted`);
    await this._onHandle(true, promptText);
  }

  async dismiss() {
    assert(!this._handled, 'Cannot dismiss dialog which is already handled!');
    this._handled = true;
    debugLogger.log('api', `  ${this._preview()} was dismissed`);
    await this._onHandle(false);
  }

  private _preview(): string {
    if (!this._message)
      return this._type;
    if (this._message.length <= 50)
      return `${this._type} "${this._message}"`;
    return `${this._type} "${this._message.substring(0, 49) + '\u2026'}"`;
  }
}
