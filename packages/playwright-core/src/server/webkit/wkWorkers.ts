/**
 * Copyright 2019 Microsoft Corporation All rights reserved.
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

import { eventsHelper } from '../utils/eventsHelper';
import { Worker } from '../page';
import { WKSession } from './wkConnection';
import { createHandle, WKExecutionContext } from './wkExecutionContext';

import type { Protocol } from './protocol';
import type { RegisteredListener } from '../utils/eventsHelper';
import type { Page } from '../page';
import type * as types from '../types';

export class WKWorkers {
  private _sessionListeners: RegisteredListener[] = [];
  private _page: Page;
  private _workerSessions = new Map<string, WKSession>();

  constructor(page: Page) {
    this._page = page;
  }

  setSession(session: WKSession) {
    eventsHelper.removeEventListeners(this._sessionListeners);
    this.clear();
    this._sessionListeners = [
      eventsHelper.addEventListener(session, 'Worker.workerCreated', (event: Protocol.Worker.workerCreatedPayload) => {
        const worker = new Worker(this._page, event.url);
        const workerSession = new WKSession(session.connection, event.workerId, (message: any) => {
          session.send('Worker.sendMessageToWorker', {
            workerId: event.workerId,
            message: JSON.stringify(message)
          }).catch(e => {
            workerSession.dispatchMessage({ id: message.id, error: { message: e.message } });
          });
        });
        this._workerSessions.set(event.workerId, workerSession);
        worker.createExecutionContext(new WKExecutionContext(workerSession, undefined));
        this._page.addWorker(event.workerId, worker);
        workerSession.on('Console.messageAdded', event => this._onConsoleMessage(worker, event));
        Promise.all([
          workerSession.send('Runtime.enable'),
          workerSession.send('Console.enable'),
          session.send('Worker.initialized', { workerId: event.workerId })
        ]).catch(e => {
          // Worker can go as we are initializing it.
          this._page.removeWorker(event.workerId);
        });
      }),
      eventsHelper.addEventListener(session, 'Worker.dispatchMessageFromWorker', (event: Protocol.Worker.dispatchMessageFromWorkerPayload) => {
        const workerSession = this._workerSessions.get(event.workerId)!;
        if (!workerSession)
          return;
        workerSession.dispatchMessage(JSON.parse(event.message));
      }),
      eventsHelper.addEventListener(session, 'Worker.workerTerminated', (event: Protocol.Worker.workerTerminatedPayload) => {
        const workerSession = this._workerSessions.get(event.workerId)!;
        if (!workerSession)
          return;
        workerSession.dispose();
        this._workerSessions.delete(event.workerId);
        this._page.removeWorker(event.workerId);
      })
    ];
  }

  clear() {
    this._page.clearWorkers();
    this._workerSessions.clear();
  }

  async initializeSession(session: WKSession) {
    await session.send('Worker.enable');
  }

  async _onConsoleMessage(worker: Worker, event: Protocol.Console.messageAddedPayload) {
    const { type, level, text, parameters, url, line: lineNumber, column: columnNumber } = event.message;
    let derivedType: string = type || '';
    if (type === 'log')
      derivedType = level;
    else if (type === 'timing')
      derivedType = 'timeEnd';

    const handles = (parameters || []).map(p => {
      return createHandle(worker.existingExecutionContext!, p);
    });
    const location: types.ConsoleMessageLocation = {
      url: url || '',
      lineNumber: (lineNumber || 1) - 1,
      columnNumber: (columnNumber || 1) - 1
    };
    this._page.addConsoleMessage(derivedType, handles, location, handles.length ? undefined : text);
  }
}
