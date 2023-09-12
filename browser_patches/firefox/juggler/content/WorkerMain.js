/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";
loadSubScript('chrome://juggler/content/content/Runtime.js');
loadSubScript('chrome://juggler/content/SimpleChannel.js');

// SimpleChannel in worker is never replaced: its lifetime matches the lifetime
// of the worker itself, so anything would work as a unique identifier.
const channel = new SimpleChannel('worker::content', 'unique_identifier');
const eventListener = event => channel._onMessage(JSON.parse(event.data));
this.addEventListener('message', eventListener);
channel.setTransport({
  sendMessage: msg => postMessage(JSON.stringify(msg)),
  dispose: () => this.removeEventListener('message', eventListener),
});

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
  constructor(runtime, channel) {
    this._runtime = runtime;
    this._browserRuntime = channel.connect('runtime');

    for (const context of this._runtime.executionContexts())
      this._onExecutionContextCreated(context);

    this._eventListeners = [
      this._runtime.events.onConsoleMessage(msg => this._browserRuntime.emit('runtimeConsole', msg)),
      this._runtime.events.onExecutionContextCreated(this._onExecutionContextCreated.bind(this)),
      this._runtime.events.onExecutionContextDestroyed(this._onExecutionContextDestroyed.bind(this)),
      channel.register('runtime', {
        evaluate: this._runtime.evaluate.bind(this._runtime),
        callFunction: this._runtime.callFunction.bind(this._runtime),
        getObjectProperties: this._runtime.getObjectProperties.bind(this._runtime),
        disposeObject: this._runtime.disposeObject.bind(this._runtime),
      }),
    ];
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

new RuntimeAgent(runtime, channel);

