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

import { Writable } from 'stream';

import type { ProgressCallback } from '../sdk/server';

export class StringWriteStream extends Writable {
  private _progress: ProgressCallback;

  constructor(progress: ProgressCallback) {
    super();
    this._progress = progress;
  }

  override _write(chunk: any, encoding: any, callback: any) {
    const text = chunk.toString();
    // Progress wraps these as individual messages.
    this._progress({ message: text.endsWith('\n') ? text.slice(0, -1) : text });
    callback();
  }
}
