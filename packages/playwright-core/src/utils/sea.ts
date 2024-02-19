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

import path from 'path';
import fs from 'fs';

class Sea {
  private _isSea = false;
  private _sea;
  private _fsRoot;

  constructor() {
    try {
      this._sea = require('node:sea');
      this._isSea = this._sea.isSea();
    } catch (error) { }
    if (!this._isSea)
      this._fsRoot = path.join(__dirname, '..', '..');
  }

  public readFile(file: string): Buffer {
    if (this._isSea)
      return Buffer.from(this._sea.getRawAsset(file));
    return fs.readFileSync(path.join(this._fsRoot!, file));
  }
}

export const sea = new Sea();
