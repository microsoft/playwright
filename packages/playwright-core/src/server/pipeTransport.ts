/**
 * Copyright 2018 Google Inc. All rights reserved.
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

import { debugLogger } from '@utils/debugLogger';
import { makeWaitForNextTask } from '@utils/task';

import { decodeCdpMessage, encodeCdpMessage, kEnvelopeHeaderSize, readEnvelopeBodyLength } from './cborCodec';

import type { ConnectionTransport, ProtocolRequest, ProtocolResponse } from './transport';

export class PipeTransport implements ConnectionTransport {
  private _pipeRead: NodeJS.ReadableStream;
  private _pipeWrite: NodeJS.WritableStream;
  private _pendingBuffers: Buffer[] = [];
  private _cborChunks: Buffer[] = [];
  private _cborChunksLength: number = 0;
  private _waitForNextTask = makeWaitForNextTask();
  private _closed = false;
  private _onclose?: (reason?: string) => void;
  private _protocol: 'json' | 'cbor';

  onmessage?: (message: ProtocolResponse) => void;

  constructor(pipeWrite: NodeJS.WritableStream, pipeRead: NodeJS.ReadableStream, protocol: 'json' | 'cbor' = 'json') {
    this._pipeRead = pipeRead;
    this._pipeWrite = pipeWrite;
    this._protocol = protocol;
    const dispatch = protocol === 'cbor'
      ? (buffer: Buffer) => this._dispatchCbor(buffer)
      : (buffer: Buffer) => this._dispatch(buffer);
    pipeRead.on('data', dispatch);
    pipeRead.on('close', () => {
      this._closed = true;
      if (this._onclose)
        this._onclose.call(null);
    });
    pipeRead.on('error', e => debugLogger.log('error', e));
    pipeWrite.on('error', e => debugLogger.log('error', e));
    this.onmessage = undefined;
  }

  get onclose() {
    return this._onclose;
  }

  set onclose(onclose: undefined | ((reason?: string) => void)) {
    this._onclose = onclose;
    if (onclose && !this._pipeRead.readable)
      onclose();
  }

  send(message: ProtocolRequest) {
    if (this._closed)
      throw new Error('Pipe has been closed');
    if (this._protocol === 'cbor') {
      this._pipeWrite.write(encodeCdpMessage(message));
    } else {
      this._pipeWrite.write(JSON.stringify(message));
      this._pipeWrite.write('\0');
    }
  }

  close() {
    throw new Error('unimplemented');
  }

  _dispatch(buffer: Buffer) {
    let end = buffer.indexOf('\0');
    if (end === -1) {
      this._pendingBuffers.push(buffer);
      return;
    }
    this._pendingBuffers.push(buffer.slice(0, end));
    const message = Buffer.concat(this._pendingBuffers).toString();
    this._waitForNextTask(() => {
      if (this.onmessage)
        this.onmessage.call(null, JSON.parse(message));
    });

    let start = end + 1;
    end = buffer.indexOf('\0', start);
    while (end !== -1) {
      const message = buffer.toString(undefined, start, end);
      this._waitForNextTask(() => {
        if (this.onmessage)
          this.onmessage.call(null, JSON.parse(message));
      });
      start = end + 1;
      end = buffer.indexOf('\0', start);
    }
    this._pendingBuffers = [buffer.slice(start)];
  }

  _dispatchCbor(chunk: Buffer) {
    this._cborChunks.push(chunk);
    this._cborChunksLength += chunk.length;

    while (this._cborChunksLength >= kEnvelopeHeaderSize) {
      // Need at least the 7-byte envelope header in the first chunk to read the body length.
      if (this._cborChunks[0].length < kEnvelopeHeaderSize) {
        const merged = Buffer.concat(this._cborChunks, this._cborChunksLength);
        this._cborChunks = [merged];
      }
      const bodyLen = readEnvelopeBodyLength(this._cborChunks[0], 0);
      const total = kEnvelopeHeaderSize + bodyLen;
      if (this._cborChunksLength < total)
        break;

      // Carve `total` bytes from the front of the chunk list without concatenating tail data.
      const parts: Buffer[] = [];
      let remaining = total;
      while (remaining > 0) {
        const head = this._cborChunks[0];
        if (head.length <= remaining) {
          parts.push(head);
          remaining -= head.length;
          this._cborChunks.shift();
        } else {
          parts.push(head.subarray(0, remaining));
          this._cborChunks[0] = head.subarray(remaining);
          remaining = 0;
        }
      }
      this._cborChunksLength -= total;
      const envelope = parts.length === 1 ? parts[0] : Buffer.concat(parts, total);

      this._waitForNextTask(() => {
        if (this.onmessage)
          this.onmessage.call(null, decodeCdpMessage(envelope));
      });
    }
  }
}
