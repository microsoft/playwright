/**
 * Copyright (c) Microsoft Corporation.
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

import { Writable } from 'stream';

import { stripAnsiEscapes } from '../../util';

export class StringWriteStream extends Writable {
  private _output: string[];
  private _prefix: string;

  constructor(output: string[], stdio: 'stdout' | 'stderr') {
    super();
    this._output = output;
    this._prefix = stdio === 'stdout' ? '' : '[err] ';
  }

  override _write(chunk: any, encoding: any, callback: any) {
    let text = stripAnsiEscapes(chunk.toString());
    if (text.endsWith('\n'))
      text = text.slice(0, -1);
    if (text)
      this._output.push(this._prefix + text);
    callback();
  }
}
