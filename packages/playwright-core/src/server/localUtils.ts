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

import { ZipFile } from '@utils/zipFile';
import { HarBackend } from './harBackend';

import type * as channels from '@protocol/channels';
import type * as har from '@tracing/format/har';
import type { Progress } from '@protocol/progress';

export async function harOpen(progress: Progress, harBackends: Map<string, HarBackend>, params: channels.LocalUtilsHarOpenParams): Promise<channels.LocalUtilsHarOpenResult> {
  let harBackend: HarBackend;
  if (params.file.endsWith('.zip')) {
    const zipFile = new ZipFile(params.file);
    try {
      const entryNames = await progress.race(zipFile.entries());
      const harEntryName = entryNames.find(e => e.endsWith('.har'));
      if (!harEntryName)
        return { error: 'Specified archive does not have a .har file' };
      const har = await progress.race(zipFile.read(harEntryName));
      const harFile = JSON.parse(har.toString()) as har.HARFile;
      harBackend = new HarBackend(harFile, null, zipFile);
    } catch (error) {
      zipFile.close();
      throw error;
    }
  } else {
    const harFile = JSON.parse(await progress.race(fs.promises.readFile(params.file, 'utf-8'))) as har.HARFile;
    harBackend = new HarBackend(harFile, path.dirname(params.file), null);
  }
  harBackends.set(harBackend.id, harBackend);
  return { harId: harBackend.id };
}

export async function harLookup(progress: Progress, harBackends: Map<string, HarBackend>, params: channels.LocalUtilsHarLookupParams): Promise<channels.LocalUtilsHarLookupResult> {
  const harBackend = harBackends.get(params.harId);
  if (!harBackend)
    return { action: 'error', message: `Internal error: har was not opened` };
  return await progress.race(harBackend.lookup(params.url, params.method, params.headers, params.postData, params.isNavigationRequest));
}

export function harClose(harBackends: Map<string, HarBackend>, params: channels.LocalUtilsHarCloseParams) {
  const harBackend = harBackends.get(params.harId);
  if (harBackend) {
    harBackends.delete(harBackend.id);
    harBackend.dispose();
  }
}

export async function harUnzip(progress: Progress, params: channels.LocalUtilsHarUnzipParams): Promise<void> {
  const resourcesDir = params.resourcesDir ?? path.dirname(params.zipFile);
  const zipFile = new ZipFile(params.zipFile);
  let resourcesDirCreated = false;
  try {
    for (const entry of await progress.race(zipFile.entries())) {
      const buffer = await progress.race(zipFile.read(entry));
      if (entry === 'har.har') {
        await progress.race(fs.promises.writeFile(params.harFile, buffer));
      } else {
        if (!resourcesDirCreated) {
          await progress.race(fs.promises.mkdir(resourcesDir, { recursive: true }));
          resourcesDirCreated = true;
        }
        await progress.race(fs.promises.writeFile(path.join(resourcesDir, entry), buffer));
      }
    }
    await progress.race(fs.promises.unlink(params.zipFile));
  } finally {
    zipFile.close();
  }
}
