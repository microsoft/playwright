/**
 * Copyright Microsoft Corporation. All rights reserved.
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

import fs from 'fs';
import path from 'path';
import { currentConfig } from './common/globals';
import { mime } from 'playwright-core/lib/utilsBundle';
import { isJsonMimeType, isString, isTextualMimeType } from 'playwright-core/lib/utils';

class JsonStore {
  async delete(name: string) {
    const file = this.path(name);
    await fs.promises.rm(file, { force: true });
  }

  async get<T>(name: string) {
    const file = this.path(name);
    try {
      const type = contentType(name);
      if (type === 'binary')
        return await fs.promises.readFile(file) as T;
      const text = await fs.promises.readFile(file, 'utf-8');
      if (type === 'json')
        return JSON.parse(text) as T;
      return text as T;
    } catch (e) {
      return undefined;
    }
  }

  path(name: string): string {
    return path.join(this.root(), name);
  }

  root(): string {
    const config = currentConfig();
    if (!config)
      throw new Error('Cannot access store before config is loaded');
    return config._internal.storeDir;
  }

  async set<T>(name: string, value: T | undefined) {
    const file = this.path(name);
    if (value === undefined) {
      await fs.promises.rm(file, { force: true });
      return;
    }
    let data: string | Buffer = '';
    switch (contentType(name)) {
      case 'json': {
        if (Buffer.isBuffer(value))
          throw new Error('JSON value must be an Object');
        data = JSON.stringify(value, undefined, 2);
        break;
      }
      case 'text': {
        if (!isString(value))
          throw new Error('Textual value must be a string');
        data = value as string;
        break;
      }
      case 'binary': {
        if (!Buffer.isBuffer(value))
          throw new Error('Binary value must be a Buffer');
        data = value;
        break;
      }
    }
    await fs.promises.mkdir(path.dirname(file), { recursive: true });
    await fs.promises.writeFile(file, data);
  }
}

function contentType(name: string): 'json'|'text'|'binary' {
  const mimeType = mime.getType(path.basename(name)) ?? 'application/octet-string';
  if (isJsonMimeType(mimeType))
    return 'json';
  if (isTextualMimeType(mimeType))
    return 'text';
  return 'binary';
}

export const store = new JsonStore();
