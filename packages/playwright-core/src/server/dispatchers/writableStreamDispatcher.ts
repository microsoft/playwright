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

import fs from 'fs';

import { Dispatcher } from './dispatcher';
import { SdkObject } from '../instrumentation';

import type { BrowserContextDispatcher } from './browserContextDispatcher';
import type * as channels from '@protocol/channels';
import type { Progress } from '@protocol/progress';

class WritableStreamSdkObject extends SdkObject {
  readonly streamOrDirectory: fs.WriteStream | string;
  readonly lastModifiedMs: number | undefined;

  constructor(parent: SdkObject, streamOrDirectory: fs.WriteStream | string, lastModifiedMs: number | undefined) {
    super(parent, 'stream');
    this.streamOrDirectory = streamOrDirectory;
    this.lastModifiedMs = lastModifiedMs;
  }
}

export class WritableStreamDispatcher extends Dispatcher<WritableStreamSdkObject, channels.WritableStreamChannel, BrowserContextDispatcher> implements channels.WritableStreamChannel {
  _type_WritableStream = true;

  constructor(scope: BrowserContextDispatcher, streamOrDirectory: fs.WriteStream | string, lastModifiedMs?: number) {
    super(scope, new WritableStreamSdkObject(scope._object, streamOrDirectory, lastModifiedMs), 'WritableStream', {});
  }

  async write(params: channels.WritableStreamWriteParams, progress: Progress): Promise<channels.WritableStreamWriteResult> {
    if (typeof this._object.streamOrDirectory === 'string')
      throw new Error('Cannot write to a directory');
    const stream = this._object.streamOrDirectory;
    await progress.race(new Promise<void>((fulfill, reject) => {
      stream.write(params.binary, error => {
        if (error)
          reject(error);
        else
          fulfill();
      });
    }));
  }

  async close(params: channels.WritableStreamCloseParams, progress: Progress): Promise<void> {
    if (typeof this._object.streamOrDirectory === 'string')
      throw new Error('Cannot close a directory');
    const stream = this._object.streamOrDirectory;
    await progress.race(new Promise<void>(fulfill => stream.end(fulfill)));
    if (this._object.lastModifiedMs)
      await progress.race(fs.promises.utimes(this.path(), new Date(this._object.lastModifiedMs), new Date(this._object.lastModifiedMs)));
  }

  path(): string {
    if (typeof this._object.streamOrDirectory === 'string')
      return this._object.streamOrDirectory;
    return this._object.streamOrDirectory.path as string;
  }
}
