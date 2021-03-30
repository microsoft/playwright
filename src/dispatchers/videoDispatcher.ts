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

import * as channels from '../protocol/channels';
import { Dispatcher, DispatcherScope } from './dispatcher';
import { StreamDispatcher } from './streamDispatcher';
import fs from 'fs';
import * as util from 'util';
import { mkdirIfNeeded } from '../utils/utils';
import { Video } from '../server/browserContext';

export class VideoDispatcher extends Dispatcher<Video, channels.VideoInitializer> implements channels.VideoChannel {
  constructor(scope: DispatcherScope, video: Video) {
    super(scope, video, 'Video', {
      absolutePath: video._path,
    });
  }

  async saveAs(params: channels.VideoSaveAsParams): Promise<channels.VideoSaveAsResult> {
    return await new Promise((resolve, reject) => {
      this._object.saveAs(async localPath => {
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

  async saveAsStream(): Promise<channels.VideoSaveAsStreamResult> {
    return await new Promise((resolve, reject) => {
      this._object.saveAs(async localPath => {
        try {
          const readable = fs.createReadStream(localPath);
          await new Promise(f => readable.on('readable', f));
          const stream = new StreamDispatcher(this._scope, readable);
          // Resolve with a stream, so that client starts saving the data.
          resolve({ stream });
          // Block the video until the stream is consumed.
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
}
