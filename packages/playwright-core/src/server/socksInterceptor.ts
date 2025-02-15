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

import EventEmitter from 'events';

import * as socks from './utils/socksProxy';
import { ValidationError, findValidator } from '../protocol/validator';
import { isUnderTest } from './utils/debug';

import type { WebSocketTransport } from './transport';
import type { ValidatorContext } from '../protocol/validator';
import type * as channels from '@protocol/channels';

export class SocksInterceptor {
  private _handler: socks.SocksProxyHandler;
  private _channel: channels.SocksSupportChannel & EventEmitter;
  private _socksSupportObjectGuid?: string;
  private _ids = new Set<number>();

  constructor(transport: WebSocketTransport, pattern: string | undefined, redirectPortForTest: number | undefined) {
    this._handler = new socks.SocksProxyHandler(pattern,  redirectPortForTest);

    let lastId = -1;
    this._channel = new Proxy(new EventEmitter(), {
      get: (obj: any, prop: string | symbol) => {
        if ((prop in obj) || obj[prop] !== undefined || typeof prop !== 'string')
          return obj[prop];
        return (params: any) => {
          try {
            const id = --lastId;
            this._ids.add(id);
            const validator = findValidator('SocksSupport', prop, 'Params');
            params = validator(params, '', { tChannelImpl: tChannelForSocks, binary: 'toBase64', isUnderTest });
            transport.send({ id, guid: this._socksSupportObjectGuid, method: prop, params, metadata: { stack: [], apiName: '', internal: true } } as any);
          } catch (e) {
          }
        };
      },
    }) as channels.SocksSupportChannel & EventEmitter;
    this._handler.on(socks.SocksProxyHandler.Events.SocksConnected, (payload: socks.SocksSocketConnectedPayload) => this._channel.socksConnected(payload));
    this._handler.on(socks.SocksProxyHandler.Events.SocksData, (payload: socks.SocksSocketDataPayload) => this._channel.socksData(payload));
    this._handler.on(socks.SocksProxyHandler.Events.SocksError, (payload: socks.SocksSocketErrorPayload) => this._channel.socksError(payload));
    this._handler.on(socks.SocksProxyHandler.Events.SocksFailed, (payload: socks.SocksSocketFailedPayload) => this._channel.socksFailed(payload));
    this._handler.on(socks.SocksProxyHandler.Events.SocksEnd, (payload: socks.SocksSocketEndPayload) => this._channel.socksEnd(payload));
    this._channel.on('socksRequested', payload => this._handler.socketRequested(payload));
    this._channel.on('socksClosed', payload => this._handler.socketClosed(payload));
    this._channel.on('socksData', payload => this._handler.sendSocketData(payload));
  }

  cleanup() {
    this._handler.cleanup();
  }

  interceptMessage(message: any): boolean {
    if (this._ids.has(message.id)) {
      this._ids.delete(message.id);
      return true;
    }
    if (message.method === '__create__' && message.params.type === 'SocksSupport') {
      this._socksSupportObjectGuid = message.params.guid;
      return false;
    }
    if (this._socksSupportObjectGuid && message.guid === this._socksSupportObjectGuid) {
      const validator = findValidator('SocksSupport', message.method, 'Event');
      const params = validator(message.params, '', { tChannelImpl: tChannelForSocks, binary: 'fromBase64', isUnderTest });
      this._channel.emit(message.method, params);
      return true;
    }
    return false;
  }
}

function tChannelForSocks(names: '*' | string[], arg: any, path: string, context: ValidatorContext) {
  throw new ValidationError(`${path}: channels are not expected in SocksSupport`);
}
