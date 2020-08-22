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

import { makeWaitForNextTask } from '../utils/utils';

export class Transport {
  private _pipeWrite: NodeJS.WritableStream;
  private _data = Buffer.from([]);
  private _waitForNextTask = makeWaitForNextTask();
  private _closed = false;
  private _bytesLeft = 0;

  onmessage?: (message: string) => void;
  onclose?: () => void;

  constructor(pipeWrite: NodeJS.WritableStream, pipeRead: NodeJS.ReadableStream) {
    this._pipeWrite = pipeWrite;
    pipeRead.on('data', buffer => this._dispatch(buffer));
    pipeRead.on('close', () => this.onclose && this.onclose());
    this.onmessage = undefined;
    this.onclose = undefined;
  }

  send(message: string) {
    if (this._closed)
      throw new Error('Pipe has been closed');
    const data = Buffer.from(message, 'utf-8');
    const dataLength = Buffer.alloc(4);
    dataLength.writeUInt32LE(data.length, 0);
    this._pipeWrite.write(dataLength);
    this._pipeWrite.write(data);
  }

  close() {
    throw new Error('unimplemented');
  }

  _dispatch(buffer: Buffer) {
    this._data = Buffer.concat([this._data, buffer]);
    while (true) {
      if (!this._bytesLeft && this._data.length < 4) {
        // Need more data.
        break;
      }

      if (!this._bytesLeft) {
        this._bytesLeft = this._data.readUInt32LE(0);
        this._data = this._data.slice(4);
      }

      if (!this._bytesLeft || this._data.length < this._bytesLeft) {
        // Need more data.
        break;
      }

      const message = this._data.slice(0, this._bytesLeft);
      this._data = this._data.slice(this._bytesLeft);
      this._bytesLeft = 0;
      this._waitForNextTask(() => {
        if (this.onmessage)
          this.onmessage(message.toString('utf-8'));
      });
    }
  }
}
