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

import { debugLogger } from '@utils/debugLogger';

import type { ConnectionTransport, ProtocolRequest, ProtocolResponse } from '../transport';
import type * as bidiMapper from 'chromium-bidi/out/Default/gen/src/bidiMapper/BidiMapper.js';
import type * as bidiCdpConnection from 'chromium-bidi/out/Default/gen/src/cdp/CdpConnection.js';
import type { ChromiumBidi } from 'chromium-bidi/out/Default/gen/src/protocol/protocol.js';
import type * as bidiLog from 'chromium-bidi/out/Default/gen/src/utils/log.js';
import type * as bidiTransport from 'chromium-bidi/out/Default/gen/src/utils/transport.js';

const bidiServerLogger: bidiLog.LoggerFn = prefix => {
  if (!debugLogger.isEnabled(prefix as any))
    return undefined;
  return (...args: unknown[]): void => {
    debugLogger.log(prefix as any, args);
  };
};

// Node < 24 does not expose DisposableStack without --harmony-explicit-resource-management.
function ensureDisposableStackPolyfill() {
  if ('DisposableStack' in globalThis)
    return;
  const disposeSymbol: symbol = (Symbol as any).dispose ??= Symbol.for('Symbol.dispose');
  class DisposableStackPolyfill {
    private _disposed = false;
    private _stack: (() => void)[] = [];

    get disposed() {
      return this._disposed;
    }

    defer(onDispose: () => void): void {
      if (this._disposed)
        throw new ReferenceError('DisposableStack is already disposed');
      if (typeof onDispose !== 'function')
        throw new TypeError('onDispose is not a function');
      this._stack.push(onDispose);
    }

    use<T>(value: T): T {
      if (this._disposed)
        throw new ReferenceError('DisposableStack is already disposed');
      if (value !== null && value !== undefined) {
        const method = (value as any)[disposeSymbol];
        if (typeof method !== 'function')
          throw new TypeError('Value is not disposable');
        this._stack.push(() => method.call(value));
      }
      return value;
    }

    adopt<T>(value: T, onDispose: (value: T) => void): T {
      if (this._disposed)
        throw new ReferenceError('DisposableStack is already disposed');
      if (typeof onDispose !== 'function')
        throw new TypeError('onDispose is not a function');
      this._stack.push(() => onDispose(value));
      return value;
    }

    move(): DisposableStackPolyfill {
      if (this._disposed)
        throw new ReferenceError('DisposableStack is already disposed');
      const next = new DisposableStackPolyfill();
      next._stack = this._stack;
      this._stack = [];
      this._disposed = true;
      return next;
    }

    dispose(): void {
      if (this._disposed)
        return;
      this._disposed = true;
      const stack = this._stack;
      this._stack = [];
      let hasError = false;
      let error: unknown;
      for (let i = stack.length - 1; i >= 0; i--) {
        try {
          stack[i]();
        } catch (e) {
          if (hasError) {
            const SuppressedErr = (globalThis as any).SuppressedError;
            error = SuppressedErr ? new SuppressedErr(e, error, 'An error was suppressed during disposal') : e;
          } else {
            hasError = true;
            error = e;
          }
        }
      }
      if (hasError)
        throw error;
    }

    [disposeSymbol](): void {
      this.dispose();
    }
  }
  (globalThis as any).DisposableStack = DisposableStackPolyfill;
}

export async function connectBidiOverCdp(cdp: ConnectionTransport): Promise<ConnectionTransport> {
  ensureDisposableStackPolyfill();
  // chromium-bidi is not in our dependencies. Bundlers do not fail on a
  // missing module if its import() is inside a try block.
  let bidiMapperModule: typeof bidiMapper;
  let bidiCdpConnectionModule: typeof bidiCdpConnection;
  try {
    bidiMapperModule = await import('chromium-bidi/out/Default/gen/src/bidiMapper/BidiMapper.js');
    bidiCdpConnectionModule = await import('chromium-bidi/out/Default/gen/src/cdp/CdpConnection.js');
  } catch (error) {
    throw error;
  }
  let server: bidiMapper.BidiServer | undefined = undefined;
  const bidiTransport = new BidiTransportImpl();
  const bidiConnection = new BidiConnection(bidiTransport, () => server?.close());
  const cdpTransportImpl = new CdpTransportImpl(cdp);
  const cdpConnection = new bidiCdpConnectionModule.MapperCdpConnection(cdpTransportImpl, bidiServerLogger);
  // Make sure onclose event is propagated.
  cdp.onclose = () => bidiConnection.onclose?.();
  server = await bidiMapperModule.BidiServer.createAndStart(
      bidiTransport,
      cdpConnection,
      await cdpConnection.createBrowserSession(),
      /* selfTargetId= */ '',
      undefined,
      bidiServerLogger);
  return bidiConnection;
}

class BidiTransportImpl implements bidiMapper.BidiTransport {
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
