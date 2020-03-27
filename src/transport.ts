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

export class SlowMoTransport {
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
