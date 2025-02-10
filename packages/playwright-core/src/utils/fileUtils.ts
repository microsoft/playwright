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

import type { Platform } from './platform';

export const fileUploadSizeLimit = 50 * 1024 * 1024;

export async function mkdirIfNeeded(platform: Platform, filePath: string) {
  // This will harmlessly throw on windows if the dirname is the root directory.
  await platform.fs().promises.mkdir(platform.path().dirname(filePath), { recursive: true }).catch(() => {});
}

export async function removeFolders(platform: Platform, dirs: string[]): Promise<Error[]> {
  return await Promise.all(dirs.map((dir: string) =>
    platform.fs().promises.rm(dir, { recursive: true, force: true, maxRetries: 10 }).catch(e => e)
  ));
}
