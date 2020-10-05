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

import * as channels from '../protocol/channels';
import { Dispatcher, DispatcherScope } from './dispatcher';
import * as stream from 'stream';
import { serializeError } from '../protocol/serializers';

export class StreamDispatcher extends Dispatcher<stream.Readable, channels.StreamInitializer> implements channels.StreamChannel {
  private _closedPromise: Promise<void>;
  private _closedCallback = () => {};
  private _ended = false;

  constructor(scope: DispatcherScope, stream: stream.Readable) {
    super(scope, stream, 'Stream', {});
    this._closedPromise = new Promise(f => this._closedCallback = f);
    // Switch into 'readable' mode where we pull data with stream.read().
    stream.on('readable', () => {});
    stream.on('end', () => this._ended = true);
    stream.on('error', error => this._dispatchEvent('streamError', { error: serializeError(error) }));
  }

  async waitUntilClosed() {
    await this._closedPromise;
  }

  async read(params: channels.StreamReadParams): Promise<channels.StreamReadResult> {
    if (!this._object.readable && !this._ended)
      await new Promise(f => this._object.once('readable', f));
    const buffer = this._object.read(Math.min(this._object.readableLength, params.size || this._object.readableLength));
    return { binary: buffer ? buffer.toString('base64') : '' };
  }

  async close() {
    this._closedCallback();
    this._object.destroy();
  }
}
