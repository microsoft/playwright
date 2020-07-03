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

import { helper } from '../helper';

export class Transport {
  private _pipeWrite: NodeJS.WritableStream;
  private _data = Buffer.from([]);
  private _waitForNextTask = helper.makeWaitForNextTask();
  private _closed = false;

  onmessage?: (message: any) => void;
  onclose?: () => void;

  constructor(pipeWrite: NodeJS.WritableStream, pipeRead: NodeJS.ReadableStream) {
    this._pipeWrite = pipeWrite;
    pipeRead.on('data', buffer => this._dispatch(buffer));
    this.onmessage = undefined;
    this.onclose = undefined;
  }

  send(message: string) {
    if (this._closed)
      throw new Error('Pipe has been closed');
    const data = Buffer.from(message + '\n', 'utf-8');
    this._pipeWrite.write(data);
  }

  close() {
    throw new Error('unimplemented');
  }

  _dispatch(buffer: Buffer) {
    this._data = Buffer.concat([this._data, buffer]);
    while (true) {

      if (this._data.indexOf('\n') === -1) {
        // Need more data.
        break;
      }

      const terminatorIndex = this._data.indexOf('\n');
      const message = this._data.slice(0, terminatorIndex);
      this._data = this._data.slice(terminatorIndex + 1);

      this._waitForNextTask(() => {
        if (this.onmessage)
          this.onmessage.call(null, message.toString('utf-8'));
      });
    }
  }
}
