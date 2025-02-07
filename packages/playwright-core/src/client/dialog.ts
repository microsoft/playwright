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

import { ChannelOwner } from './channelOwner';
import { Page } from './page';

import type * as api from '../../types/types';
import type * as channels from '@protocol/channels';


export class Dialog extends ChannelOwner<channels.DialogChannel> implements api.Dialog {
  static from(dialog: channels.DialogChannel): Dialog {
    return (dialog as any)._object;
  }

  private _page: Page | null;

  constructor(parent: ChannelOwner, type: string, guid: string, initializer: channels.DialogInitializer) {
    super(parent, type, guid, initializer);
    // Note: dialogs that open early during page initialization block it.
    // Therefore, we must report the dialog without a page to be able to handle it.
    this._page = Page.fromNullable(initializer.page);
  }

  page() {
    return this._page;
  }

  type(): string {
    return this._initializer.type;
  }

  message(): string {
    return this._initializer.message;
  }

  defaultValue(): string {
    return this._initializer.defaultValue;
  }

  async accept(promptText: string | undefined) {
    await this._channel.accept({ promptText });
  }

  async dismiss() {
    await this._channel.dismiss();
  }
}
