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
import type * as stream from 'stream';
import { ManualPromise, createGuid } from '../../utils';
import type { ArtifactDispatcher } from './artifactDispatcher';

export class StreamDispatcher extends Dispatcher<{ guid: string, stream: stream.Readable }, channels.StreamChannel, ArtifactDispatcher> implements channels.StreamChannel {
  _type_Stream = true;
  private _ended: boolean = false;

  constructor(scope: ArtifactDispatcher, stream: stream.Readable) {
    super(scope, { guid: 'stream@' + createGuid(), stream }, 'Stream', {});
    // In Node v12.9.0+ we can use readableEnded.
    stream.once('end', () => this._ended =  true);
    stream.once('error', () => this._ended =  true);
  }

  async read(params: channels.StreamReadParams): Promise<channels.StreamReadResult> {
    const stream = this._object.stream;
    if (this._ended)
      return { binary: Buffer.from('') };
    if (!stream.readableLength) {
      const readyPromise = new ManualPromise<void>();
      const done = () => readyPromise.resolve();
      stream.on('readable', done);
      stream.on('end', done);
      stream.on('error', done);
      await readyPromise;
      stream.off('readable', done);
      stream.off('end', done);
      stream.off('error', done);
    }
    const buffer = stream.read(Math.min(stream.readableLength, params.size || stream.readableLength));
    return { binary: buffer || Buffer.from('') };
  }

  async close() {
    this._object.stream.destroy();
  }
}
