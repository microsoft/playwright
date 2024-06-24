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

import type * as channels from '@protocol/channels';
import fs from 'fs';
import path from 'path';
import { assert, fileUploadSizeLimit } from '../utils';
import { mime } from '../utilsBundle';
import type { WritableStreamDispatcher } from './dispatchers/writableStreamDispatcher';
import type { InputFilesItems } from './dom';
import type { Frame } from './frames';
import type * as types from './types';

async function filesExceedUploadLimit(files: string[]) {
  const sizes = await Promise.all(files.map(async file => (await fs.promises.stat(file)).size));
  return sizes.reduce((total, size) => total + size, 0) >= fileUploadSizeLimit;
}

export async function prepareFilesForUpload(frame: Frame, params: channels.ElementHandleSetInputFilesParams): Promise<InputFilesItems> {
  const { payloads, streams, directoryStream } = params;
  let { localPaths, localDirectory } = params;

  if ([payloads, localPaths, localDirectory, streams, directoryStream].filter(Boolean).length !== 1)
    throw new Error('Exactly one of payloads, localPaths and streams must be provided');

  if (streams)
    localPaths = streams.map(c => (c as WritableStreamDispatcher).path());
  if (directoryStream)
    localDirectory = (directoryStream as WritableStreamDispatcher).path();

  if (localPaths) {
    for (const p of localPaths)
      assert(path.isAbsolute(p) && path.resolve(p) === p, 'Paths provided to localPaths must be absolute and fully resolved.');
  }

  let fileBuffers: {
    name: string,
    mimeType?: string,
    buffer: Buffer,
    lastModifiedMs?: number,
  }[] | undefined = payloads;

  if (!frame._page._browserContext._browser._isCollocatedWithServer) {
    // If the browser is on a different machine read files into buffers.
    if (localPaths) {
      if (await filesExceedUploadLimit(localPaths))
        throw new Error('Cannot transfer files larger than 50Mb to a browser not co-located with the server');
      fileBuffers = await Promise.all(localPaths.map(async item => {
        return {
          name: path.basename(item),
          buffer: await fs.promises.readFile(item),
          lastModifiedMs: (await fs.promises.stat(item)).mtimeMs,
        };
      }));
      localPaths = undefined;
    }
  }

  const filePayloads: types.FilePayload[] | undefined = fileBuffers?.map(payload => ({
    name: payload.name,
    mimeType: payload.mimeType || mime.getType(payload.name) || 'application/octet-stream',
    buffer: payload.buffer.toString('base64'),
    lastModifiedMs: payload.lastModifiedMs
  }));

  return { localPaths, localDirectory, filePayloads };
}