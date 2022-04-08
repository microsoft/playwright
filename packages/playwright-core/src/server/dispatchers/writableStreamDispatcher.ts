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

import type * as channels from '../../protocol/channels';
import type { DispatcherScope } from './dispatcher';
import { Dispatcher } from './dispatcher';
import type * as fs from 'fs';
import { createGuid } from '../../utils';

export class WritableStreamDispatcher extends Dispatcher<{ guid: string, stream: fs.WriteStream }, channels.WritableStreamChannel> implements channels.WritableStreamChannel {
  _type_WritableStream = true;
  constructor(scope: DispatcherScope, stream: fs.WriteStream) {
    super(scope, { guid: 'writableStream@' + createGuid(), stream }, 'WritableStream', {});
  }

  async write(params: channels.WritableStreamWriteParams): Promise<channels.WritableStreamWriteResult> {
    const stream = this._object.stream;
    await new Promise<void>((fulfill, reject) => {
      stream.write(Buffer.from(params.binary, 'base64'), error => {
        if (error)
          reject(error);
        else
          fulfill();
      });
    });
  }

  async close() {
    const stream = this._object.stream;
    await new Promise<void>(fulfill => stream.end(fulfill));
  }

  path(): string {
    return this._object.stream.path as string;
  }
}
