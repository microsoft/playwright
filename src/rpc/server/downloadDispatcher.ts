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

import { Download } from '../../download';
import { DownloadChannel, DownloadInitializer, StreamChannel } from '../channels';
import { Dispatcher, DispatcherScope } from './dispatcher';
import { StreamDispatcher } from './streamDispatcher';

export class DownloadDispatcher extends Dispatcher<Download, DownloadInitializer> implements DownloadChannel {
  constructor(scope: DispatcherScope, download: Download) {
    super(scope, download, 'download', {
      url: download.url(),
      suggestedFilename: download.suggestedFilename(),
    });
  }

  async path(): Promise<{ path: string | null }> {
    return { path: await this._object.path() };
  }

  async stream(): Promise<{ stream: StreamChannel | null }> {
    const stream = await this._object.createReadStream();
    if (!stream)
      return { stream: null };
    await new Promise(f => stream.on('readable', f));
    return { stream: new StreamDispatcher(this._scope, stream) };
  }

  async failure(): Promise<{ error: string | null }> {
    return { error: await this._object.failure() };
  }

  async delete(): Promise<void> {
    await this._object.delete();
  }
}
