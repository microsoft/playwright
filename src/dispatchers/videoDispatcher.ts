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

import * as fs from 'fs';
import * as util from 'util';
import * as channels from '../protocol/channels';
import { Video } from '../server/browserContext';
import { mkdirIfNeeded } from '../utils/utils';
import { Dispatcher, DispatcherScope } from './dispatcher';
import { StreamDispatcher } from './streamDispatcher';

export class VideoDispatcher extends Dispatcher<Video, channels.VideoInitializer> implements channels.VideoChannel {
  constructor(scope: DispatcherScope, screencast: Video) {
    super(scope, screencast, 'Video', {});
  }

  async path(): Promise<channels.VideoPathResult> {
    return { value: await this._object.path() };
  }

  async saveAs(params: channels.VideoSaveAsParams): Promise<channels.VideoSaveAsResult> {
    const fileName = await this._object.path();
    await mkdirIfNeeded(params.path);
    await util.promisify(fs.copyFile)(fileName, params.path);
  }

  async stream(): Promise<channels.VideoStreamResult> {
    const fileName = await this._object.path();
    const readable = fs.createReadStream(fileName);
    await new Promise(f => readable.on('readable', f));
    return { stream: new StreamDispatcher(this._scope, readable) };
  }

}
