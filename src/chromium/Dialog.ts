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

import { CDPSession } from './Connection';
import { assert } from '../helper';

export class Dialog {
  private _client: CDPSession;
  private _type: string;
  private _message: string;
  private _handled = false;
  private _defaultValue: string;

  constructor(client: CDPSession, type: string, message: string, defaultValue: (string | undefined) = '') {
    this._client = client;
    this._type = type;
    this._message = message;
    this._defaultValue = defaultValue;
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
    await this._client.send('Page.handleJavaScriptDialog', {
      accept: true,
      promptText: promptText
    });
  }

  async dismiss() {
    assert(!this._handled, 'Cannot dismiss dialog which is already handled!');
    this._handled = true;
    await this._client.send('Page.handleJavaScriptDialog', {
      accept: false
    });
  }
}

export const DialogType = {
  Alert: 'alert',
  BeforeUnload: 'beforeunload',
  Confirm: 'confirm',
  Prompt: 'prompt'
};
