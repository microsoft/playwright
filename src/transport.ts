/**
 * Copyright 2018 Google Inc. All rights reserved.
 * Modifications copyright (c) Microsoft Corporation.
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

import * as WebSocket from 'ws';
import { helper } from './helper';
import { Log } from './logger';

export type ProtocolRequest = {
  id: number;
  method: string;
  params: any;
  sessionId?: string;
  pageProxyId?: string;
};

export type ProtocolResponse = {
  id?: number;
  method?: string;
  sessionId?: string;
  error?: { message: string; data: any; };
  params?: any;
  result?: any;
  pageProxyId?: string;
};

export interface ConnectionTransport {
  send(s: ProtocolRequest): void;
  close(): void;  // Note: calling close is expected to issue onclose at some point.
  onmessage?: (message: ProtocolResponse) => void,
  onclose?: () => void,
}

export class SlowMoTransport implements ConnectionTransport {
  private readonly _delay: number;
  private readonly _delegate: ConnectionTransport;

  onmessage?: (message: ProtocolResponse) => void;
  onclose?: () => void;

  static wrap(transport: ConnectionTransport, delay?: number): ConnectionTransport {
    return delay ? new SlowMoTransport(transport, delay) : transport;
  }

  constructor(transport: ConnectionTransport, delay: number) {
    this._delay = delay;
    this._delegate = transport;
    this._delegate.onmessage = this._onmessage.bind(this);
    this._delegate.onclose = this._onClose.bind(this);
  }

  private _onmessage(message: ProtocolResponse) {
    if (this.onmessage)
      this.onmessage(message);
  }

  private _onClose() {
    if (this.onclose)
      this.onclose();
    this._delegate.onmessage = undefined;
    this._delegate.onclose = undefined;
  }

  send(s: ProtocolRequest) {
    setTimeout(() => {
      if (this._delegate.onmessage)
        this._delegate.send(s);
    }, this._delay);
  }

  close() {
    this._delegate.close();
  }
}

export class DeferWriteTransport implements ConnectionTransport {
  private _delegate: ConnectionTransport;
  private _readPromise: Promise<void>;

  onmessage?: (message: ProtocolResponse) => void;
  onclose?: () => void;

  constructor(transport: ConnectionTransport) {
    this._delegate = transport;
    let callback: () => void;
    this._readPromise = new Promise(f => callback = f);
    this._delegate.onmessage = (s: ProtocolResponse) => {
      callback();
      if (this.onmessage)
        this.onmessage(s);
    };
    this._delegate.onclose = () => {
      if (this.onclose)
        this.onclose();
    };
  }

  async send(s: ProtocolRequest) {
    await this._readPromise;
    this._delegate.send(s);
  }

  close() {
    this._delegate.close();
  }
}

export class WebSocketTransport implements ConnectionTransport {
  _ws: WebSocket;

  onmessage?: (message: ProtocolResponse) => void;
  onclose?: () => void;

  // 'onmessage' handler must be installed synchronously when 'onopen' callback is invoked to
  // avoid missing incoming messages.
  static connect<T>(url: string, onopen: (transport: ConnectionTransport) => Promise<T> | T): Promise<T> {
    const transport = new WebSocketTransport(url);
    return new Promise<T>((fulfill, reject) => {
      transport._ws.addEventListener('open', async () => fulfill(await onopen(transport)));
      transport._ws.addEventListener('error', event => reject(new Error('WebSocket error: ' + event.message)));
    });
  }

  constructor(url: string) {
    this._ws = new WebSocket(url, [], {
      perMessageDeflate: false,
      maxPayload: 256 * 1024 * 1024, // 256Mb
    });
    // The 'ws' module in node sometimes sends us multiple messages in a single task.
    // In Web, all IO callbacks (e.g. WebSocket callbacks)
    // are dispatched into separate tasks, so there's no need
    // to do anything extra.
    const messageWrap: (cb: () => void) => void = helper.makeWaitForNextTask();

    this._ws.addEventListener('message', event => {
      messageWrap(() => {
        if (this.onmessage)
          this.onmessage.call(null, JSON.parse(event.data));
      });
    });

    this._ws.addEventListener('close', event => {
      if (this.onclose)
        this.onclose.call(null);
    });
    // Silently ignore all errors - we don't know what to do with them.
    this._ws.addEventListener('error', () => {});
  }

  send(message: ProtocolRequest) {
    this._ws.send(JSON.stringify(message));
  }

  close() {
    this._ws.close();
  }
}

export class SequenceNumberMixer<V> {
  static _lastSequenceNumber = 1;
  private _values = new Map<number, V>();

  generate(value: V): number {
    const sequenceNumber = ++SequenceNumberMixer._lastSequenceNumber;
    this._values.set(sequenceNumber, value);
    return sequenceNumber;
  }

  take(sequenceNumber: number): V | undefined {
    const value = this._values.get(sequenceNumber);
    this._values.delete(sequenceNumber);
    return value;
  }
}

export class InterceptingTransport implements ConnectionTransport {
  private readonly _delegate: ConnectionTransport;
  private _interceptor: (message: ProtocolRequest) => ProtocolRequest;

  onmessage?: (message: ProtocolResponse) => void;
  onclose?: () => void;

  constructor(transport: ConnectionTransport, interceptor: (message: ProtocolRequest) => ProtocolRequest) {
    this._delegate = transport;
    this._interceptor = interceptor;
    this._delegate.onmessage = this._onmessage.bind(this);
    this._delegate.onclose = this._onClose.bind(this);
  }

  private _onmessage(message: ProtocolResponse) {
    if (this.onmessage)
      this.onmessage(message);
  }

  private _onClose() {
    if (this.onclose)
      this.onclose();
    this._delegate.onmessage = undefined;
    this._delegate.onclose = undefined;
  }

  send(s: ProtocolRequest) {
    this._delegate.send(this._interceptor(s));
  }

  close() {
    this._delegate.close();
  }
}

export const protocolLog: Log = {
  name: 'protocol',
  severity: 'verbose',
  color: 'green'
};
