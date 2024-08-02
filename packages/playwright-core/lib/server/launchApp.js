"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.launchApp = launchApp;
exports.syncLocalStorageWithSettings = syncLocalStorageWithSettings;
var _fs = _interopRequireDefault(require("fs"));
var _path = _interopRequireDefault(require("path"));
var _registry = require("./registry");
var _utils = require("../utils");
var _instrumentation = require("./instrumentation");
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

async function launchApp(browserType, options) {
  var _options$persistentCo, _options$persistentCo2;
  const args = [...((_options$persistentCo = (_options$persistentCo2 = options.persistentContextOptions) === null || _options$persistentCo2 === void 0 ? void 0 : _options$persistentCo2.args) !== null && _options$persistentCo !== void 0 ? _options$persistentCo : [])];
  if (browserType.name() === 'chromium') {
    args.push('--app=data:text/html,', `--window-size=${options.windowSize.width},${options.windowSize.height}`, ...(options.windowPosition ? [`--window-position=${options.windowPosition.x},${options.windowPosition.y}`] : []), '--test-type=');
  }
  const context = await browserType.launchPersistentContext((0, _instrumentation.serverSideCallMetadata)(), '', {
    channel: (0, _registry.findChromiumChannel)(options.sdkLanguage),
    noDefaultViewport: true,
    ignoreDefaultArgs: ['--enable-automation'],
    colorScheme: 'no-override',
    acceptDownloads: (0, _utils.isUnderTest)() ? 'accept' : 'internal-browser-default',
    ...(options === null || options === void 0 ? void 0 : options.persistentContextOptions),
    args
  });
  const [page] = context.pages();
  // Chromium on macOS opens a new tab when clicking on the dock icon.
  // See https://github.com/microsoft/playwright/issues/9434
  if (browserType.name() === 'chromium' && process.platform === 'darwin') {
    context.on('page', async newPage => {
      if (newPage.mainFrame().url() === 'chrome://new-tab-page/') {
        await page.bringToFront();
        await newPage.close((0, _instrumentation.serverSideCallMetadata)());
      }
    });
  }
  if (browserType.name() === 'chromium') await installAppIcon(page);
  return {
    context,
    page
  };
}
async function installAppIcon(page) {
  const icon = await _fs.default.promises.readFile(require.resolve('./chromium/appIcon.png'));
  const crPage = page._delegate;
  await crPage._mainFrameSession._client.send('Browser.setDockTile', {
    image: icon.toString('base64')
  });
}
async function syncLocalStorageWithSettings(page, appName) {
  if ((0, _utils.isUnderTest)()) return;
  const settingsFile = _path.default.join(_registry.registryDirectory, '.settings', `${appName}.json`);
  await page.exposeBinding('_saveSerializedSettings', false, (_, settings) => {
    _fs.default.mkdirSync(_path.default.dirname(settingsFile), {
      recursive: true
    });
    _fs.default.writeFileSync(settingsFile, settings);
  });
  const settings = await _fs.default.promises.readFile(settingsFile, 'utf-8').catch(() => '{}');
  await page.addInitScript(`(${String(settings => {
    // iframes w/ snapshots, etc.
    if (location && location.protocol === 'data:') return;
    Object.entries(settings).map(([k, v]) => localStorage[k] = v);
    window.saveSettings = () => {
      window._saveSerializedSettings(JSON.stringify({
        ...localStorage
      }));
    };
  })})(${settings});
  `);
}