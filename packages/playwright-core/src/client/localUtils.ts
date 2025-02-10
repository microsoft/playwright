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

import { ChannelOwner } from './channelOwner';
import { Connection } from './connection';
import * as localUtils from '../utils/localUtils';

import type { Size } from './types';
import type { HarBackend } from '../utils/harBackend';
import type * as channels from '@protocol/channels';

type DeviceDescriptor = {
  userAgent: string,
  viewport: Size,
  deviceScaleFactor: number,
  isMobile: boolean,
  hasTouch: boolean,
  defaultBrowserType: 'chromium' | 'firefox' | 'webkit'
};
type Devices = { [name: string]: DeviceDescriptor };

export class LocalUtils extends ChannelOwner<channels.LocalUtilsChannel> {
  readonly devices: Devices;
  private _harBackends = new Map<string, HarBackend>();
  private _stackSessions = new Map<string, localUtils.StackSession>();

  constructor(parent: ChannelOwner, type: string, guid: string, initializer: channels.LocalUtilsInitializer) {
    super(parent, type, guid, initializer);
    this.markAsInternalType();
    this.devices = {};
    for (const { name, descriptor } of initializer.deviceDescriptors)
      this.devices[name] = descriptor;
  }

  async zip(params: channels.LocalUtilsZipParams): Promise<void> {
    return await localUtils.zip(this._platform, this._stackSessions, params);
  }

  async harOpen(params: channels.LocalUtilsHarOpenParams): Promise<channels.LocalUtilsHarOpenResult> {
    return await localUtils.harOpen(this._harBackends, params);
  }

  async harLookup(params: channels.LocalUtilsHarLookupParams): Promise<channels.LocalUtilsHarLookupResult> {
    return await localUtils.harLookup(this._harBackends, params);
  }

  async harClose(params: channels.LocalUtilsHarCloseParams): Promise<void> {
    return await localUtils.harClose(this._harBackends, params);
  }

  async harUnzip(params: channels.LocalUtilsHarUnzipParams): Promise<void> {
    return await localUtils.harUnzip(params);
  }

  async tracingStarted(params: channels.LocalUtilsTracingStartedParams): Promise<channels.LocalUtilsTracingStartedResult> {
    return await localUtils.tracingStarted(this._stackSessions, params);
  }

  async traceDiscarded(params: channels.LocalUtilsTraceDiscardedParams): Promise<void> {
    return await localUtils.traceDiscarded(this._platform, this._stackSessions, params);
  }

  async addStackToTracingNoReply(params: channels.LocalUtilsAddStackToTracingNoReplyParams): Promise<void> {
    return await localUtils.addStackToTracingNoReply(this._stackSessions, params);
  }

  async connect(params: channels.LocalUtilsConnectParams): Promise<Connection> {
    const { pipe, headers: connectHeaders } = await this._channel.connect(params);
    const closePipe = () => this._wrapApiCall(() => pipe.close().catch(() => {}), /* isInternal */ true);
    const connection = new Connection(this, this._platform, this._instrumentation, connectHeaders);
    connection.markAsRemote();
    connection.on('close', closePipe);

    let closeError: string | undefined;
    const onPipeClosed = (reason?: string) => {
      connection.close(reason || closeError);
    };
    pipe.on('closed', params => onPipeClosed(params.reason));
    connection.onmessage = message => this._wrapApiCall(() => pipe.send({ message }).catch(() => onPipeClosed()), /* isInternal */ true);

    pipe.on('message', ({ message }) => {
      try {
        connection!.dispatch(message);
      } catch (e) {
        closeError = String(e);
        closePipe();
      }
    });
    return connection;
  }
}
