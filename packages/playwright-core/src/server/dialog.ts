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

import { assert } from '@isomorphic/assert';
import { SdkObject } from './instrumentation';

import type { Instrumentation } from './instrumentation';
import type { Page } from './page';
import type { Progress } from '@protocol/progress';

type OnHandle = (accept: boolean, promptText?: string) => Promise<void>;

export type DialogType = 'alert' | 'beforeunload' | 'confirm' | 'prompt';

export class Dialog extends SdkObject {
  private _page: Page;
  private _type: DialogType;
  private _message: string;
  private _onHandle: OnHandle;
  private _handled = false;
  private _defaultValue: string;

  constructor(page: Page, type: DialogType, message: string, onHandle: OnHandle, defaultValue?: string) {
    super(page, 'dialog');
    this._page = page;
    this._type = type;
    this._message = message;
    this._onHandle = onHandle;
    this._defaultValue = defaultValue || '';
  }

  async accept(progress: Progress, promptText?: string) {
    await progress.race(this._accept(promptText));
  }

  async dismiss(progress: Progress) {
    await progress.race(this._dismiss());
  }

  page() {
    return this._page;
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

  async _accept(promptText?: string) {
    assert(!this._handled, 'Cannot accept dialog which is already handled!');
    this._handled = true;
    this._page.browserContext.dialogManager._dialogWillClose(this);
    await this._onHandle(true, promptText);
  }

  async _dismiss() {
    assert(!this._handled, 'Cannot dismiss dialog which is already handled!');
    this._handled = true;
    this._page.browserContext.dialogManager._dialogWillClose(this);
    await this._onHandle(false);
  }

  async _close() {
    if (this._type === 'beforeunload')
      await this._accept();
    else
      await this._dismiss();
  }
}

export class DialogManager {
  private _instrumentation: Instrumentation;
  private _dialogHandlers = new Set<(dialog: Dialog) => boolean>();
  private _openedDialogs = new Set<Dialog>();

  constructor(instrumentation: Instrumentation) {
    this._instrumentation = instrumentation;
  }

  dialogDidOpen(dialog: Dialog) {
    // Any ongoing evaluations will be stalled until the dialog is closed.
    for (const frame of dialog.page().frameManager.frames())
      frame.invalidateNonStallingEvaluations('JavaScript dialog interrupted evaluation');
    this._openedDialogs.add(dialog);
    this._instrumentation.onDialog(dialog);

    let hasHandlers = false;
    for (const handler of this._dialogHandlers) {
      if (handler(dialog))
        hasHandlers = true;
    }
    if (!hasHandlers)
      dialog._close().then(() => {});
  }

  _dialogWillClose(dialog: Dialog) {
    this._openedDialogs.delete(dialog);
  }

  addDialogHandler(handler: (dialog: Dialog) => boolean) {
    this._dialogHandlers.add(handler);
  }

  removeDialogHandler(handler: (dialog: Dialog) => boolean) {
    this._dialogHandlers.delete(handler);
    if (!this._dialogHandlers.size) {
      for (const dialog of this._openedDialogs)
        dialog._close().catch(() => {});
    }
  }

  hasOpenDialogsForPage(page: Page) {
    return [...this._openedDialogs].some(dialog => dialog.page() === page);
  }

  async closeBeforeUnloadDialogs() {
    await Promise.all([...this._openedDialogs].map(async dialog => {
      if (dialog.type() === 'beforeunload')
        await dialog._dismiss();
    }));
  }
}
