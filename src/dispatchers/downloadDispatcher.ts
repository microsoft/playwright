/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License");
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

import { Download } from '../server/download';
import * as channels from '../protocol/channels';
import { Dispatcher, DispatcherScope } from './dispatcher';
import { StreamDispatcher } from './streamDispatcher';
import * as fs from 'fs';
import * as util from 'util';
import { mkdirIfNeeded } from '../utils/utils';

export class DownloadDispatcher extends Dispatcher<Download, channels.DownloadInitializer> implements channels.DownloadChannel {
  constructor(scope: DispatcherScope, download: Download) {
    super(scope, download, 'Download', {
      url: download.url(),
      suggestedFilename: download.suggestedFilename(),
    });
  }

  async path(): Promise<channels.DownloadPathResult> {
    const path = await this._object.localPath();
    return { value: path || undefined };
  }

  async saveAs(params: channels.DownloadSaveAsParams): Promise<channels.DownloadSaveAsResult> {
    return await new Promise((resolve, reject) => {
      this._object.saveAs(async (localPath, error) => {
        if (error !== undefined) {
          reject(error);
          return;
        }

        try {
          await mkdirIfNeeded(params.path);
          await util.promisify(fs.copyFile)(localPath, params.path);
          resolve();
        } catch (e) {
          reject(e);
        }
      });
    });
  }

  async saveAsStream(): Promise<channels.DownloadSaveAsStreamResult> {
    return await new Promise((resolve, reject) => {
      this._object.saveAs(async (localPath, error) => {
        if (error !== undefined) {
          reject(error);
          return;
        }

        try {
          const readable = fs.createReadStream(localPath);
          await new Promise(f => readable.on('readable', f));
          const stream = new StreamDispatcher(this._scope, readable);
          // Resolve with a stream, so that client starts saving the data.
          resolve({ stream });
          // Block the download until the stream is consumed.
          await new Promise<void>(resolve => {
            readable.on('close', resolve);
            readable.on('end', resolve);
            readable.on('error', resolve);
          });
        } catch (e) {
          reject(e);
        }
      });
    });
  }

  async stream(): Promise<channels.DownloadStreamResult> {
    const fileName = await this._object.localPath();
    if (!fileName)
      return {};
    const readable = fs.createReadStream(fileName);
    await new Promise(f => readable.on('readable', f));
    return { stream: new StreamDispatcher(this._scope, readable) };
  }

  async failure(): Promise<channels.DownloadFailureResult> {
    const error = await this._object.failure();
    return { error: error || undefined };
  }

  async delete(): Promise<void> {
    await this._object.delete();
  }
}
