"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.ProcessRunner = void 0;
var _utils = require("playwright-core/lib/utils");
var _util = require("../util");
var _esmLoaderHost = require("./esmLoaderHost");
var _esmUtils = require("../transform/esmUtils");
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

class ProcessRunner {
  async gracefullyClose() {}
  dispatchEvent(method, params) {
    const response = {
      method,
      params
    };
    sendMessageToParent({
      method: '__dispatch__',
      params: response
    });
  }
}
exports.ProcessRunner = ProcessRunner;
let gracefullyCloseCalled = false;
let forceExitInitiated = false;
sendMessageToParent({
  method: 'ready'
});
process.on('disconnect', () => gracefullyCloseAndExit(true));
process.on('SIGINT', () => {});
process.on('SIGTERM', () => {});

// Clear execArgv immediately, so that the user-code does not inherit our loader.
process.execArgv = (0, _esmUtils.execArgvWithoutExperimentalLoaderOptions)();

// Node.js >= 20
if (process.env.PW_TS_ESM_LOADER_ON) (0, _esmLoaderHost.registerESMLoader)();
let processRunner;
let processName;
const startingEnv = {
  ...process.env
};
process.on('message', async message => {
  if (message.method === '__init__') {
    const {
      processParams,
      runnerParams,
      runnerScript
    } = message.params;
    void (0, _utils.startProfiling)();
    const {
      create
    } = require(runnerScript);
    processRunner = create(runnerParams);
    processName = processParams.processName;
    return;
  }
  if (message.method === '__stop__') {
    const keys = new Set([...Object.keys(process.env), ...Object.keys(startingEnv)]);
    const producedEnv = [...keys].filter(key => startingEnv[key] !== process.env[key]).map(key => {
      var _process$env$key;
      return [key, (_process$env$key = process.env[key]) !== null && _process$env$key !== void 0 ? _process$env$key : null];
    });
    sendMessageToParent({
      method: '__env_produced__',
      params: producedEnv
    });
    await gracefullyCloseAndExit(false);
    return;
  }
  if (message.method === '__dispatch__') {
    const {
      id,
      method,
      params
    } = message.params;
    try {
      const result = await processRunner[method](params);
      const response = {
        id,
        result
      };
      sendMessageToParent({
        method: '__dispatch__',
        params: response
      });
    } catch (e) {
      const response = {
        id,
        error: (0, _util.serializeError)(e)
      };
      sendMessageToParent({
        method: '__dispatch__',
        params: response
      });
    }
  }
});
const kForceExitTimeout = +(process.env.PWTEST_FORCE_EXIT_TIMEOUT || 30000);
async function gracefullyCloseAndExit(forceExit) {
  if (forceExit && !forceExitInitiated) {
    forceExitInitiated = true;
    // Force exit after 30 seconds.
    // eslint-disable-next-line no-restricted-properties
    setTimeout(() => process.exit(0), kForceExitTimeout);
  }
  if (!gracefullyCloseCalled) {
    var _processRunner;
    gracefullyCloseCalled = true;
    // Meanwhile, try to gracefully shutdown.
    await ((_processRunner = processRunner) === null || _processRunner === void 0 ? void 0 : _processRunner.gracefullyClose().catch(() => {}));
    if (processName) await (0, _utils.stopProfiling)(processName).catch(() => {});
    // eslint-disable-next-line no-restricted-properties
    process.exit(0);
  }
}
function sendMessageToParent(message) {
  try {
    process.send(message);
  } catch (e) {
    // Can throw when closing.
  }
}