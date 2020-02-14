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

export interface ConnectionTransport {
  send(s: string): void;
  close(): void;  // Note: calling close is expected to issue onclose at some point.
  onmessage?: (message: string) => void,
  onclose?: () => void,
}

export class SlowMoTransport {
  private readonly _delay: number;
  private readonly _delegate: ConnectionTransport;
  private _incomingMessageQueue: string[] = [];
  private _dispatchTimerId?: NodeJS.Timer;

  onmessage?: (message: string) => void;
  onclose?: () => void;

  static wrap(transport: ConnectionTransport, delay?: number): ConnectionTransport {
    return delay ? new SlowMoTransport(transport, delay) : transport;
  }

  constructor(transport: ConnectionTransport, delay: number) {
    this._delay = delay;
    this._delegate = transport;
    this._delegate.onmessage = this._enqueueMessage.bind(this);
    this._delegate.onclose = this._onClose.bind(this);
  }

  private _enqueueMessage(message: string) {
    this._incomingMessageQueue.push(message);
    this._scheduleQueueDispatch();
  }

  private _scheduleQueueDispatch() {
    if (this._dispatchTimerId)
      return;
    if (!this._incomingMessageQueue.length)
      return;
    this._dispatchTimerId = setTimeout(() => {
      this._dispatchTimerId = undefined;
      this._dispatchOneMessageFromQueue();
    }, this._delay);
  }

  private _dispatchOneMessageFromQueue() {
    const message = this._incomingMessageQueue.shift();
    try {
      if (this.onmessage)
        this.onmessage(message!);
    } finally {
      this._scheduleQueueDispatch();
    }
  }

  private _onClose() {
    if (this.onclose)
      this.onclose();
    this._delegate.onmessage = undefined;
    this._delegate.onclose = undefined;
  }

  send(s: string) {
    this._delegate.send(s);
  }

  close() {
    this._delegate.close();
  }
}

export class DeferWriteTransport implements ConnectionTransport {
  private _delegate: ConnectionTransport;
  private _readPromise: Promise<void>;

  onmessage?: (message: string) => void;
  onclose?: () => void;

  constructor(transport: ConnectionTransport) {
    this._delegate = transport;
    let callback: () => void;
    this._readPromise = new Promise(f => callback = f);
    this._delegate.onmessage = s => {
      callback();
      if (this.onmessage)
        this.onmessage(s);
    };
    this._delegate.onclose = () => {
      if (this.onclose)
        this.onclose();
    };
  }

  async send(s: string) {
    await this._readPromise;
    this._delegate.send(s);
  }

  close() {
    this._delegate.close();
  }
}
