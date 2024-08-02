"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.installRootRedirect = installRootRedirect;
exports.openTraceInBrowser = openTraceInBrowser;
exports.openTraceViewerApp = openTraceViewerApp;
exports.runTraceInBrowser = runTraceInBrowser;
exports.runTraceViewerApp = runTraceViewerApp;
exports.startTraceViewerServer = startTraceViewerServer;
var _path = _interopRequireDefault(require("path"));
var _fs = _interopRequireDefault(require("fs"));
var _httpServer = require("../../../utils/httpServer");
var _utils = require("../../../utils");
var _launchApp = require("../../launchApp");
var _instrumentation = require("../../instrumentation");
var _playwright = require("../../playwright");
var _progress = require("../../progress");
var _utilsBundle = require("../../../utilsBundle");
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
/**
 * Copyright (c) Microsoft Corporation.
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

function validateTraceUrls(traceUrls) {
  for (const traceUrl of traceUrls) {
    let traceFile = traceUrl;
    // If .json is requested, we'll synthesize it.
    if (traceUrl.endsWith('.json')) traceFile = traceUrl.substring(0, traceUrl.length - '.json'.length);
    if (!traceUrl.startsWith('http://') && !traceUrl.startsWith('https://') && !_fs.default.existsSync(traceFile) && !_fs.default.existsSync(traceFile + '.trace')) throw new Error(`Trace file ${traceUrl} does not exist!`);
  }
}
async function startTraceViewerServer(options) {
  const server = new _httpServer.HttpServer();
  server.routePrefix('/trace', (request, response) => {
    const url = new URL('http://localhost' + request.url);
    const relativePath = url.pathname.slice('/trace'.length);
    if (relativePath.endsWith('/stall.js')) return true;
    if (relativePath.startsWith('/file')) {
      try {
        const filePath = url.searchParams.get('path');
        if (_fs.default.existsSync(filePath)) return server.serveFile(request, response, url.searchParams.get('path'));

        // If .json is requested, we'll synthesize it for zip-less operation.
        if (filePath.endsWith('.json')) {
          const traceName = filePath.substring(0, filePath.length - '.json'.length);
          response.statusCode = 200;
          response.setHeader('Content-Type', 'application/json');
          response.end(JSON.stringify(traceDescriptor(traceName)));
          return true;
        }
      } catch (e) {}
      response.statusCode = 404;
      response.end();
      return true;
    }
    const absolutePath = _path.default.join(__dirname, '..', '..', '..', 'vite', 'traceViewer', ...relativePath.split('/'));
    return server.serveFile(request, response, absolutePath);
  });
  const transport = (options === null || options === void 0 ? void 0 : options.transport) || (options !== null && options !== void 0 && options.isServer ? new StdinServer() : undefined);
  if (transport) server.createWebSocket(transport);
  const {
    host,
    port
  } = options || {};
  await server.start({
    preferredPort: port,
    host
  });
  return server;
}
async function installRootRedirect(server, traceUrls, options) {
  const params = new URLSearchParams();
  for (const traceUrl of traceUrls) params.append('trace', traceUrl);
  if (server.wsGuid()) params.append('ws', server.wsGuid());
  if (options !== null && options !== void 0 && options.isServer) params.append('isServer', '');
  if ((0, _utils.isUnderTest)()) params.append('isUnderTest', 'true');
  for (const arg of options.args || []) params.append('arg', arg);
  if (options.grep) params.append('grep', options.grep);
  if (options.grepInvert) params.append('grepInvert', options.grepInvert);
  for (const project of options.project || []) params.append('project', project);
  if (options.workers) params.append('workers', String(options.workers));
  if (options.timeout) params.append('timeout', String(options.timeout));
  if (options.headed) params.append('headed', '');
  if (options.outputDir) params.append('outputDir', options.outputDir);
  for (const reporter of options.reporter || []) params.append('reporter', reporter);
  const urlPath = `./trace/${options.webApp || 'index.html'}?${params.toString()}`;
  server.routePath('/', (_, response) => {
    response.statusCode = 302;
    response.setHeader('Location', urlPath);
    response.end();
    return true;
  });
}
async function runTraceViewerApp(traceUrls, browserName, options, exitOnClose) {
  validateTraceUrls(traceUrls);
  const server = await startTraceViewerServer(options);
  await installRootRedirect(server, traceUrls, options);
  const page = await openTraceViewerApp(server.urlPrefix('precise'), browserName, options);
  if (exitOnClose) page.on('close', () => (0, _utils.gracefullyProcessExitDoNotHang)(0));
  return page;
}
async function runTraceInBrowser(traceUrls, options) {
  validateTraceUrls(traceUrls);
  const server = await startTraceViewerServer(options);
  await installRootRedirect(server, traceUrls, options);
  await openTraceInBrowser(server.urlPrefix('human-readable'));
}
async function openTraceViewerApp(url, browserName, options) {
  const traceViewerPlaywright = (0, _playwright.createPlaywright)({
    sdkLanguage: 'javascript',
    isInternalPlaywright: true
  });
  const traceViewerBrowser = (0, _utils.isUnderTest)() ? 'chromium' : browserName;
  const {
    context,
    page
  } = await (0, _launchApp.launchApp)(traceViewerPlaywright[traceViewerBrowser], {
    // TODO: store language in the trace.
    sdkLanguage: traceViewerPlaywright.options.sdkLanguage,
    windowSize: {
      width: 1280,
      height: 800
    },
    persistentContextOptions: {
      ...(options === null || options === void 0 ? void 0 : options.persistentContextOptions),
      useWebSocket: (0, _utils.isUnderTest)(),
      headless: !!(options !== null && options !== void 0 && options.headless)
    }
  });
  const controller = new _progress.ProgressController((0, _instrumentation.serverSideCallMetadata)(), context._browser);
  await controller.run(async progress => {
    await context._browser._defaultContext._loadDefaultContextAsIs(progress);
  });
  if (process.env.PWTEST_PRINT_WS_ENDPOINT) process.stderr.write('DevTools listening on: ' + context._browser.options.wsEndpoint + '\n');
  if (!(0, _utils.isUnderTest)()) await (0, _launchApp.syncLocalStorageWithSettings)(page, 'traceviewer');
  if ((0, _utils.isUnderTest)()) page.on('close', () => context.close({
    reason: 'Trace viewer closed'
  }).catch(() => {}));
  await page.mainFrame().goto((0, _instrumentation.serverSideCallMetadata)(), url);
  return page;
}
async function openTraceInBrowser(url) {
  // eslint-disable-next-line no-console
  console.log('\nListening on ' + url);
  if (!(0, _utils.isUnderTest)()) await (0, _utilsBundle.open)(url.replace('0.0.0.0', 'localhost')).catch(() => {});
}
class StdinServer {
  constructor() {
    this._pollTimer = void 0;
    this._traceUrl = void 0;
    this.sendEvent = void 0;
    this.close = void 0;
    process.stdin.on('data', data => {
      const url = data.toString().trim();
      if (url === this._traceUrl) return;
      if (url.endsWith('.json')) this._pollLoadTrace(url);else this._loadTrace(url);
    });
    process.stdin.on('close', () => (0, _utils.gracefullyProcessExitDoNotHang)(0));
  }
  async dispatch(method, params) {
    if (method === 'initialize') {
      if (this._traceUrl) this._loadTrace(this._traceUrl);
    }
  }
  onclose() {}
  _loadTrace(traceUrl) {
    var _this$sendEvent;
    this._traceUrl = traceUrl;
    clearTimeout(this._pollTimer);
    (_this$sendEvent = this.sendEvent) === null || _this$sendEvent === void 0 || _this$sendEvent.call(this, 'loadTraceRequested', {
      traceUrl
    });
  }
  _pollLoadTrace(url) {
    this._loadTrace(url);
    this._pollTimer = setTimeout(() => {
      this._pollLoadTrace(url);
    }, 500);
  }
}
function traceDescriptor(traceName) {
  const result = {
    entries: []
  };
  const traceDir = _path.default.dirname(traceName);
  const traceFile = _path.default.basename(traceName);
  for (const name of _fs.default.readdirSync(traceDir)) {
    if (name.startsWith(traceFile)) result.entries.push({
      name,
      path: _path.default.join(traceDir, name)
    });
  }
  const resourcesDir = _path.default.join(traceDir, 'resources');
  if (_fs.default.existsSync(resourcesDir)) {
    for (const name of _fs.default.readdirSync(resourcesDir)) result.entries.push({
      name: 'resources/' + name,
      path: _path.default.join(resourcesDir, name)
    });
  }
  return result;
}