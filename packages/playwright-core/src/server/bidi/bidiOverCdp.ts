/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an 'AS IS' BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { wrapInASCIIBox } from '@utils/ascii';
import { debugLogger } from '@utils/debugLogger';

import type { ConnectionTransport, ProtocolRequest, ProtocolResponse } from '../transport';
import type { BidiServer, BidiTransport } from 'chromium-bidi/lib/cjs/bidiMapper/BidiMapper';
import type { ChromiumBidi } from 'chromium-bidi/lib/cjs/protocol/protocol';
import type * as bidiTransport from 'chromium-bidi/lib/cjs/utils/transport';

type BidiMapperModule = typeof import('chromium-bidi/lib/cjs/bidiMapper/BidiMapper');
type CdpConnectionModule = typeof import('chromium-bidi/lib/cjs/cdp/CdpConnection');

const bidiServerLogger = (prefix: string, ...args: unknown[]): void => {
  debugLogger.log(prefix as any, args);
};

function requireChromiumBidi(): { bidiMapper: BidiMapperModule, bidiCdpConnection: CdpConnectionModule } {
  let bidiMapper: BidiMapperModule;
  let bidiCdpConnection: CdpConnectionModule;
  try {
    // chromium-bidi is a dev dependency; bundlers leave a require() inside try/catch unresolved instead of failing the build.
    bidiMapper = require('chromium-bidi/lib/cjs/bidiMapper/BidiMapper');
    bidiCdpConnection = require('chromium-bidi/lib/cjs/cdp/CdpConnection');
  } catch (error: any) {
    if (error?.code === 'MODULE_NOT_FOUND') {
      throw new Error('\n' + wrapInASCIIBox([
        'BiDi over CDP requires the chromium-bidi package!',
        'Please install it using `npm install -D chromium-bidi`.',
      ].join('\n'), 1));
    }
    throw error;
  }
  return { bidiMapper, bidiCdpConnection };
}

export async function connectBidiOverCdp(cdp: ConnectionTransport): Promise<ConnectionTransport> {
  const { bidiMapper, bidiCdpConnection } = requireChromiumBidi();
  let server: BidiServer | undefined = undefined;
  const bidiTransport = new BidiTransportImpl();
  const bidiConnection = new BidiConnection(bidiTransport, () => server?.close());
  const cdpTransportImpl = new CdpTransportImpl(cdp);
  const cdpConnection = new bidiCdpConnection.MapperCdpConnection(cdpTransportImpl, bidiServerLogger);
  // Make sure onclose event is propagated.
  cdp.onclose = () => bidiConnection.onclose?.();
  server = await bidiMapper.BidiServer.createAndStart(
      bidiTransport,
      cdpConnection,
      await cdpConnection.createBrowserSession(),
      /* selfTargetId= */ '',
      undefined,
      bidiServerLogger);
  return bidiConnection;
}

class BidiTransportImpl implements BidiTransport {
  _handler?: (message: ChromiumBidi.Command) => Promise<void> | void;
  _bidiConnection!: BidiConnection;

  setOnMessage(handler: (message: ChromiumBidi.Command) => Promise<void> | void) {
    this._handler = handler;
  }
  sendMessage(message: ChromiumBidi.Message): Promise<void> | void {
    return this._bidiConnection.onmessage?.(message as any);
  }
  close() {
    this._bidiConnection.onclose?.();
  }
}

class BidiConnection implements ConnectionTransport {
  private _bidiTransport: BidiTransportImpl;
  private _closeCallback: () => void;

  constructor(bidiTransport: BidiTransportImpl, closeCallback: () => void) {
    this._bidiTransport = bidiTransport;
    this._bidiTransport._bidiConnection = this;
    this._closeCallback = closeCallback;
  }
  send(s: ProtocolRequest): void {
    this._bidiTransport._handler?.(s as any);
  }
  close(): void {
    this._closeCallback();
  }
  onmessage?: ((message: ProtocolResponse) => void) | undefined;
  onclose?: ((reason?: string) => void) | undefined;
}

class CdpTransportImpl implements bidiTransport.Transport {
  private _connection: ConnectionTransport;
  private _handler?: (message: string) => Promise<void> | void;
  _bidiConnection!: BidiConnection;

  constructor(connection: ConnectionTransport) {
    this._connection = connection;
    this._connection.onmessage = message => {
      this._handler?.(JSON.stringify(message));
    };
  }
  setOnMessage(handler: (message: string) => Promise<void> | void) {
    this._handler = handler;
  }
  sendMessage(message: string): Promise<void> | void {
    return this._connection.send(JSON.parse(message));
  }
  close(): void {
    this._connection.close();
  }
}
