/**
 * Copyright 2019 Google Inc. All rights reserved.
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

export class DelaySettings {
  private _parent: DelaySettings | undefined;
  private _defaultDelay: number | null = null;

  constructor(parent?: DelaySettings) {
    this._parent = parent;
  }

  setDefaultDelay(delay: number) {
    if (delay === 0)
      this._defaultDelay = null;
    else
      this._defaultDelay = delay;
  }

  delay(): null | number {
    if (this._defaultDelay !== null) return this._defaultDelay;
    if (this._parent) return this._parent.delay();
    return null;
  }
}
