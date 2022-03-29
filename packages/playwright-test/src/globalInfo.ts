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
import path from 'path';
import * as mime from 'mime';
import { calculateSha1 } from 'playwright-core/lib/utils/utils';
import { GlobalInfo } from './types';

export class GlobalInfoImpl implements GlobalInfo {
  private _outputDir: string;

  constructor(outputDir: string) {
    this._outputDir = outputDir;
  }

  attachments: { name: string; path?: string | undefined; body?: Buffer | undefined; contentType: string; }[] = [];
  async attach(name: string, options: { path?: string, body?: string | Buffer, contentType?: string } = {}) {
    if ((options.path !== undefined ? 1 : 0) + (options.body !== undefined ? 1 : 0) !== 1)
      throw new Error(`Exactly one of "path" and "body" must be specified`);
    if (options.path !== undefined) {
      const hash = calculateSha1(options.path);
      // FIXME(rwoll): For now, we use 'tmp', but once we sort out what path this should be, we will remove.
      const dest = path.join(this._outputDir, 'tmp', 'attachments', hash + path.extname(options.path));
      await fs.promises.mkdir(path.dirname(dest), { recursive: true });
      await fs.promises.copyFile(options.path, dest);
      const contentType = options.contentType ?? (mime.getType(path.basename(options.path)) || 'application/octet-stream');
      this.attachments.push({ name, contentType, path: dest });
    } else {
      const contentType = options.contentType ?? (typeof options.body === 'string' ? 'text/plain' : 'application/octet-stream');
      this.attachments.push({ name, contentType, body: typeof options.body === 'string' ? Buffer.from(options.body) : options.body });
    }
  }
}
