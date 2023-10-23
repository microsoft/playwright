/**
 * Copyright (c) Microsoft Corporation.
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

import fs from 'fs';
import { assert } from '../utils';
import { ManualPromise } from '../utils/manualPromise';
import { SdkObject } from './instrumentation';
import { TargetClosedError } from './errors';

type SaveCallback = (localPath: string, error?: Error) => Promise<void>;
type CancelCallback = () => Promise<void>;

export class Artifact extends SdkObject {
  private _localPath: string;
  private _unaccessibleErrorMessage: string | undefined;
  private _cancelCallback: CancelCallback | undefined;
  private _finishedPromise = new ManualPromise<void>();
  private _saveCallbacks: SaveCallback[] = [];
  private _finished: boolean = false;
  private _deleted = false;
  private _failureError: Error | undefined;

  constructor(parent: SdkObject, localPath: string, unaccessibleErrorMessage?: string, cancelCallback?: CancelCallback) {
    super(parent, 'artifact');
    this._localPath = localPath;
    this._unaccessibleErrorMessage = unaccessibleErrorMessage;
    this._cancelCallback = cancelCallback;
  }

  finishedPromise() {
    return this._finishedPromise;
  }

  localPath() {
    return this._localPath;
  }

  async localPathAfterFinished(): Promise<string> {
    if (this._unaccessibleErrorMessage)
      throw new Error(this._unaccessibleErrorMessage);
    await this._finishedPromise;
    if (this._failureError)
      throw this._failureError;
    return this._localPath;
  }

  saveAs(saveCallback: SaveCallback) {
    if (this._unaccessibleErrorMessage)
      throw new Error(this._unaccessibleErrorMessage);
    if (this._deleted)
      throw new Error(`File already deleted. Save before deleting.`);
    if (this._failureError)
      throw this._failureError;

    if (this._finished) {
      saveCallback(this._localPath).catch(() => {});
      return;
    }
    this._saveCallbacks.push(saveCallback);
  }

  async failureError(): Promise<string | null> {
    if (this._unaccessibleErrorMessage)
      return this._unaccessibleErrorMessage;
    await this._finishedPromise;
    return this._failureError?.message || null;
  }

  async cancel(): Promise<void> {
    assert(this._cancelCallback !== undefined);
    return this._cancelCallback();
  }

  async delete(): Promise<void> {
    if (this._unaccessibleErrorMessage)
      return;
    const fileName = await this.localPathAfterFinished();
    if (this._deleted)
      return;
    this._deleted = true;
    if (fileName)
      await fs.promises.unlink(fileName).catch(e => {});
  }

  async deleteOnContextClose(): Promise<void> {
    // Compared to "delete", this method does not wait for the artifact to finish.
    // We use it when closing the context to avoid stalling.
    if (this._deleted)
      return;
    this._deleted = true;
    if (!this._unaccessibleErrorMessage)
      await fs.promises.unlink(this._localPath).catch(e => {});
    await this.reportFinished(new TargetClosedError());
  }

  async reportFinished(error?: Error) {
    if (this._finished)
      return;
    this._finished = true;
    this._failureError = error;

    if (error) {
      for (const callback of this._saveCallbacks)
        await callback('', error);
    } else {
      for (const callback of this._saveCallbacks)
        await callback(this._localPath);
    }
    this._saveCallbacks = [];

    this._finishedPromise.resolve();
  }
}
