"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.WKWorkers = void 0;
var _eventsHelper = require("../../utils/eventsHelper");
var _page = require("../page");
var _wkConnection = require("./wkConnection");
var _wkExecutionContext = require("./wkExecutionContext");
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

class WKWorkers {
  constructor(page) {
    this._sessionListeners = [];
    this._page = void 0;
    this._workerSessions = new Map();
    this._page = page;
  }
  setSession(session) {
    _eventsHelper.eventsHelper.removeEventListeners(this._sessionListeners);
    this.clear();
    this._sessionListeners = [_eventsHelper.eventsHelper.addEventListener(session, 'Worker.workerCreated', event => {
      const worker = new _page.Worker(this._page, event.url);
      const workerSession = new _wkConnection.WKSession(session.connection, event.workerId, message => {
        session.send('Worker.sendMessageToWorker', {
          workerId: event.workerId,
          message: JSON.stringify(message)
        }).catch(e => {
          workerSession.dispatchMessage({
            id: message.id,
            error: {
              message: e.message
            }
          });
        });
      });
      this._workerSessions.set(event.workerId, workerSession);
      worker._createExecutionContext(new _wkExecutionContext.WKExecutionContext(workerSession, undefined));
      this._page._addWorker(event.workerId, worker);
      workerSession.on('Console.messageAdded', event => this._onConsoleMessage(worker, event));
      Promise.all([workerSession.send('Runtime.enable'), workerSession.send('Console.enable'), session.send('Worker.initialized', {
        workerId: event.workerId
      })]).catch(e => {
        // Worker can go as we are initializing it.
        this._page._removeWorker(event.workerId);
      });
    }), _eventsHelper.eventsHelper.addEventListener(session, 'Worker.dispatchMessageFromWorker', event => {
      const workerSession = this._workerSessions.get(event.workerId);
      if (!workerSession) return;
      workerSession.dispatchMessage(JSON.parse(event.message));
    }), _eventsHelper.eventsHelper.addEventListener(session, 'Worker.workerTerminated', event => {
      const workerSession = this._workerSessions.get(event.workerId);
      if (!workerSession) return;
      workerSession.dispose();
      this._workerSessions.delete(event.workerId);
      this._page._removeWorker(event.workerId);
    })];
  }
  clear() {
    this._page._clearWorkers();
    this._workerSessions.clear();
  }
  async initializeSession(session) {
    await session.send('Worker.enable');
  }
  async _onConsoleMessage(worker, event) {
    const {
      type,
      level,
      text,
      parameters,
      url,
      line: lineNumber,
      column: columnNumber
    } = event.message;
    let derivedType = type || '';
    if (type === 'log') derivedType = level;else if (type === 'timing') derivedType = 'timeEnd';
    const handles = (parameters || []).map(p => {
      return worker._existingExecutionContext.createHandle(p);
    });
    const location = {
      url: url || '',
      lineNumber: (lineNumber || 1) - 1,
      columnNumber: (columnNumber || 1) - 1
    };
    this._page._addConsoleMessage(derivedType, handles, location, handles.length ? undefined : text);
  }
}
exports.WKWorkers = WKWorkers;