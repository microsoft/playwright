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

import * as fs from 'fs';

export class ThrottledFile {
  private _file: string;
  private _timer: NodeJS.Timeout | undefined;
  private _text: string | undefined;

  constructor(file: string) {
    this._file = file;
  }

  setContent(text: string) {
    this._text = text;
    if (!this._timer)
      this._timer = setTimeout(() => this.flush(), 250);
  }

  flush(): void {
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = undefined;
    }
    if (this._text)
      fs.writeFileSync(this._file, this._text);
    this._text = undefined;
  }
}
