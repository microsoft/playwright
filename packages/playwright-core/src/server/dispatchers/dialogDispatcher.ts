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

import { Dispatcher } from './dispatcher';
import { PageDispatcher } from './pageDispatcher';

import type { Dialog } from '../dialog';
import type { BrowserContextDispatcher } from './browserContextDispatcher';
import type * as channels from '@protocol/channels';
import type { Progress } from '@protocol/progress';

export class DialogDispatcher extends Dispatcher<Dialog, channels.DialogChannel, BrowserContextDispatcher | PageDispatcher> implements channels.DialogChannel {
  _type_Dialog = true;

  constructor(scope: BrowserContextDispatcher, dialog: Dialog) {
    const page = PageDispatcher.fromNullable(scope, dialog.page().initializedOrUndefined());
    // Prefer scoping to the page, unless we don't have one.
    super(page || scope, dialog, 'Dialog', {
      page,
      type: dialog.type(),
      message: dialog.message(),
      defaultValue: dialog.defaultValue(),
    });
  }

  async accept(params: channels.DialogAcceptParams, progress: Progress): Promise<void> {
    await progress.race(this._object.accept(params.promptText));
  }

  async dismiss(params: channels.DialogDismissParams, progress: Progress): Promise<void> {
    await progress.race(this._object.dismiss());
  }
}
