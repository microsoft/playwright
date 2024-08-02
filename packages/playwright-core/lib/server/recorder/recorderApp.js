"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.RecorderApp = exports.EmptyRecorderApp = void 0;
var _fs = _interopRequireDefault(require("fs"));
var _path = _interopRequireDefault(require("path"));
var _progress = require("../progress");
var _events = require("events");
var _instrumentation = require("../instrumentation");
var _utils = require("../../utils");
var _utilsBundle = require("../../utilsBundle");
var _launchApp = require("../launchApp");
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
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

class EmptyRecorderApp extends _events.EventEmitter {
  async close() {}
  async setPaused(paused) {}
  async setMode(mode) {}
  async setFileIfNeeded(file) {}
  async setSelector(selector, userGesture) {}
  async updateCallLogs(callLogs) {}
  async setSources(sources) {}
}
exports.EmptyRecorderApp = EmptyRecorderApp;
class RecorderApp extends _events.EventEmitter {
  constructor(recorder, page, wsEndpoint) {
    super();
    this._page = void 0;
    this.wsEndpoint = void 0;
    this._recorder = void 0;
    this.setMaxListeners(0);
    this._recorder = recorder;
    this._page = page;
    this.wsEndpoint = wsEndpoint;
  }
  async close() {
    await this._page.context().close({
      reason: 'Recorder window closed'
    });
  }
  async _init() {
    await (0, _launchApp.syncLocalStorageWithSettings)(this._page, 'recorder');
    await this._page._setServerRequestInterceptor(route => {
      if (!route.request().url().startsWith('https://playwright/')) return false;
      const uri = route.request().url().substring('https://playwright/'.length);
      const file = require.resolve('../../vite/recorder/' + uri);
      _fs.default.promises.readFile(file).then(buffer => {
        route.fulfill({
          requestUrl: route.request().url(),
          status: 200,
          headers: [{
            name: 'Content-Type',
            value: _utilsBundle.mime.getType(_path.default.extname(file)) || 'application/octet-stream'
          }],
          body: buffer.toString('base64'),
          isBase64: true
        }).catch(() => {});
      });
      return true;
    });
    await this._page.exposeBinding('dispatch', false, (_, data) => this.emit('event', data));
    this._page.once('close', () => {
      this.emit('close');
      this._page.context().close({
        reason: 'Recorder window closed'
      }).catch(() => {});
    });
    const mainFrame = this._page.mainFrame();
    await mainFrame.goto((0, _instrumentation.serverSideCallMetadata)(), 'https://playwright/index.html');
  }
  static async open(recorder, inspectedContext, handleSIGINT) {
    const sdkLanguage = inspectedContext.attribution.playwright.options.sdkLanguage;
    const headed = !!inspectedContext._browser.options.headful;
    const recorderPlaywright = require('../playwright').createPlaywright({
      sdkLanguage: 'javascript',
      isInternalPlaywright: true
    });
    const {
      context,
      page
    } = await (0, _launchApp.launchApp)(recorderPlaywright.chromium, {
      sdkLanguage,
      windowSize: {
        width: 600,
        height: 600
      },
      windowPosition: {
        x: 1020,
        y: 10
      },
      persistentContextOptions: {
        noDefaultViewport: true,
        headless: !!process.env.PWTEST_CLI_HEADLESS || (0, _utils.isUnderTest)() && !headed,
        useWebSocket: !!process.env.PWTEST_RECORDER_PORT,
        handleSIGINT,
        args: process.env.PWTEST_RECORDER_PORT ? [`--remote-debugging-port=${process.env.PWTEST_RECORDER_PORT}`] : []
      }
    });
    const controller = new _progress.ProgressController((0, _instrumentation.serverSideCallMetadata)(), context._browser);
    await controller.run(async progress => {
      await context._browser._defaultContext._loadDefaultContextAsIs(progress);
    });
    const result = new RecorderApp(recorder, page, context._browser.options.wsEndpoint);
    await result._init();
    return result;
  }
  async setMode(mode) {
    await this._page.mainFrame().evaluateExpression((mode => {
      window.playwrightSetMode(mode);
    }).toString(), {
      isFunction: true
    }, mode).catch(() => {});
  }
  async setFileIfNeeded(file) {
    await this._page.mainFrame().evaluateExpression((file => {
      window.playwrightSetFileIfNeeded(file);
    }).toString(), {
      isFunction: true
    }, file).catch(() => {});
  }
  async setPaused(paused) {
    await this._page.mainFrame().evaluateExpression((paused => {
      window.playwrightSetPaused(paused);
    }).toString(), {
      isFunction: true
    }, paused).catch(() => {});
  }
  async setSources(sources) {
    await this._page.mainFrame().evaluateExpression((sources => {
      window.playwrightSetSources(sources);
    }).toString(), {
      isFunction: true
    }, sources).catch(() => {});

    // Testing harness for runCLI mode.
    if (process.env.PWTEST_CLI_IS_UNDER_TEST && sources.length) process._didSetSourcesForTest(sources[0].text);
  }
  async setSelector(selector, userGesture) {
    if (userGesture) {
      if (this._recorder.mode() === 'inspecting') {
        this._recorder.setMode('standby');
        this._page.bringToFront();
      } else {
        this._recorder.setMode('recording');
      }
    }
    await this._page.mainFrame().evaluateExpression((data => {
      window.playwrightSetSelector(data.selector, data.userGesture);
    }).toString(), {
      isFunction: true
    }, {
      selector,
      userGesture
    }).catch(() => {});
  }
  async updateCallLogs(callLogs) {
    await this._page.mainFrame().evaluateExpression((callLogs => {
      window.playwrightUpdateLogs(callLogs);
    }).toString(), {
      isFunction: true
    }, callLogs).catch(() => {});
  }
}
exports.RecorderApp = RecorderApp;