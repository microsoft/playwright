"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.ProcessHost = void 0;
var _child_process = _interopRequireDefault(require("child_process"));
var _events = require("events");
var _utilsBundle = require("playwright-core/lib/utilsBundle");
var _esmUtils = require("../transform/esmUtils");
var _utils = require("playwright-core/lib/utils");
var _esmLoaderHost = require("../common/esmLoaderHost");
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
/**
 * Copyright Microsoft Corporation. All rights reserved.
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

class ProcessHost extends _events.EventEmitter {
  constructor(runnerScript, processName, env) {
    super();
    this.process = void 0;
    this._didSendStop = false;
    this._processDidExit = false;
    this._didExitAndRanOnExit = false;
    this._runnerScript = void 0;
    this._lastMessageId = 0;
    this._callbacks = new Map();
    this._processName = void 0;
    this._producedEnv = {};
    this._extraEnv = void 0;
    this._runnerScript = runnerScript;
    this._processName = processName;
    this._extraEnv = env;
  }
  async startRunner(runnerParams, options = {}) {
    var _this$process$stdout, _this$process$stderr;
    (0, _utils.assert)(!this.process, 'Internal error: starting the same process twice');
    this.process = _child_process.default.fork(require.resolve('../common/process'), {
      detached: false,
      env: {
        ...process.env,
        ...this._extraEnv,
        ...(_esmLoaderHost.esmLoaderRegistered ? {
          PW_TS_ESM_LOADER_ON: '1'
        } : {})
      },
      stdio: ['ignore', options.onStdOut ? 'pipe' : 'inherit', options.onStdErr && !process.env.PW_RUNNER_DEBUG ? 'pipe' : 'inherit', 'ipc'],
      ...(process.env.PW_TS_ESM_LEGACY_LOADER_ON ? {
        execArgv: (0, _esmUtils.execArgvWithExperimentalLoaderOptions)()
      } : {})
    });
    this.process.on('exit', async (code, signal) => {
      this._processDidExit = true;
      await this.onExit();
      this._didExitAndRanOnExit = true;
      this.emit('exit', {
        unexpectedly: !this._didSendStop,
        code,
        signal
      });
    });
    this.process.on('error', e => {}); // do not yell at a send to dead process.
    this.process.on('message', message => {
      if (_utilsBundle.debug.enabled('pw:test:protocol')) (0, _utilsBundle.debug)('pw:test:protocol')('◀ RECV ' + JSON.stringify(message));
      if (message.method === '__env_produced__') {
        const producedEnv = message.params;
        this._producedEnv = Object.fromEntries(producedEnv.map(e => {
          var _e$;
          return [e[0], (_e$ = e[1]) !== null && _e$ !== void 0 ? _e$ : undefined];
        }));
      } else if (message.method === '__dispatch__') {
        const {
          id,
          error,
          method,
          params,
          result
        } = message.params;
        if (id && this._callbacks.has(id)) {
          const {
            resolve,
            reject
          } = this._callbacks.get(id);
          this._callbacks.delete(id);
          if (error) {
            const errorObject = new Error(error.message);
            errorObject.stack = error.stack;
            reject(errorObject);
          } else {
            resolve(result);
          }
        } else {
          this.emit(method, params);
        }
      } else {
        this.emit(message.method, message.params);
      }
    });
    if (options.onStdOut) (_this$process$stdout = this.process.stdout) === null || _this$process$stdout === void 0 || _this$process$stdout.on('data', options.onStdOut);
    if (options.onStdErr) (_this$process$stderr = this.process.stderr) === null || _this$process$stderr === void 0 || _this$process$stderr.on('data', options.onStdErr);
    const error = await new Promise(resolve => {
      this.process.once('exit', (code, signal) => resolve({
        unexpectedly: true,
        code,
        signal
      }));
      this.once('ready', () => resolve(undefined));
    });
    if (error) return error;
    const processParams = {
      processName: this._processName
    };
    this.send({
      method: '__init__',
      params: {
        processParams,
        runnerScript: this._runnerScript,
        runnerParams
      }
    });
  }
  sendMessage(message) {
    const id = ++this._lastMessageId;
    this.send({
      method: '__dispatch__',
      params: {
        id,
        ...message
      }
    });
    return new Promise((resolve, reject) => {
      this._callbacks.set(id, {
        resolve,
        reject
      });
    });
  }
  sendMessageNoReply(message) {
    this.sendMessage(message).catch(() => {});
  }
  async onExit() {}
  async stop() {
    if (!this._processDidExit && !this._didSendStop) {
      this.send({
        method: '__stop__'
      });
      this._didSendStop = true;
    }
    if (!this._didExitAndRanOnExit) await new Promise(f => this.once('exit', f));
  }
  didSendStop() {
    return this._didSendStop;
  }
  producedEnv() {
    return this._producedEnv;
  }
  send(message) {
    var _this$process;
    if (_utilsBundle.debug.enabled('pw:test:protocol')) (0, _utilsBundle.debug)('pw:test:protocol')('SEND ► ' + JSON.stringify(message));
    (_this$process = this.process) === null || _this$process === void 0 || _this$process.send(message);
  }
}
exports.ProcessHost = ProcessHost;