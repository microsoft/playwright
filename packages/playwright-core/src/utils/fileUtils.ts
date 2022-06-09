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
import { rimraf } from '../utilsBundle';

export const existsAsync = (path: string): Promise<boolean> => new Promise(resolve => fs.stat(path, err => resolve(!err)));

export async function mkdirIfNeeded(filePath: string) {
  // This will harmlessly throw on windows if the dirname is the root directory.
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true }).catch(() => {});
}

export async function removeFolders(dirs: string[]): Promise<Array<Error|null|undefined>> {
  return await Promise.all(dirs.map((dir: string) => {
    return new Promise<Error|null|undefined>(fulfill => {
      rimraf(dir, { maxBusyTries: 10 }, error => {
        fulfill(error ?? undefined);
      });
    });
  }));
}

export function canAccessFile(file: string) {
  if (!file)
    return false;

  try {
    fs.accessSync(file);
    return true;
  } catch (e) {
    return false;
  }
}
