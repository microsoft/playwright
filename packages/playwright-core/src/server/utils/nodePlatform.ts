/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
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

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as util from 'util';
import { Readable, Writable, pipeline } from 'stream';

import { colors } from '../../utilsBundle';
import { debugLogger } from './debugLogger';
import { currentZone, emptyZone } from './zones';

import type { Platform, Zone } from '../../common/platform';
import type { Zone as ZoneImpl } from './zones';
import type * as channels from '@protocol/channels';

const pipelineAsync = util.promisify(pipeline);

class NodeZone implements Zone {
  private _zone: ZoneImpl;

  constructor(zone: ZoneImpl) {
    this._zone = zone;
  }

  push<T>(data: T) {
    return new NodeZone(this._zone.with('apiZone', data));
  }

  pop() {
    return new NodeZone(this._zone.without('apiZone'));
  }

  run<R>(func: () => R): R {
    return this._zone.run(func);
  }

  data<T>(): T | undefined {
    return this._zone.data('apiZone');
  }
}

export const nodePlatform: Platform = {
  name: 'node',

  calculateSha1: (text: string) => {
    const sha1 = crypto.createHash('sha1');
    sha1.update(text);
    return Promise.resolve(sha1.digest('hex'));
  },

  colors,

  createGuid: () => crypto.randomBytes(16).toString('hex'),

  fs: () => fs,

  inspectCustom: util.inspect.custom,

  isDebuggerAttached: () => !!require('inspector').url(),

  isLogEnabled(name: 'api' | 'channel') {
    return debugLogger.isEnabled(name);
  },

  log(name: 'api' | 'channel', message: string | Error | object) {
    debugLogger.log(name, message);
  },

  path: () => path,

  pathSeparator: path.sep,

  async streamFile(path: string, stream: Writable): Promise<void> {
    await pipelineAsync(fs.createReadStream(path), stream);
  },

  streamReadable: (channel: channels.StreamChannel) => {
    return new ReadableStreamImpl(channel);
  },

  streamWritable: (channel: channels.WritableStreamChannel) => {
    return new WritableStreamImpl(channel);
  },

  zones: {
    current: () => new NodeZone(currentZone()),
    empty: new NodeZone(emptyZone),
  }
};

class ReadableStreamImpl extends Readable {
  private _channel: channels.StreamChannel;

  constructor(channel: channels.StreamChannel) {
    super();
    this._channel = channel;
  }

  override async _read() {
    const result = await this._channel.read({ size: 1024 * 1024 });
    if (result.binary.byteLength)
      this.push(result.binary);
    else
      this.push(null);
  }

  override _destroy(error: Error | null, callback: (error: Error | null | undefined) => void): void {
    // Stream might be destroyed after the connection was closed.
    this._channel.close().catch(e => null);
    super._destroy(error, callback);
  }
}

class WritableStreamImpl extends Writable {
  private _channel: channels.WritableStreamChannel;

  constructor(channel: channels.WritableStreamChannel) {
    super();
    this._channel = channel;
  }

  override async _write(chunk: Buffer | string, encoding: BufferEncoding, callback: (error?: Error | null) => void) {
    const error = await this._channel.write({ binary: typeof chunk === 'string' ? Buffer.from(chunk) : chunk }).catch(e => e);
    callback(error || null);
  }

  override async _final(callback: (error?: Error | null) => void) {
    // Stream might be destroyed after the connection was closed.
    const error = await this._channel.close().catch(e => e);
    callback(error || null);
  }
}
