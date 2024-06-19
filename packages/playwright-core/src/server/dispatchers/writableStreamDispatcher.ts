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

import type * as channels from '@protocol/channels';
import { Dispatcher } from './dispatcher';
import * as fs from 'fs';
import { createGuid } from '../../utils';
import type { BrowserContextDispatcher } from './browserContextDispatcher';

export class WritableStreamDispatcher extends Dispatcher<{ guid: string, streamOrDirectory: fs.WriteStream | string }, channels.WritableStreamChannel, BrowserContextDispatcher> implements channels.WritableStreamChannel {
  _type_WritableStream = true;
  private _lastModifiedMs: number | undefined;

  constructor(scope: BrowserContextDispatcher, streamOrDirectory: fs.WriteStream | string, lastModifiedMs?: number) {
    super(scope, { guid: 'writableStream@' + createGuid(), streamOrDirectory }, 'WritableStream', {});
    this._lastModifiedMs = lastModifiedMs;
  }

  async write(params: channels.WritableStreamWriteParams): Promise<channels.WritableStreamWriteResult> {
    if (typeof this._object.streamOrDirectory === 'string')
      throw new Error('Cannot write to a directory');
    const stream = this._object.streamOrDirectory;
    await new Promise<void>((fulfill, reject) => {
      stream.write(params.binary, error => {
        if (error)
          reject(error);
        else
          fulfill();
      });
    });
  }

  async close() {
    if (typeof this._object.streamOrDirectory === 'string')
      throw new Error('Cannot close a directory');
    const stream = this._object.streamOrDirectory;
    await new Promise<void>(fulfill => stream.end(fulfill));
    if (this._lastModifiedMs)
      await fs.promises.utimes(this.path(), new Date(this._lastModifiedMs), new Date(this._lastModifiedMs));
  }

  path(): string {
    if (typeof this._object.streamOrDirectory === 'string')
      return this._object.streamOrDirectory;
    return this._object.streamOrDirectory.path as string;
  }
}
