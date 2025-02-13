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
import * as localUtils from '../common/localUtils';

import type { HeadersArray, Size } from './types';
import type { HarBackend } from '../common/harBackend';
import type { Platform } from '../common/platform';
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
    return await localUtils.harOpen(this._platform, this._harBackends, params);
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
    const transport = this._platform.ws ? new WebSocketTransport(this._platform) : new JsonPipeTransport(this);
    const connectHeaders = await transport.connect(params);
    const connection = new Connection(this, this._platform, this._instrumentation, connectHeaders);
    connection.markAsRemote();
    connection.on('close', () => transport.close());

    let closeError: string | undefined;
    const onTransportClosed = (reason?: string) => {
      connection.close(reason || closeError);
    };
    transport.onClose(reason => onTransportClosed(reason));
    connection.onmessage = message => transport.send(message).catch(() => onTransportClosed());
    transport.onMessage(message => {
      try {
        connection!.dispatch(message);
      } catch (e) {
        closeError = String(e);
        transport.close();
      }
    });
    return connection;
  }
}
interface Transport {
  connect(params: channels.LocalUtilsConnectParams): Promise<HeadersArray>;
  send(message: any): Promise<void>;
  onMessage(callback: (message: object) => void): void;
  onClose(callback: (reason?: string) => void): void;
  close(): Promise<void>;
}

class JsonPipeTransport implements Transport {
  private _pipe: channels.JsonPipeChannel | undefined;
  private _owner: ChannelOwner<channels.LocalUtilsChannel>;

  constructor(owner: ChannelOwner<channels.LocalUtilsChannel>) {
    this._owner = owner;
  }

  async connect(params: channels.LocalUtilsConnectParams) {
    const { pipe, headers: connectHeaders } = await this._owner._wrapApiCall(async () => {
      return await this._owner._channel.connect(params);
    }, /* isInternal */ true);
    this._pipe = pipe;
    return connectHeaders;
  }

  async send(message: object) {
    this._owner._wrapApiCall(async () => {
      await this._pipe!.send({ message });
    }, /* isInternal */ true);
  }

  onMessage(callback: (message: object) => void) {
    this._pipe!.on('message', ({ message }) => callback(message));
  }

  onClose(callback: (reason?: string) => void) {
    this._pipe!.on('closed', ({ reason }) => callback(reason));
  }

  async close() {
    await this._owner._wrapApiCall(async () => {
      await this._pipe!.close().catch(() => {});
    }, /* isInternal */ true);
  }
}

class WebSocketTransport implements Transport {
  private _platform: Platform;
  private _ws: WebSocket | undefined;

  constructor(platform: Platform) {
    this._platform = platform;
  }

  async connect(params: channels.LocalUtilsConnectParams) {
    this._ws = this._platform.ws!(params.wsEndpoint);
    return [];
  }

  async send(message: object) {
    this._ws!.send(JSON.stringify(message));
  }

  onMessage(callback: (message: object) => void) {
    this._ws!.addEventListener('message', event => callback(JSON.parse(event.data)));
  }

  onClose(callback: (reason?: string) => void) {
    this._ws!.addEventListener('close', () => callback());
  }

  async close() {
    this._ws!.close();
  }
}
