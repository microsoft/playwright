/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";
loadSubScript('chrome://juggler/content/content/Runtime.js');
loadSubScript('chrome://juggler/content/SimpleChannel.js');

const runtimeAgents = new Map();

const channel = new SimpleChannel('worker::worker');
const eventListener = event => channel._onMessage(JSON.parse(event.data));
this.addEventListener('message', eventListener);
channel.transport = {
  sendMessage: msg => postMessage(JSON.stringify(msg)),
  dispose: () => this.removeEventListener('message', eventListener),
};

const runtime = new Runtime(true /* isWorker */);

(() => {
  // Create execution context in the runtime only when the script
  // source was actually evaluated in it.
  const dbg = new Debugger(global);
  if (dbg.findScripts({global}).length) {
    runtime.createExecutionContext(null /* domWindow */, global, {});
  } else {
    dbg.onNewScript = function(s) {
      dbg.onNewScript = undefined;
      dbg.removeAllDebuggees();
      runtime.createExecutionContext(null /* domWindow */, global, {});
    };
  }
})();

class RuntimeAgent {
  constructor(runtime, channel, sessionId) {
    this._runtime = runtime;
    this._browserRuntime = channel.connect(sessionId + 'runtime');
    this._eventListeners = [
      channel.register(sessionId + 'runtime', {
        evaluate: this._runtime.evaluate.bind(this._runtime),
        callFunction: this._runtime.callFunction.bind(this._runtime),
        getObjectProperties: this._runtime.getObjectProperties.bind(this._runtime),
        disposeObject: this._runtime.disposeObject.bind(this._runtime),
      }),
      this._runtime.events.onConsoleMessage(msg => this._browserRuntime.emit('runtimeConsole', msg)),
      this._runtime.events.onExecutionContextCreated(this._onExecutionContextCreated.bind(this)),
      this._runtime.events.onExecutionContextDestroyed(this._onExecutionContextDestroyed.bind(this)),
    ];
    for (const context of this._runtime.executionContexts())
      this._onExecutionContextCreated(context);
  }

  _onExecutionContextCreated(executionContext) {
    this._browserRuntime.emit('runtimeExecutionContextCreated', {
      executionContextId: executionContext.id(),
      auxData: executionContext.auxData(),
    });
  }

  _onExecutionContextDestroyed(executionContext) {
    this._browserRuntime.emit('runtimeExecutionContextDestroyed', {
      executionContextId: executionContext.id(),
    });
  }

  dispose() {
    for (const disposer of this._eventListeners)
      disposer();
    this._eventListeners = [];
  }
}

channel.register('', {
  attach: ({sessionId}) => {
    const runtimeAgent = new RuntimeAgent(runtime, channel, sessionId);
    runtimeAgents.set(sessionId, runtimeAgent);
  },

  detach: ({sessionId}) => {
    const runtimeAgent = runtimeAgents.get(sessionId);
    runtimeAgents.delete(sessionId);
    runtimeAgent.dispose();
  },
});

