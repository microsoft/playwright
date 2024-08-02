"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.envArrayToObject = envArrayToObject;
exports.gracefullyCloseAll = gracefullyCloseAll;
exports.gracefullyCloseSet = void 0;
exports.gracefullyProcessExitDoNotHang = gracefullyProcessExitDoNotHang;
exports.launchProcess = launchProcess;
var _fs = _interopRequireDefault(require("fs"));
var childProcess = _interopRequireWildcard(require("child_process"));
var readline = _interopRequireWildcard(require("readline"));
var _ = require("./");
var _fileUtils = require("./fileUtils");
function _getRequireWildcardCache(e) { if ("function" != typeof WeakMap) return null; var r = new WeakMap(), t = new WeakMap(); return (_getRequireWildcardCache = function (e) { return e ? t : r; })(e); }
function _interopRequireWildcard(e, r) { if (!r && e && e.__esModule) return e; if (null === e || "object" != typeof e && "function" != typeof e) return { default: e }; var t = _getRequireWildcardCache(r); if (t && t.has(e)) return t.get(e); var n = { __proto__: null }, a = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var u in e) if ("default" !== u && Object.prototype.hasOwnProperty.call(e, u)) { var i = a ? Object.getOwnPropertyDescriptor(e, u) : null; i && (i.get || i.set) ? Object.defineProperty(n, u, i) : n[u] = e[u]; } return n.default = e, t && t.set(e, n), n; }
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
/**
 * Copyright 2017 Google Inc. All rights reserved.
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

const gracefullyCloseSet = exports.gracefullyCloseSet = new Set();
const killSet = new Set();
async function gracefullyCloseAll() {
  await Promise.all(Array.from(gracefullyCloseSet).map(gracefullyClose => gracefullyClose().catch(e => {})));
}
function gracefullyProcessExitDoNotHang(code) {
  // Force exit after 30 seconds.
  // eslint-disable-next-line no-restricted-properties
  setTimeout(() => process.exit(code), 30000);
  // Meanwhile, try to gracefully close all browsers.
  gracefullyCloseAll().then(() => {
    // eslint-disable-next-line no-restricted-properties
    process.exit(code);
  });
}
function exitHandler() {
  for (const kill of killSet) kill();
}
let sigintHandlerCalled = false;
function sigintHandler() {
  const exitWithCode130 = () => {
    // Give tests a chance to see that launched process did exit and dispatch any async calls.
    if ((0, _.isUnderTest)()) {
      // eslint-disable-next-line no-restricted-properties
      setTimeout(() => process.exit(130), 1000);
    } else {
      // eslint-disable-next-line no-restricted-properties
      process.exit(130);
    }
  };
  if (sigintHandlerCalled) {
    // Resort to default handler from this point on, just in case we hang/stall.
    process.off('SIGINT', sigintHandler);

    // Upon second Ctrl+C, immediately kill browsers and exit.
    // This prevents hanging in the case where closing the browser takes a lot of time or is buggy.
    for (const kill of killSet) kill();
    exitWithCode130();
  } else {
    sigintHandlerCalled = true;
    gracefullyCloseAll().then(() => exitWithCode130());
  }
}
function sigtermHandler() {
  gracefullyCloseAll();
}
function sighupHandler() {
  gracefullyCloseAll();
}
const installedHandlers = new Set();
const processHandlers = {
  exit: exitHandler,
  SIGINT: sigintHandler,
  SIGTERM: sigtermHandler,
  SIGHUP: sighupHandler
};
function addProcessHandlerIfNeeded(name) {
  if (!installedHandlers.has(name)) {
    installedHandlers.add(name);
    process.on(name, processHandlers[name]);
  }
}
function removeProcessHandlersIfNeeded() {
  if (killSet.size) return;
  for (const handler of installedHandlers) process.off(handler, processHandlers[handler]);
  installedHandlers.clear();
}
async function launchProcess(options) {
  const stdio = options.stdio === 'pipe' ? ['ignore', 'pipe', 'pipe', 'pipe', 'pipe'] : ['pipe', 'pipe', 'pipe'];
  options.log(`<launching> ${options.command} ${options.args ? options.args.join(' ') : ''}`);
  const spawnOptions = {
    // On non-windows platforms, `detached: true` makes child process a leader of a new
    // process group, making it possible to kill child process tree with `.kill(-pid)` command.
    // @see https://nodejs.org/api/child_process.html#child_process_options_detached
    detached: process.platform !== 'win32',
    env: options.env,
    cwd: options.cwd,
    shell: options.shell,
    stdio
  };
  const spawnedProcess = childProcess.spawn(options.command, options.args || [], spawnOptions);
  const cleanup = async () => {
    options.log(`[pid=${spawnedProcess.pid || 'N/A'}] starting temporary directories cleanup`);
    const errors = await (0, _fileUtils.removeFolders)(options.tempDirectories);
    for (let i = 0; i < options.tempDirectories.length; ++i) {
      if (errors[i]) options.log(`[pid=${spawnedProcess.pid || 'N/A'}] exception while removing ${options.tempDirectories[i]}: ${errors[i]}`);
    }
    options.log(`[pid=${spawnedProcess.pid || 'N/A'}] finished temporary directories cleanup`);
  };

  // Prevent Unhandled 'error' event.
  spawnedProcess.on('error', () => {});
  if (!spawnedProcess.pid) {
    let failed;
    const failedPromise = new Promise((f, r) => failed = f);
    spawnedProcess.once('error', error => {
      failed(new Error('Failed to launch: ' + error));
    });
    return cleanup().then(() => failedPromise).then(e => Promise.reject(e));
  }
  options.log(`<launched> pid=${spawnedProcess.pid}`);
  const stdout = readline.createInterface({
    input: spawnedProcess.stdout
  });
  stdout.on('line', data => {
    options.log(`[pid=${spawnedProcess.pid}][out] ` + data);
  });
  const stderr = readline.createInterface({
    input: spawnedProcess.stderr
  });
  stderr.on('line', data => {
    options.log(`[pid=${spawnedProcess.pid}][err] ` + data);
  });
  let processClosed = false;
  let fulfillCleanup = () => {};
  const waitForCleanup = new Promise(f => fulfillCleanup = f);
  spawnedProcess.once('exit', (exitCode, signal) => {
    options.log(`[pid=${spawnedProcess.pid}] <process did exit: exitCode=${exitCode}, signal=${signal}>`);
    processClosed = true;
    gracefullyCloseSet.delete(gracefullyClose);
    killSet.delete(killProcessAndCleanup);
    removeProcessHandlersIfNeeded();
    options.onExit(exitCode, signal);
    // Cleanup as process exits.
    cleanup().then(fulfillCleanup);
  });
  addProcessHandlerIfNeeded('exit');
  if (options.handleSIGINT) addProcessHandlerIfNeeded('SIGINT');
  if (options.handleSIGTERM) addProcessHandlerIfNeeded('SIGTERM');
  if (options.handleSIGHUP) addProcessHandlerIfNeeded('SIGHUP');
  gracefullyCloseSet.add(gracefullyClose);
  killSet.add(killProcessAndCleanup);
  let gracefullyClosing = false;
  async function gracefullyClose() {
    // We keep listeners until we are done, to handle 'exit' and 'SIGINT' while
    // asynchronously closing to prevent zombie processes. This might introduce
    // reentrancy to this function, for example user sends SIGINT second time.
    // In this case, let's forcefully kill the process.
    if (gracefullyClosing) {
      options.log(`[pid=${spawnedProcess.pid}] <forcefully close>`);
      killProcess();
      await waitForCleanup; // Ensure the process is dead and we have cleaned up.
      return;
    }
    gracefullyClosing = true;
    options.log(`[pid=${spawnedProcess.pid}] <gracefully close start>`);
    await options.attemptToGracefullyClose().catch(() => killProcess());
    await waitForCleanup; // Ensure the process is dead and we have cleaned up.
    options.log(`[pid=${spawnedProcess.pid}] <gracefully close end>`);
  }

  // This method has to be sync to be used in the 'exit' event handler.
  function killProcess() {
    gracefullyCloseSet.delete(gracefullyClose);
    killSet.delete(killProcessAndCleanup);
    removeProcessHandlersIfNeeded();
    options.log(`[pid=${spawnedProcess.pid}] <kill>`);
    if (spawnedProcess.pid && !spawnedProcess.killed && !processClosed) {
      options.log(`[pid=${spawnedProcess.pid}] <will force kill>`);
      // Force kill the browser.
      try {
        if (process.platform === 'win32') {
          const taskkillProcess = childProcess.spawnSync(`taskkill /pid ${spawnedProcess.pid} /T /F`, {
            shell: true
          });
          const [stdout, stderr] = [taskkillProcess.stdout.toString(), taskkillProcess.stderr.toString()];
          if (stdout) options.log(`[pid=${spawnedProcess.pid}] taskkill stdout: ${stdout}`);
          if (stderr) options.log(`[pid=${spawnedProcess.pid}] taskkill stderr: ${stderr}`);
        } else {
          process.kill(-spawnedProcess.pid, 'SIGKILL');
        }
      } catch (e) {
        options.log(`[pid=${spawnedProcess.pid}] exception while trying to kill process: ${e}`);
        // the process might have already stopped
      }
    } else {
      options.log(`[pid=${spawnedProcess.pid}] <skipped force kill spawnedProcess.killed=${spawnedProcess.killed} processClosed=${processClosed}>`);
    }
  }
  function killProcessAndCleanup() {
    killProcess();
    options.log(`[pid=${spawnedProcess.pid || 'N/A'}] starting temporary directories cleanup`);
    for (const dir of options.tempDirectories) {
      try {
        _fs.default.rmSync(dir, {
          force: true,
          recursive: true,
          maxRetries: 5
        });
      } catch (e) {
        options.log(`[pid=${spawnedProcess.pid || 'N/A'}] exception while removing ${dir}: ${e}`);
      }
    }
    options.log(`[pid=${spawnedProcess.pid || 'N/A'}] finished temporary directories cleanup`);
  }
  function killAndWait() {
    killProcess();
    return waitForCleanup;
  }
  return {
    launchedProcess: spawnedProcess,
    gracefullyClose,
    kill: killAndWait
  };
}
function envArrayToObject(env) {
  const result = {};
  for (const {
    name,
    value
  } of env) result[name] = value;
  return result;
}