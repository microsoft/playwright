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
import type { FullConfigInternal, GlobalInfo } from './types';
import { normalizeAndSaveAttachment } from './util';
import fs from 'fs';
export class GlobalInfoImpl implements GlobalInfo {
  private _fullConfig: FullConfigInternal;
  private _attachments: { name: string; path?: string | undefined; body?: Buffer | undefined; contentType: string; }[] = [];

  constructor(config: FullConfigInternal) {
    this._fullConfig = config;
  }

  attachments() {
    return [...this._attachments];
  }

  async attach(name: string, options: { path?: string, body?: string | Buffer, contentType?: string } = {}) {
    await fs.promises.mkdir(this._fullConfig._globalOutputDir, { recursive: true });
    this._attachments.push(await normalizeAndSaveAttachment(this._fullConfig._globalOutputDir, name, options));
  }
}
