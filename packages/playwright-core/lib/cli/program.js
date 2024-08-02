"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
Object.defineProperty(exports, "program", {
  enumerable: true,
  get: function () {
    return _utilsBundle.program;
  }
});
var _fs = _interopRequireDefault(require("fs"));
var _os = _interopRequireDefault(require("os"));
var _path = _interopRequireDefault(require("path"));
var _utilsBundle = require("../utilsBundle");
var _driver = require("./driver");
var _traceViewer = require("../server/trace/viewer/traceViewer");
var playwright = _interopRequireWildcard(require("../.."));
var _child_process = require("child_process");
var _utils = require("../utils");
var _server = require("../server");
var _errors = require("../client/errors");
function _getRequireWildcardCache(e) { if ("function" != typeof WeakMap) return null; var r = new WeakMap(), t = new WeakMap(); return (_getRequireWildcardCache = function (e) { return e ? t : r; })(e); }
function _interopRequireWildcard(e, r) { if (!r && e && e.__esModule) return e; if (null === e || "object" != typeof e && "function" != typeof e) return { default: e }; var t = _getRequireWildcardCache(r); if (t && t.has(e)) return t.get(e); var n = { __proto__: null }, a = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var u in e) if ("default" !== u && Object.prototype.hasOwnProperty.call(e, u)) { var i = a ? Object.getOwnPropertyDescriptor(e, u) : null; i && (i.get || i.set) ? Object.defineProperty(n, u, i) : n[u] = e[u]; } return n.default = e, t && t.set(e, n), n; }
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

/* eslint-disable no-console */

const packageJSON = require('../../package.json');
_utilsBundle.program.version('Version ' + (process.env.PW_CLI_DISPLAY_VERSION || packageJSON.version)).name(buildBasePlaywrightCLICommand(process.env.PW_LANG_NAME));
_utilsBundle.program.command('mark-docker-image [dockerImageNameTemplate]', {
  hidden: true
}).description('mark docker image').allowUnknownOption(true).action(function (dockerImageNameTemplate) {
  (0, _utils.assert)(dockerImageNameTemplate, 'dockerImageNameTemplate is required');
  (0, _server.writeDockerVersion)(dockerImageNameTemplate).catch(logErrorAndExit);
});
commandWithOpenOptions('open [url]', 'open page in browser specified via -b, --browser', []).action(function (url, options) {
  open(options, url, codegenId()).catch(logErrorAndExit);
}).addHelpText('afterAll', `
Examples:

  $ open
  $ open -b webkit https://example.com`);
commandWithOpenOptions('codegen [url]', 'open page and generate code for user actions', [['-o, --output <file name>', 'saves the generated script to a file'], ['--target <language>', `language to generate, one of javascript, playwright-test, python, python-async, python-pytest, csharp, csharp-mstest, csharp-nunit, java, java-junit`, codegenId()], ['--save-trace <filename>', 'record a trace for the session and save it to a file'], ['--test-id-attribute <attributeName>', 'use the specified attribute to generate data test ID selectors']]).action(function (url, options) {
  codegen(options, url).catch(logErrorAndExit);
}).addHelpText('afterAll', `
Examples:

  $ codegen
  $ codegen --target=python
  $ codegen -b webkit https://example.com`);
_utilsBundle.program.command('debug <app> [args...]', {
  hidden: true
}).description('run command in debug mode: disable timeout, open inspector').allowUnknownOption(true).action(function (app, options) {
  (0, _child_process.spawn)(app, options, {
    env: {
      ...process.env,
      PWDEBUG: '1'
    },
    stdio: 'inherit'
  });
}).addHelpText('afterAll', `
Examples:

  $ debug node test.js
  $ debug npm run test`);
function suggestedBrowsersToInstall() {
  return _server.registry.executables().filter(e => e.installType !== 'none' && e.type !== 'tool').map(e => e.name).join(', ');
}
function checkBrowsersToInstall(args) {
  const faultyArguments = [];
  const executables = [];
  for (const arg of args) {
    const executable = _server.registry.findExecutable(arg);
    if (!executable || executable.installType === 'none') faultyArguments.push(arg);else executables.push(executable);
  }
  if (faultyArguments.length) throw new Error(`Invalid installation targets: ${faultyArguments.map(name => `'${name}'`).join(', ')}. Expecting one of: ${suggestedBrowsersToInstall()}`);
  return executables;
}
_utilsBundle.program.command('install [browser...]').description('ensure browsers necessary for this version of Playwright are installed').option('--with-deps', 'install system dependencies for browsers').option('--dry-run', 'do not execute installation, only print information').option('--force', 'force reinstall of stable browser channels').action(async function (args, options) {
  if ((0, _utils.isLikelyNpxGlobal)()) {
    console.error((0, _utils.wrapInASCIIBox)([`WARNING: It looks like you are running 'npx playwright install' without first`, `installing your project's dependencies.`, ``, `To avoid unexpected behavior, please install your dependencies first, and`, `then run Playwright's install command:`, ``, `    npm install`, `    npx playwright install`, ``, `If your project does not yet depend on Playwright, first install the`, `applicable npm package (most commonly @playwright/test), and`, `then run Playwright's install command to download the browsers:`, ``, `    npm install @playwright/test`, `    npx playwright install`, ``].join('\n'), 1));
  }
  try {
    const hasNoArguments = !args.length;
    const executables = hasNoArguments ? _server.registry.defaultExecutables() : checkBrowsersToInstall(args);
    if (options.withDeps) await _server.registry.installDeps(executables, !!options.dryRun);
    if (options.dryRun) {
      for (const executable of executables) {
        var _executable$directory, _executable$downloadU;
        const version = executable.browserVersion ? `version ` + executable.browserVersion : '';
        console.log(`browser: ${executable.name}${version ? ' ' + version : ''}`);
        console.log(`  Install location:    ${(_executable$directory = executable.directory) !== null && _executable$directory !== void 0 ? _executable$directory : '<system>'}`);
        if ((_executable$downloadU = executable.downloadURLs) !== null && _executable$downloadU !== void 0 && _executable$downloadU.length) {
          const [url, ...fallbacks] = executable.downloadURLs;
          console.log(`  Download url:        ${url}`);
          for (let i = 0; i < fallbacks.length; ++i) console.log(`  Download fallback ${i + 1}: ${fallbacks[i]}`);
        }
        console.log(``);
      }
    } else {
      const forceReinstall = hasNoArguments ? false : !!options.force;
      await _server.registry.install(executables, forceReinstall);
      await _server.registry.validateHostRequirementsForExecutablesIfNeeded(executables, process.env.PW_LANG_NAME || 'javascript').catch(e => {
        e.name = 'Playwright Host validation warning';
        console.error(e);
      });
    }
  } catch (e) {
    console.log(`Failed to install browsers\n${e}`);
    (0, _utils.gracefullyProcessExitDoNotHang)(1);
  }
}).addHelpText('afterAll', `

Examples:
  - $ install
    Install default browsers.

  - $ install chrome firefox
    Install custom browsers, supports ${suggestedBrowsersToInstall()}.`);
_utilsBundle.program.command('uninstall').description('Removes browsers used by this installation of Playwright from the system (chromium, firefox, webkit, ffmpeg). This does not include branded channels.').option('--all', 'Removes all browsers used by any Playwright installation from the system.').action(async options => {
  delete process.env.PLAYWRIGHT_SKIP_BROWSER_GC;
  await _server.registry.uninstall(!!options.all).then(({
    numberOfBrowsersLeft
  }) => {
    if (!options.all && numberOfBrowsersLeft > 0) {
      console.log('Successfully uninstalled Playwright browsers for the current Playwright installation.');
      console.log(`There are still ${numberOfBrowsersLeft} browsers left, used by other Playwright installations.\nTo uninstall Playwright browsers for all installations, re-run with --all flag.`);
    }
  }).catch(logErrorAndExit);
});
_utilsBundle.program.command('install-deps [browser...]').description('install dependencies necessary to run browsers (will ask for sudo permissions)').option('--dry-run', 'Do not execute installation commands, only print them').action(async function (args, options) {
  try {
    if (!args.length) await _server.registry.installDeps(_server.registry.defaultExecutables(), !!options.dryRun);else await _server.registry.installDeps(checkBrowsersToInstall(args), !!options.dryRun);
  } catch (e) {
    console.log(`Failed to install browser dependencies\n${e}`);
    (0, _utils.gracefullyProcessExitDoNotHang)(1);
  }
}).addHelpText('afterAll', `
Examples:
  - $ install-deps
    Install dependencies for default browsers.

  - $ install-deps chrome firefox
    Install dependencies for specific browsers, supports ${suggestedBrowsersToInstall()}.`);
const browsers = [{
  alias: 'cr',
  name: 'Chromium',
  type: 'chromium'
}, {
  alias: 'ff',
  name: 'Firefox',
  type: 'firefox'
}, {
  alias: 'wk',
  name: 'WebKit',
  type: 'webkit'
}];
for (const {
  alias,
  name,
  type
} of browsers) {
  commandWithOpenOptions(`${alias} [url]`, `open page in ${name}`, []).action(function (url, options) {
    open({
      ...options,
      browser: type
    }, url, options.target).catch(logErrorAndExit);
  }).addHelpText('afterAll', `
Examples:

  $ ${alias} https://example.com`);
}
commandWithOpenOptions('screenshot <url> <filename>', 'capture a page screenshot', [['--wait-for-selector <selector>', 'wait for selector before taking a screenshot'], ['--wait-for-timeout <timeout>', 'wait for timeout in milliseconds before taking a screenshot'], ['--full-page', 'whether to take a full page screenshot (entire scrollable area)']]).action(function (url, filename, command) {
  screenshot(command, command, url, filename).catch(logErrorAndExit);
}).addHelpText('afterAll', `
Examples:

  $ screenshot -b webkit https://example.com example.png`);
commandWithOpenOptions('pdf <url> <filename>', 'save page as pdf', [['--wait-for-selector <selector>', 'wait for given selector before saving as pdf'], ['--wait-for-timeout <timeout>', 'wait for given timeout in milliseconds before saving as pdf']]).action(function (url, filename, options) {
  pdf(options, options, url, filename).catch(logErrorAndExit);
}).addHelpText('afterAll', `
Examples:

  $ pdf https://example.com example.pdf`);
_utilsBundle.program.command('run-driver', {
  hidden: true
}).action(function (options) {
  (0, _driver.runDriver)();
});
_utilsBundle.program.command('run-server', {
  hidden: true
}).option('--port <port>', 'Server port').option('--host <host>', 'Server host').option('--path <path>', 'Endpoint Path', '/').option('--max-clients <maxClients>', 'Maximum clients').option('--mode <mode>', 'Server mode, either "default" or "extension"').action(function (options) {
  (0, _driver.runServer)({
    port: options.port ? +options.port : undefined,
    host: options.host,
    path: options.path,
    maxConnections: options.maxClients ? +options.maxClients : Infinity,
    extension: options.mode === 'extension' || !!process.env.PW_EXTENSION_MODE
  }).catch(logErrorAndExit);
});
_utilsBundle.program.command('print-api-json', {
  hidden: true
}).action(function (options) {
  (0, _driver.printApiJson)();
});
_utilsBundle.program.command('launch-server', {
  hidden: true
}).requiredOption('--browser <browserName>', 'Browser name, one of "chromium", "firefox" or "webkit"').option('--config <path-to-config-file>', 'JSON file with launchServer options').action(function (options) {
  (0, _driver.launchBrowserServer)(options.browser, options.config);
});
_utilsBundle.program.command('show-trace [trace...]').option('-b, --browser <browserType>', 'browser to use, one of cr, chromium, ff, firefox, wk, webkit', 'chromium').option('-h, --host <host>', 'Host to serve trace on; specifying this option opens trace in a browser tab').option('-p, --port <port>', 'Port to serve trace on, 0 for any free port; specifying this option opens trace in a browser tab').option('--stdin', 'Accept trace URLs over stdin to update the viewer').description('show trace viewer').action(function (traces, options) {
  if (options.browser === 'cr') options.browser = 'chromium';
  if (options.browser === 'ff') options.browser = 'firefox';
  if (options.browser === 'wk') options.browser = 'webkit';
  const openOptions = {
    host: options.host,
    port: +options.port,
    isServer: !!options.stdin
  };
  if (options.port !== undefined || options.host !== undefined) (0, _traceViewer.runTraceInBrowser)(traces, openOptions).catch(logErrorAndExit);else (0, _traceViewer.runTraceViewerApp)(traces, options.browser, openOptions, true).catch(logErrorAndExit);
}).addHelpText('afterAll', `
Examples:

  $ show-trace https://example.com/trace.zip`);
async function launchContext(options, headless, executablePath) {
  validateOptions(options);
  const browserType = lookupBrowserType(options);
  const launchOptions = {
    headless,
    executablePath
  };
  if (options.channel) launchOptions.channel = options.channel;
  launchOptions.handleSIGINT = false;
  const contextOptions =
  // Copy the device descriptor since we have to compare and modify the options.
  options.device ? {
    ...playwright.devices[options.device]
  } : {};

  // In headful mode, use host device scale factor for things to look nice.
  // In headless, keep things the way it works in Playwright by default.
  // Assume high-dpi on MacOS. TODO: this is not perfect.
  if (!headless) contextOptions.deviceScaleFactor = _os.default.platform() === 'darwin' ? 2 : 1;

  // Work around the WebKit GTK scrolling issue.
  if (browserType.name() === 'webkit' && process.platform === 'linux') {
    delete contextOptions.hasTouch;
    delete contextOptions.isMobile;
  }
  if (contextOptions.isMobile && browserType.name() === 'firefox') contextOptions.isMobile = undefined;
  if (options.blockServiceWorkers) contextOptions.serviceWorkers = 'block';

  // Proxy

  if (options.proxyServer) {
    launchOptions.proxy = {
      server: options.proxyServer
    };
    if (options.proxyBypass) launchOptions.proxy.bypass = options.proxyBypass;
  }
  const browser = await browserType.launch(launchOptions);
  if (process.env.PWTEST_CLI_IS_UNDER_TEST) {
    process._didSetSourcesForTest = text => {
      process.stdout.write('\n-------------8<-------------\n');
      process.stdout.write(text);
      process.stdout.write('\n-------------8<-------------\n');
      const autoExitCondition = process.env.PWTEST_CLI_AUTO_EXIT_WHEN;
      if (autoExitCondition && text.includes(autoExitCondition)) Promise.all(context.pages().map(async p => p.close()));
    };
    // Make sure we exit abnormally when browser crashes.
    const logs = [];
    require('playwright-core/lib/utilsBundle').debug.log = (...args) => {
      const line = require('util').format(...args) + '\n';
      logs.push(line);
      process.stderr.write(line);
    };
    browser.on('disconnected', () => {
      const hasCrashLine = logs.some(line => line.includes('process did exit:') && !line.includes('process did exit: exitCode=0, signal=null'));
      if (hasCrashLine) {
        process.stderr.write('Detected browser crash.\n');
        (0, _utils.gracefullyProcessExitDoNotHang)(1);
      }
    });
  }

  // Viewport size
  if (options.viewportSize) {
    try {
      const [width, height] = options.viewportSize.split(',').map(n => parseInt(n, 10));
      contextOptions.viewport = {
        width,
        height
      };
    } catch (e) {
      throw new Error('Invalid viewport size format: use "width, height", for example --viewport-size=800,600');
    }
  }

  // Geolocation

  if (options.geolocation) {
    try {
      const [latitude, longitude] = options.geolocation.split(',').map(n => parseFloat(n.trim()));
      contextOptions.geolocation = {
        latitude,
        longitude
      };
    } catch (e) {
      throw new Error('Invalid geolocation format, should be "lat,long". For example --geolocation="37.819722,-122.478611"');
    }
    contextOptions.permissions = ['geolocation'];
  }

  // User agent

  if (options.userAgent) contextOptions.userAgent = options.userAgent;

  // Lang

  if (options.lang) contextOptions.locale = options.lang;

  // Color scheme

  if (options.colorScheme) contextOptions.colorScheme = options.colorScheme;

  // Timezone

  if (options.timezone) contextOptions.timezoneId = options.timezone;

  // Storage

  if (options.loadStorage) contextOptions.storageState = options.loadStorage;
  if (options.ignoreHttpsErrors) contextOptions.ignoreHTTPSErrors = true;

  // HAR

  if (options.saveHar) {
    contextOptions.recordHar = {
      path: _path.default.resolve(process.cwd(), options.saveHar),
      mode: 'minimal'
    };
    if (options.saveHarGlob) contextOptions.recordHar.urlFilter = options.saveHarGlob;
    contextOptions.serviceWorkers = 'block';
  }

  // Close app when the last window closes.

  const context = await browser.newContext(contextOptions);
  let closingBrowser = false;
  async function closeBrowser() {
    // We can come here multiple times. For example, saving storage creates
    // a temporary page and we call closeBrowser again when that page closes.
    if (closingBrowser) return;
    closingBrowser = true;
    if (options.saveTrace) await context.tracing.stop({
      path: options.saveTrace
    });
    if (options.saveStorage) await context.storageState({
      path: options.saveStorage
    }).catch(e => null);
    if (options.saveHar) await context.close();
    await browser.close();
  }
  context.on('page', page => {
    page.on('dialog', () => {}); // Prevent dialogs from being automatically dismissed.
    page.on('close', () => {
      const hasPage = browser.contexts().some(context => context.pages().length > 0);
      if (hasPage) return;
      // Avoid the error when the last page is closed because the browser has been closed.
      closeBrowser().catch(e => null);
    });
  });
  process.on('SIGINT', async () => {
    await closeBrowser();
    (0, _utils.gracefullyProcessExitDoNotHang)(130);
  });
  const timeout = options.timeout ? parseInt(options.timeout, 10) : 0;
  context.setDefaultTimeout(timeout);
  context.setDefaultNavigationTimeout(timeout);
  if (options.saveTrace) await context.tracing.start({
    screenshots: true,
    snapshots: true
  });

  // Omit options that we add automatically for presentation purpose.
  delete launchOptions.headless;
  delete launchOptions.executablePath;
  delete launchOptions.handleSIGINT;
  delete contextOptions.deviceScaleFactor;
  return {
    browser,
    browserName: browserType.name(),
    context,
    contextOptions,
    launchOptions
  };
}
async function openPage(context, url) {
  const page = await context.newPage();
  if (url) {
    if (_fs.default.existsSync(url)) url = 'file://' + _path.default.resolve(url);else if (!url.startsWith('http') && !url.startsWith('file://') && !url.startsWith('about:') && !url.startsWith('data:')) url = 'http://' + url;
    await page.goto(url).catch(error => {
      if (process.env.PWTEST_CLI_AUTO_EXIT_WHEN && (0, _errors.isTargetClosedError)(error)) {
        // Tests with PWTEST_CLI_AUTO_EXIT_WHEN might close page too fast, resulting
        // in a stray navigation aborted error. We should ignore it.
      } else {
        throw error;
      }
    });
  }
  return page;
}
async function open(options, url, language) {
  const {
    context,
    launchOptions,
    contextOptions
  } = await launchContext(options, !!process.env.PWTEST_CLI_HEADLESS, process.env.PWTEST_CLI_EXECUTABLE_PATH);
  await context._enableRecorder({
    language,
    launchOptions,
    contextOptions,
    device: options.device,
    saveStorage: options.saveStorage
  });
  await openPage(context, url);
}
async function codegen(options, url) {
  const {
    target: language,
    output: outputFile,
    testIdAttribute: testIdAttributeName
  } = options;
  const {
    context,
    launchOptions,
    contextOptions
  } = await launchContext(options, !!process.env.PWTEST_CLI_HEADLESS, process.env.PWTEST_CLI_EXECUTABLE_PATH);
  await context._enableRecorder({
    language,
    launchOptions,
    contextOptions,
    device: options.device,
    saveStorage: options.saveStorage,
    mode: 'recording',
    testIdAttributeName,
    outputFile: outputFile ? _path.default.resolve(outputFile) : undefined,
    handleSIGINT: false
  });
  await openPage(context, url);
}
async function waitForPage(page, captureOptions) {
  if (captureOptions.waitForSelector) {
    console.log(`Waiting for selector ${captureOptions.waitForSelector}...`);
    await page.waitForSelector(captureOptions.waitForSelector);
  }
  if (captureOptions.waitForTimeout) {
    console.log(`Waiting for timeout ${captureOptions.waitForTimeout}...`);
    await page.waitForTimeout(parseInt(captureOptions.waitForTimeout, 10));
  }
}
async function screenshot(options, captureOptions, url, path) {
  const {
    context
  } = await launchContext(options, true);
  console.log('Navigating to ' + url);
  const page = await openPage(context, url);
  await waitForPage(page, captureOptions);
  console.log('Capturing screenshot into ' + path);
  await page.screenshot({
    path,
    fullPage: !!captureOptions.fullPage
  });
  // launchContext takes care of closing the browser.
  await page.close();
}
async function pdf(options, captureOptions, url, path) {
  if (options.browser !== 'chromium') throw new Error('PDF creation is only working with Chromium');
  const {
    context
  } = await launchContext({
    ...options,
    browser: 'chromium'
  }, true);
  console.log('Navigating to ' + url);
  const page = await openPage(context, url);
  await waitForPage(page, captureOptions);
  console.log('Saving as pdf into ' + path);
  await page.pdf({
    path
  });
  // launchContext takes care of closing the browser.
  await page.close();
}
function lookupBrowserType(options) {
  let name = options.browser;
  if (options.device) {
    const device = playwright.devices[options.device];
    name = device.defaultBrowserType;
  }
  let browserType;
  switch (name) {
    case 'chromium':
      browserType = playwright.chromium;
      break;
    case 'webkit':
      browserType = playwright.webkit;
      break;
    case 'firefox':
      browserType = playwright.firefox;
      break;
    case 'cr':
      browserType = playwright.chromium;
      break;
    case 'wk':
      browserType = playwright.webkit;
      break;
    case 'ff':
      browserType = playwright.firefox;
      break;
  }
  if (browserType) return browserType;
  _utilsBundle.program.help();
}
function validateOptions(options) {
  if (options.device && !(options.device in playwright.devices)) {
    const lines = [`Device descriptor not found: '${options.device}', available devices are:`];
    for (const name in playwright.devices) lines.push(`  "${name}"`);
    throw new Error(lines.join('\n'));
  }
  if (options.colorScheme && !['light', 'dark'].includes(options.colorScheme)) throw new Error('Invalid color scheme, should be one of "light", "dark"');
}
function logErrorAndExit(e) {
  if (process.env.PWDEBUGIMPL) console.error(e);else console.error(e.name + ': ' + e.message);
  (0, _utils.gracefullyProcessExitDoNotHang)(1);
}
function codegenId() {
  return process.env.PW_LANG_NAME || 'playwright-test';
}
function commandWithOpenOptions(command, description, options) {
  let result = _utilsBundle.program.command(command).description(description);
  for (const option of options) result = result.option(option[0], ...option.slice(1));
  return result.option('-b, --browser <browserType>', 'browser to use, one of cr, chromium, ff, firefox, wk, webkit', 'chromium').option('--block-service-workers', 'block service workers').option('--channel <channel>', 'Chromium distribution channel, "chrome", "chrome-beta", "msedge-dev", etc').option('--color-scheme <scheme>', 'emulate preferred color scheme, "light" or "dark"').option('--device <deviceName>', 'emulate device, for example  "iPhone 11"').option('--geolocation <coordinates>', 'specify geolocation coordinates, for example "37.819722,-122.478611"').option('--ignore-https-errors', 'ignore https errors').option('--load-storage <filename>', 'load context storage state from the file, previously saved with --save-storage').option('--lang <language>', 'specify language / locale, for example "en-GB"').option('--proxy-server <proxy>', 'specify proxy server, for example "http://myproxy:3128" or "socks5://myproxy:8080"').option('--proxy-bypass <bypass>', 'comma-separated domains to bypass proxy, for example ".com,chromium.org,.domain.com"').option('--save-har <filename>', 'save HAR file with all network activity at the end').option('--save-har-glob <glob pattern>', 'filter entries in the HAR by matching url against this glob pattern').option('--save-storage <filename>', 'save context storage state at the end, for later use with --load-storage').option('--timezone <time zone>', 'time zone to emulate, for example "Europe/Rome"').option('--timeout <timeout>', 'timeout for Playwright actions in milliseconds, no timeout by default').option('--user-agent <ua string>', 'specify user agent string').option('--viewport-size <size>', 'specify browser viewport size in pixels, for example "1280, 720"');
}
function buildBasePlaywrightCLICommand(cliTargetLang) {
  switch (cliTargetLang) {
    case 'python':
      return `playwright`;
    case 'java':
      return `mvn exec:java -e -D exec.mainClass=com.microsoft.playwright.CLI -D exec.args="...options.."`;
    case 'csharp':
      return `pwsh bin/Debug/netX/playwright.ps1`;
    default:
      {
        const packageManagerCommand = (0, _utils.getPackageManagerExecCommand)();
        return `${packageManagerCommand} playwright`;
      }
  }
}