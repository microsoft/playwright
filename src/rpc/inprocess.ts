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

import { DispatcherConnection } from './server/dispatcher';
import type { Playwright as PlaywrightImpl } from '../server/playwright';
import type { Playwright as PlaywrightAPI } from './client/playwright';
import { PlaywrightDispatcher } from './server/playwrightDispatcher';
import { setUseApiName } from '../progress';
import { Connection } from './client/connection';
import { isUnderTest } from '../helper';
import { SignalHandler, Closeable } from './client/browserType';

type Signal = 'SIGINT' | 'SIGTERM' | 'SIGHUP';
const kSignals: Signal[] = ['SIGINT', 'SIGTERM', 'SIGHUP'];

class ProcessSignalHandler implements SignalHandler {
  private _closeables = new Map<Closeable, Signal[]>();
  private _listeners = new Map<Signal, (...args: any[]) => void>();
  private _sigintTimer?: NodeJS.Timeout;

  registerCloseable(closeable: Closeable, options: { handleSIGINT?: boolean, handleSIGHUP?: boolean, handleSIGTERM?: boolean }): void {
    const {
      handleSIGINT = true,
      handleSIGHUP = true,
      handleSIGTERM = true,
    } = options;
    const signals: Signal[] = [];
    if (handleSIGINT)
      signals.push('SIGINT');
    if (handleSIGHUP)
      signals.push('SIGHUP');
    if (handleSIGTERM)
      signals.push('SIGTERM');
    this._closeables.set(closeable, signals);
    this._updateListeners();
  }

  unregisterCloseable(closeable: Closeable): void {
    this._closeables.delete(closeable);
    this._updateListeners();
  }

  private _updateListeners() {
    for (const signal of kSignals) {
      const needListener = Array.from(this._closeables.values()).find(signals => signals.includes(signal));
      let listener = this._listeners.get(signal);
      if (listener && !needListener) {
        this._listeners.delete(signal);
        process.removeListener(signal as any, listener);
      } else if (needListener && !listener) {
        listener = () => this._handleSignal(signal);
        this._listeners.set(signal, listener);
        process.addListener(signal, listener);
      }
    }
  }

  private async _handleSignal(signal: Signal) {
    if (signal === 'SIGINT') {
      // Force exit after 30 seconds.
      this._sigintTimer = setTimeout(() => process.exit(130), 30000);
    }

    // Meanwhile, try to gracefully close all browsers
    // that handle this particular signal.
    const closeables = Array.from(this._closeables.keys()).filter(c => this._closeables.get(c)!.includes(signal));
    await Promise.all(closeables.map(c => c.close())).catch(e => null);

    // Avoid stalling just because of a timer.
    if (this._sigintTimer)
      clearTimeout(this._sigintTimer);

    if (signal === 'SIGINT') {
      // Give tests a chance to dispatch any async calls.
      if (isUnderTest())
        setTimeout(() => process.exit(130), 0);
      else
        process.exit(130);
    }
  }
}

export function setupInProcess(playwright: PlaywrightImpl): PlaywrightAPI {
  setUseApiName(false);

  const clientConnection = new Connection();
  const dispatcherConnection = new DispatcherConnection();

  // Dispatch synchronously at first.
  dispatcherConnection.onmessage = message => clientConnection.dispatch(message);
  clientConnection.onmessage = message => dispatcherConnection.dispatch(message);

  // Initialize Playwright channel.
  new PlaywrightDispatcher(dispatcherConnection.rootDispatcher(), playwright);
  const playwrightAPI = clientConnection.getObjectWithKnownName('Playwright') as PlaywrightAPI;
  const signalHandler = new ProcessSignalHandler();
  playwrightAPI.chromium._signalHandler = signalHandler;
  playwrightAPI.firefox._signalHandler = signalHandler;
  playwrightAPI.webkit._signalHandler = signalHandler;
  if ((playwrightAPI as any).electron)
    (playwrightAPI as any).electron._signalHandler = signalHandler;

  // Switch to async dispatch after we got Playwright object.
  dispatcherConnection.onmessage = message => setImmediate(() => clientConnection.dispatch(message));
  clientConnection.onmessage = message => setImmediate(() => dispatcherConnection.dispatch(message));

  if (isUnderTest())
    (playwrightAPI as any)._toImpl = (x: any) => dispatcherConnection._dispatchers.get(x._guid)!._object;
  return playwrightAPI;
}
