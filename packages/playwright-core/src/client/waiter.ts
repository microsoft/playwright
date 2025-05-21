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

import { TimeoutError } from './errors';
import { rewriteErrorMessage } from '../utils/isomorphic/stackTrace';

import type { ChannelOwner } from './channelOwner';
import type * as channels from '@protocol/channels';
import type { EventEmitter } from 'events';
import type { Zone } from './platform';

export class Waiter {
  private _dispose: (() => void)[];
  private _failures: Promise<any>[] = [];
  private _immediateError?: Error;
  private _logs: string[] = [];
  private _channelOwner: ChannelOwner<channels.EventTargetChannel>;
  private _waitId: string;
  private _error: string | undefined;
  private _savedZone: Zone;

  constructor(channelOwner: ChannelOwner<channels.EventTargetChannel>, event: string) {
    this._waitId = channelOwner._platform.createGuid();
    this._channelOwner = channelOwner;
    this._savedZone = channelOwner._platform.zones.current().pop();

    this._channelOwner._channel.waitForEventInfo({ info: { waitId: this._waitId, phase: 'before', event } }).catch(() => {});
    this._dispose = [
      () => this._channelOwner._wrapApiCall(async () => {
        await this._channelOwner._channel.waitForEventInfo({ info: { waitId: this._waitId, phase: 'after', error: this._error } });
      }, { internal: true }).catch(() => {}),
    ];
  }

  static createForEvent(channelOwner: ChannelOwner<channels.EventTargetChannel>, event: string) {
    return new Waiter(channelOwner, event);
  }

  async waitForEvent<T = void>(emitter: EventEmitter, event: string, predicate?: (arg: T) => boolean | Promise<boolean>): Promise<T> {
    const { promise, dispose } = waitForEvent(emitter, event, this._savedZone, predicate);
    return await this.waitForPromise(promise, dispose);
  }

  rejectOnEvent<T = void>(emitter: EventEmitter, event: string, error: Error | (() => Error), predicate?: (arg: T) => boolean | Promise<boolean>) {
    const { promise, dispose } = waitForEvent(emitter, event, this._savedZone, predicate);
    this._rejectOn(promise.then(() => { throw (typeof error === 'function' ? error() : error); }), dispose);
  }

  rejectOnTimeout(timeout: number, message: string) {
    if (!timeout)
      return;
    const { promise, dispose } = waitForTimeout(timeout);
    this._rejectOn(promise.then(() => { throw new TimeoutError(message); }), dispose);
  }

  rejectImmediately(error: Error) {
    this._immediateError = error;
  }

  dispose() {
    for (const dispose of this._dispose)
      dispose();
  }

  async waitForPromise<T>(promise: Promise<T>, dispose?: () => void): Promise<T> {
    try {
      if (this._immediateError)
        throw this._immediateError;
      const result = await Promise.race([promise, ...this._failures]);
      if (dispose)
        dispose();
      return result;
    } catch (e) {
      if (dispose)
        dispose();
      this._error = e.message;
      this.dispose();
      rewriteErrorMessage(e, e.message + formatLogRecording(this._logs));
      throw e;
    }
  }

  log(s: string) {
    this._logs.push(s);
    this._channelOwner._wrapApiCall(async () => {
      await this._channelOwner._channel.waitForEventInfo({ info: { waitId: this._waitId, phase: 'log', message: s } });
    }, { internal: true }).catch(() => {});
  }

  private _rejectOn(promise: Promise<any>, dispose?: () => void) {
    this._failures.push(promise);
    if (dispose)
      this._dispose.push(dispose);
  }
}

function waitForEvent<T = void>(emitter: EventEmitter, event: string, savedZone: Zone, predicate?: (arg: T) => boolean | Promise<boolean>): { promise: Promise<T>, dispose: () => void } {
  let listener: (eventArg: any) => void;
  const promise = new Promise<T>((resolve, reject) => {
    listener = async (eventArg: any) => {
      await savedZone.run(async () => {
        try {
          if (predicate && !(await predicate(eventArg)))
            return;
          emitter.removeListener(event, listener);
          resolve(eventArg);
        } catch (e) {
          emitter.removeListener(event, listener);
          reject(e);
        }
      });
    };
    emitter.addListener(event, listener);
  });
  const dispose = () => emitter.removeListener(event, listener);
  return { promise, dispose };
}

function waitForTimeout(timeout: number): { promise: Promise<void>, dispose: () => void } {
  let timeoutId: any;
  const promise = new Promise<void>(resolve => timeoutId = setTimeout(resolve, timeout));
  const dispose = () => clearTimeout(timeoutId);
  return { promise, dispose };
}

function formatLogRecording(log: string[]): string {
  if (!log.length)
    return '';
  const header = ` logs `;
  const headerLength = 60;
  const leftLength = (headerLength - header.length) / 2;
  const rightLength = headerLength - header.length - leftLength;
  return `\n${'='.repeat(leftLength)}${header}${'='.repeat(rightLength)}\n${log.join('\n')}\n${'='.repeat(headerLength)}`;
}
