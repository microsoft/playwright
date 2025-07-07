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

import { DispatcherConnection, PlaywrightDispatcher, RootDispatcher } from '../server';
import { AndroidDevice } from '../server/android/android';
import { Browser } from '../server/browser';
import { DebugControllerDispatcher } from '../server/dispatchers/debugControllerDispatcher';
import { startProfiling, stopProfiling } from '../server/utils/profiler';
import { monotonicTime, Semaphore } from '../utils';
import { debugLogger } from '../server/utils/debugLogger';
import { PlaywrightDispatcherOptions } from '../server/dispatchers/playwrightDispatcher';

import type { DispatcherScope, Playwright } from '../server';
import type { WebSocket } from '../utilsBundle';

export interface PlaywrightInitializeResult extends PlaywrightDispatcherOptions {
  dispose?(): Promise<void>;
}

export class PlaywrightConnection {
  private _ws: WebSocket;
  private _semaphore: Semaphore;
  private _dispatcherConnection: DispatcherConnection;
  private _cleanups: (() => Promise<void>)[] = [];
  private _id: string;
  private _disconnected = false;
  private _root: DispatcherScope;
  private _profileName: string;

  constructor(semaphore: Semaphore, ws: WebSocket, controller: boolean, playwright: Playwright, initialize: () => Promise<PlaywrightInitializeResult>, id: string) {
    this._ws = ws;
    this._semaphore = semaphore;
    this._id = id;
    this._profileName = new Date().toISOString();

    const lock = this._semaphore.acquire();

    this._dispatcherConnection = new DispatcherConnection();
    this._dispatcherConnection.onmessage = async message => {
      await lock;
      if (ws.readyState !== ws.CLOSING) {
        const messageString = JSON.stringify(message);
        if (debugLogger.isEnabled('server:channel'))
          debugLogger.log('server:channel', `[${this._id}] ${monotonicTime() * 1000} SEND ► ${messageString}`);
        if (debugLogger.isEnabled('server:metadata'))
          this.logServerMetadata(message, messageString, 'SEND');
        ws.send(messageString);
      }
    };
    ws.on('message', async (message: string) => {
      await lock;
      const messageString = Buffer.from(message).toString();
      const jsonMessage = JSON.parse(messageString);
      if (debugLogger.isEnabled('server:channel'))
        debugLogger.log('server:channel', `[${this._id}] ${monotonicTime() * 1000} ◀ RECV ${messageString}`);
      if (debugLogger.isEnabled('server:metadata'))
        this.logServerMetadata(jsonMessage, messageString, 'RECV');
      this._dispatcherConnection.dispatch(jsonMessage);
    });

    ws.on('close', () => this._onDisconnect());
    ws.on('error', (error: Error) => this._onDisconnect(error));

    if (controller) {
      debugLogger.log('server', `[${this._id}] engaged reuse controller mode`);
      this._root = new DebugControllerDispatcher(this._dispatcherConnection, playwright.debugController);
      return;
    }

    this._root = new RootDispatcher(this._dispatcherConnection, async (scope, params) => {
      await startProfiling();

      const options = await initialize();
      if (options.preLaunchedBrowser) {
        const browser = options.preLaunchedBrowser;
        browser.options.sdkLanguage = params.sdkLanguage;
        browser.on(Browser.Events.Disconnected, () => {
          // Underlying browser did close for some reason - force disconnect the client.
          this.close({ code: 1001, reason: 'Browser closed' });
        });
      }
      if (options.preLaunchedAndroidDevice) {
        const androidDevice = options.preLaunchedAndroidDevice;
        androidDevice.on(AndroidDevice.Events.Close, () => {
          // Underlying android device did close for some reason - force disconnect the client.
          this.close({ code: 1001, reason: 'Android device disconnected' });
        });
      }
      if (options.dispose)
        this._cleanups.push(options.dispose);

      const dispatcher = new PlaywrightDispatcher(scope, playwright, options);
      this._cleanups.push(() => dispatcher.cleanup());

      return dispatcher;
    });
  }

  private async _onDisconnect(error?: Error) {
    this._disconnected = true;
    debugLogger.log('server', `[${this._id}] disconnected. error: ${error}`);
    await this._root.stopPendingOperations(new Error('Disconnected')).catch(() => {});
    this._root._dispose();
    debugLogger.log('server', `[${this._id}] starting cleanup`);
    for (const cleanup of this._cleanups)
      await cleanup().catch(() => {});
    await stopProfiling(this._profileName);
    this._semaphore.release();
    debugLogger.log('server', `[${this._id}] finished cleanup`);
  }

  private logServerMetadata(message: object, messageString: string, direction: 'SEND' | 'RECV') {
    const serverLogMetadata = {
      wallTime: Date.now(),
      id: (message as any).id,
      guid: (message as any).guid,
      method: (message as any).method,
      payloadSizeInBytes: Buffer.byteLength(messageString, 'utf-8')
    };
    debugLogger.log('server:metadata', (direction === 'SEND' ? 'SEND ► ' : '◀ RECV ') + JSON.stringify(serverLogMetadata));
  }

  async close(reason?: { code: number, reason: string }) {
    if (this._disconnected)
      return;
    debugLogger.log('server', `[${this._id}] force closing connection: ${reason?.reason || ''} (${reason?.code || 0})`);
    try {
      this._ws.close(reason?.code, reason?.reason);
    } catch (e) {
    }
  }
}
