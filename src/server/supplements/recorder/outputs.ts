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

import fs from 'fs';

export interface RecorderOutput {
  printLn(text: string): void;
  popLn(text: string): void;
  flush(): void;
}

export interface Writable {
  write(data: string): void;
  columns(): number;
}

export class OutputMultiplexer implements RecorderOutput {
  private _outputs: RecorderOutput[]
  private _enabled = true;
  constructor(outputs: RecorderOutput[]) {
    this._outputs = outputs;
  }

  setEnabled(enabled: boolean) {
    this._enabled = enabled;
  }

  printLn(text: string) {
    if (!this._enabled)
      return;
    for (const output of this._outputs)
      output.printLn(text);
  }

  popLn(text: string) {
    if (!this._enabled)
      return;
    for (const output of this._outputs)
      output.popLn(text);
  }

  flush() {
    if (!this._enabled)
      return;
    for (const output of this._outputs)
      output.flush();
  }
}

export class BufferedOutput implements RecorderOutput {
  private _lines: string[] = [];
  private _buffer: string | null = null;
  private _onUpdate: ((text: string) => void);

  constructor(onUpdate: (text: string) => void = () => {}) {
    this._onUpdate = onUpdate;
  }

  printLn(text: string) {
    this._buffer = null;
    this._lines.push(...text.trimEnd().split('\n'));
    this._onUpdate(this.buffer());
  }

  popLn(text: string) {
    this._buffer = null;
    this._lines.length -= text.trimEnd().split('\n').length;
  }

  buffer(): string {
    if (this._buffer === null)
      this._buffer = this._lines.join('\n');
    return this._buffer;
  }

  clear() {
    this._lines = [];
    this._buffer = null;
    this._onUpdate(this.buffer());
  }

  flush() {
  }
}

export class FileOutput extends BufferedOutput implements RecorderOutput {
  private _fileName: string;

  constructor(fileName: string) {
    super();
    this._fileName = fileName;
    process.on('exit', () => this.flush());
  }

  flush() {
    fs.writeFileSync(this._fileName, this.buffer());
  }
}
