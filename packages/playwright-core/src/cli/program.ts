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

import fs from 'fs';
import os from 'os';
import path from 'path';

import * as playwright from '../..';
import { launchBrowserServer, printApiJson, runDriver, runServer } from './driver';
import { registry, writeDockerVersion } from '../server';
import { gracefullyProcessExitDoNotHang, isLikelyNpxGlobal } from '../utils';
import { runTraceInBrowser, runTraceViewerApp } from '../server/trace/viewer/traceViewer';
import { assert, getPackageManagerExecCommand } from '../utils';
import { wrapInASCIIBox } from '../server/utils/ascii';
import { dotenv, program } from '../utilsBundle';

import type { Browser } from '../client/browser';
import type { BrowserContext } from '../client/browserContext';
import type { BrowserType } from '../client/browserType';
import type { Page } from '../client/page';
import type { BrowserContextOptions, LaunchOptions } from '../client/types';
import type { Executable, BrowserInfo } from '../server';
import type { TraceViewerServerOptions } from '../server/trace/viewer/traceViewer';
import type { Command } from '../utilsBundle';

export { program } from '../utilsBundle';

const packageJSON = require('../../package.json');

program
    .version('Version ' + (process.env.PW_CLI_DISPLAY_VERSION || packageJSON.version))
    .name(buildBasePlaywrightCLICommand(process.env.PW_LANG_NAME));

program
    .command('mark-docker-image [dockerImageNameTemplate]', { hidden: true })
    .description('mark docker image')
    .allowUnknownOption(true)
    .action(function(dockerImageNameTemplate) {
      assert(dockerImageNameTemplate, 'dockerImageNameTemplate is required');
      writeDockerVersion(dockerImageNameTemplate).catch(logErrorAndExit);
    });

commandWithOpenOptions('open [url]', 'open page in browser specified via -b, --browser', [])
    .action(function(url, options) {
      open(options, url).catch(logErrorAndExit);
    })
    .addHelpText('afterAll', `
Examples:

  $ open
  $ open -b webkit https://example.com`);

commandWithOpenOptions('codegen [url]', 'open page and generate code for user actions',
    [
      ['-o, --output <file name>', 'saves the generated script to a file'],
      ['--target <language>', `language to generate, one of javascript, playwright-test, python, python-async, python-pytest, csharp, csharp-mstest, csharp-nunit, java, java-junit`, codegenId()],
      ['--test-id-attribute <attributeName>', 'use the specified attribute to generate data test ID selectors'],
    ]).action(function(url, options) {
  codegen(options, url).catch(error => {
    if (process.env.PWTEST_CLI_AUTO_EXIT_WHEN) {
      // Tests with PWTEST_CLI_AUTO_EXIT_WHEN might close page too fast, resulting
      // in a stray navigation aborted error. We should ignore it.
    } else {
      throw error;
    }
  });
}).addHelpText('afterAll', `
Examples:

  $ codegen
  $ codegen --target=python
  $ codegen -b webkit https://example.com`);

function suggestedBrowsersToInstall() {
  return registry.executables().filter(e => e.installType !== 'none' && e.type !== 'tool').map(e => e.name).join(', ');
}

function defaultBrowsersToInstall(options: { noShell?: boolean, onlyShell?: boolean }): Executable[] {
  let executables = registry.defaultExecutables();
  if (options.noShell)
    executables = executables.filter(e => e.name !== 'chromium-headless-shell');
  if (options.onlyShell)
    executables = executables.filter(e => e.name !== 'chromium');
  return executables;
}

function checkBrowsersToInstall(args: string[], options: { noShell?: boolean, onlyShell?: boolean }): Executable[] {
  if (options.noShell && options.onlyShell)
    throw new Error(`Only one of --no-shell and --only-shell can be specified`);

  const faultyArguments: string[] = [];
  const executables: Executable[] = [];
  const handleArgument = (arg: string) => {
    const executable = registry.findExecutable(arg);
    if (!executable || executable.installType === 'none')
      faultyArguments.push(arg);
    else
      executables.push(executable);
    if (executable?.browserName === 'chromium')
      executables.push(registry.findExecutable('ffmpeg')!);
  };

  for (const arg of args) {
    if (arg === 'chromium') {
      if (!options.onlyShell)
        handleArgument('chromium');
      if (!options.noShell)
        handleArgument('chromium-headless-shell');
    } else {
      handleArgument(arg);
    }
  }

  if (process.platform === 'win32')
    executables.push(registry.findExecutable('winldd')!);

  if (faultyArguments.length)
    throw new Error(`Invalid installation targets: ${faultyArguments.map(name => `'${name}'`).join(', ')}. Expecting one of: ${suggestedBrowsersToInstall()}`);
  return executables;
}

function printInstalledBrowsers(browsers: BrowserInfo[]) {
  const browserPaths = new Set<string>();
  for (const browser of browsers)
    browserPaths.add(browser.browserPath);
  console.log(`  Browsers:`);
  for (const browserPath of [...browserPaths].sort())
    console.log(`    ${browserPath}`);
  console.log(`  References:`);

  const references = new Set<string>();
  for (const browser of browsers)
    references.add(browser.referenceDir);
  for (const reference of [...references].sort())
    console.log(`    ${reference}`);
}

function printGroupedByPlaywrightVersion(browsers: BrowserInfo[]) {
  const dirToVersion = new Map<string, string>();
  for (const browser of browsers) {
    if (dirToVersion.has(browser.referenceDir))
      continue;
    const packageJSON = require(path.join(browser.referenceDir, 'package.json'));
    const version = packageJSON.version;
    dirToVersion.set(browser.referenceDir, version);
  }

  const groupedByPlaywrightMinorVersion = new Map<string, BrowserInfo[]>();
  for (const browser of browsers) {
    const version = dirToVersion.get(browser.referenceDir)!;
    let entries = groupedByPlaywrightMinorVersion.get(version);
    if (!entries) {
      entries = [];
      groupedByPlaywrightMinorVersion.set(version, entries);
    }
    entries.push(browser);
  }

  const sortedVersions = [...groupedByPlaywrightMinorVersion.keys()].sort((a, b) => {
    const aComponents = a.split('.');
    const bComponents = b.split('.');
    const aMajor = parseInt(aComponents[0], 10);
    const bMajor = parseInt(bComponents[0], 10);
    if (aMajor !== bMajor)
      return aMajor - bMajor;
    const aMinor = parseInt(aComponents[1], 10);
    const bMinor = parseInt(bComponents[1], 10);
    if (aMinor !== bMinor)
      return aMinor - bMinor;
    return aComponents.slice(2).join('.').localeCompare(bComponents.slice(2).join('.'));
  });

  for (const version of sortedVersions) {
    console.log(`\nPlaywright version: ${version}`);
    printInstalledBrowsers(groupedByPlaywrightMinorVersion.get(version)!);
  }
}

program
    .command('install [browser...]')
    .description('ensure browsers necessary for this version of Playwright are installed')
    .option('--with-deps', 'install system dependencies for browsers')
    .option('--dry-run', 'do not execute installation, only print information')
    .option('--list', 'prints list of browsers from all playwright installations')
    .option('--force', 'force reinstall of stable browser channels')
    .option('--only-shell', 'only install headless shell when installing chromium')
    .option('--no-shell', 'do not install chromium headless shell')
    .action(async function(args: string[], options: { withDeps?: boolean, force?: boolean, dryRun?: boolean, list?: boolean, shell?: boolean, noShell?: boolean, onlyShell?: boolean }) {
      // For '--no-shell' option, commander sets `shell: false` instead.
      if (options.shell === false)
        options.noShell = true;
      if (isLikelyNpxGlobal()) {
        console.error(wrapInASCIIBox([
          `WARNING: It looks like you are running 'npx playwright install' without first`,
          `installing your project's dependencies.`,
          ``,
          `To avoid unexpected behavior, please install your dependencies first, and`,
          `then run Playwright's install command:`,
          ``,
          `    npm install`,
          `    npx playwright install`,
          ``,
          `If your project does not yet depend on Playwright, first install the`,
          `applicable npm package (most commonly @playwright/test), and`,
          `then run Playwright's install command to download the browsers:`,
          ``,
          `    npm install @playwright/test`,
          `    npx playwright install`,
          ``,
        ].join('\n'), 1));
      }
      try {
        const hasNoArguments = !args.length;
        const executables = hasNoArguments ? defaultBrowsersToInstall(options) : checkBrowsersToInstall(args, options);
        if (options.withDeps)
          await registry.installDeps(executables, !!options.dryRun);
        if (options.dryRun && options.list)
          throw new Error(`Only one of --dry-run and --list can be specified`);
        if (options.dryRun) {
          for (const executable of executables) {
            const version = executable.browserVersion ? `version ` + executable.browserVersion : '';
            console.log(`browser: ${executable.name}${version ? ' ' + version : ''}`);
            console.log(`  Install location:    ${executable.directory ?? '<system>'}`);
            if (executable.downloadURLs?.length) {
              const [url, ...fallbacks] = executable.downloadURLs;
              console.log(`  Download url:        ${url}`);
              for (let i = 0; i < fallbacks.length; ++i)
                console.log(`  Download fallback ${i + 1}: ${fallbacks[i]}`);
            }
            console.log(``);
          }
        } else if (options.list) {
          const browsers = await registry.listInstalledBrowsers();
          printGroupedByPlaywrightVersion(browsers);
        } else {
          const forceReinstall = hasNoArguments ? false : !!options.force;
          await registry.install(executables, forceReinstall);
          await registry.validateHostRequirementsForExecutablesIfNeeded(executables, process.env.PW_LANG_NAME || 'javascript').catch((e: Error) => {
            e.name = 'Playwright Host validation warning';
            console.error(e);
          });
        }
      } catch (e) {
        console.log(`Failed to install browsers\n${e}`);
        gracefullyProcessExitDoNotHang(1);
      }
    }).addHelpText('afterAll', `

Examples:
  - $ install
    Install default browsers.

  - $ install chrome firefox
    Install custom browsers, supports ${suggestedBrowsersToInstall()}.`);

program
    .command('uninstall')
    .description('Removes browsers used by this installation of Playwright from the system (chromium, firefox, webkit, ffmpeg). This does not include branded channels.')
    .option('--all', 'Removes all browsers used by any Playwright installation from the system.')
    .action(async (options: { all?: boolean }) => {
      delete process.env.PLAYWRIGHT_SKIP_BROWSER_GC;
      await registry.uninstall(!!options.all).then(({ numberOfBrowsersLeft }) => {
        if (!options.all && numberOfBrowsersLeft > 0) {
          console.log('Successfully uninstalled Playwright browsers for the current Playwright installation.');
          console.log(`There are still ${numberOfBrowsersLeft} browsers left, used by other Playwright installations.\nTo uninstall Playwright browsers for all installations, re-run with --all flag.`);
        }
      }).catch(logErrorAndExit);
    });

program
    .command('install-deps [browser...]')
    .description('install dependencies necessary to run browsers (will ask for sudo permissions)')
    .option('--dry-run', 'Do not execute installation commands, only print them')
    .action(async function(args: string[], options: { dryRun?: boolean }) {
      try {
        if (!args.length)
          await registry.installDeps(defaultBrowsersToInstall({}), !!options.dryRun);
        else
          await registry.installDeps(checkBrowsersToInstall(args, {}), !!options.dryRun);
      } catch (e) {
        console.log(`Failed to install browser dependencies\n${e}`);
        gracefullyProcessExitDoNotHang(1);
      }
    }).addHelpText('afterAll', `
Examples:
  - $ install-deps
    Install dependencies for default browsers.

  - $ install-deps chrome firefox
    Install dependencies for specific browsers, supports ${suggestedBrowsersToInstall()}.`);

const browsers = [
  { alias: 'cr', name: 'Chromium', type: 'chromium' },
  { alias: 'ff', name: 'Firefox', type: 'firefox' },
  { alias: 'wk', name: 'WebKit', type: 'webkit' },
];

for (const { alias, name, type } of browsers) {
  commandWithOpenOptions(`${alias} [url]`, `open page in ${name}`, [])
      .action(function(url, options) {
        open({ ...options, browser: type }, url).catch(logErrorAndExit);
      }).addHelpText('afterAll', `
Examples:

  $ ${alias} https://example.com`);
}

commandWithOpenOptions('screenshot <url> <filename>', 'capture a page screenshot',
    [
      ['--wait-for-selector <selector>', 'wait for selector before taking a screenshot'],
      ['--wait-for-timeout <timeout>', 'wait for timeout in milliseconds before taking a screenshot'],
      ['--full-page', 'whether to take a full page screenshot (entire scrollable area)'],
    ]).action(function(url, filename, command) {
  screenshot(command, command, url, filename).catch(logErrorAndExit);
}).addHelpText('afterAll', `
Examples:

  $ screenshot -b webkit https://example.com example.png`);

commandWithOpenOptions('pdf <url> <filename>', 'save page as pdf',
    [
      ['--paper-format <format>', 'paper format: Letter, Legal, Tabloid, Ledger, A0, A1, A2, A3, A4, A5, A6'],
      ['--wait-for-selector <selector>', 'wait for given selector before saving as pdf'],
      ['--wait-for-timeout <timeout>', 'wait for given timeout in milliseconds before saving as pdf'],
    ]).action(function(url, filename, options) {
  pdf(options, options, url, filename).catch(logErrorAndExit);
}).addHelpText('afterAll', `
Examples:

  $ pdf https://example.com example.pdf`);

program
    .command('run-driver', { hidden: true })
    .action(function(options) {
      runDriver();
    });

program
    .command('run-server')
    .option('--port <port>', 'Server port')
    .option('--host <host>', 'Server host')
    .option('--path <path>', 'Endpoint Path', '/')
    .option('--max-clients <maxClients>', 'Maximum clients')
    .option('--mode <mode>', 'Server mode, either "default" or "extension"')
    .action(function(options) {
      runServer({
        port: options.port ? +options.port : undefined,
        host: options.host,
        path: options.path,
        maxConnections: options.maxClients ? +options.maxClients : Infinity,
        extension: options.mode === 'extension' || !!process.env.PW_EXTENSION_MODE,
      }).catch(logErrorAndExit);
    });

program
    .command('print-api-json', { hidden: true })
    .action(function(options) {
      printApiJson();
    });

program
    .command('launch-server', { hidden: true })
    .requiredOption('--browser <browserName>', 'Browser name, one of "chromium", "firefox" or "webkit"')
    .option('--config <path-to-config-file>', 'JSON file with launchServer options')
    .action(function(options) {
      launchBrowserServer(options.browser, options.config);
    });

program
    .command('show-trace [trace...]')
    .option('-b, --browser <browserType>', 'browser to use, one of cr, chromium, ff, firefox, wk, webkit', 'chromium')
    .option('-h, --host <host>', 'Host to serve trace on; specifying this option opens trace in a browser tab')
    .option('-p, --port <port>', 'Port to serve trace on, 0 for any free port; specifying this option opens trace in a browser tab')
    .option('--stdin', 'Accept trace URLs over stdin to update the viewer')
    .description('show trace viewer')
    .action(function(traces, options) {
      if (options.browser === 'cr')
        options.browser = 'chromium';
      if (options.browser === 'ff')
        options.browser = 'firefox';
      if (options.browser === 'wk')
        options.browser = 'webkit';

      const openOptions: TraceViewerServerOptions = {
        host: options.host,
        port: +options.port,
        isServer: !!options.stdin,
      };

      if (options.port !== undefined || options.host !== undefined)
        runTraceInBrowser(traces, openOptions).catch(logErrorAndExit);
      else
        runTraceViewerApp(traces, options.browser, openOptions, true).catch(logErrorAndExit);
    }).addHelpText('afterAll', `
Examples:

  $ show-trace https://example.com/trace.zip`);

type Options = {
  browser: string;
  channel?: string;
  colorScheme?: string;
  device?: string;
  geolocation?: string;
  ignoreHttpsErrors?: boolean;
  lang?: string;
  loadStorage?: string;
  proxyServer?: string;
  proxyBypass?: string;
  blockServiceWorkers?: boolean;
  saveHar?: string;
  saveHarGlob?: string;
  saveStorage?: string;
  timeout: string;
  timezone?: string;
  viewportSize?: string;
  userAgent?: string;
  userDataDir?: string;
};

type CaptureOptions = {
  waitForSelector?: string;
  waitForTimeout?: string;
  fullPage: boolean;
  paperFormat?: string;
};

async function launchContext(options: Options, extraOptions: LaunchOptions): Promise<{ browser: Browser, browserName: string, launchOptions: LaunchOptions, contextOptions: BrowserContextOptions, context: BrowserContext }> {
  validateOptions(options);
  const browserType = lookupBrowserType(options);
  const launchOptions: LaunchOptions = extraOptions;
  if (options.channel)
    launchOptions.channel = options.channel as any;
  launchOptions.handleSIGINT = false;

  const contextOptions: BrowserContextOptions =
    // Copy the device descriptor since we have to compare and modify the options.
    options.device ? { ...playwright.devices[options.device] } : {};

  // In headful mode, use host device scale factor for things to look nice.
  // In headless, keep things the way it works in Playwright by default.
  // Assume high-dpi on MacOS. TODO: this is not perfect.
  if (!extraOptions.headless)
    contextOptions.deviceScaleFactor = os.platform() === 'darwin' ? 2 : 1;

  // Work around the WebKit GTK scrolling issue.
  if (browserType.name() === 'webkit' && process.platform === 'linux') {
    delete contextOptions.hasTouch;
    delete contextOptions.isMobile;
  }

  if (contextOptions.isMobile && browserType.name() === 'firefox')
    contextOptions.isMobile = undefined;

  if (options.blockServiceWorkers)
    contextOptions.serviceWorkers = 'block';

  // Proxy

  if (options.proxyServer) {
    launchOptions.proxy = {
      server: options.proxyServer
    };
    if (options.proxyBypass)
      launchOptions.proxy.bypass = options.proxyBypass;
  }

  // Viewport size
  if (options.viewportSize) {
    try {
      const [width, height] = options.viewportSize.split(',').map(n => +n);
      if (isNaN(width) || isNaN(height))
        throw new Error('bad values');
      contextOptions.viewport = { width, height };
    } catch (e) {
      throw new Error('Invalid viewport size format: use "width,height", for example --viewport-size="800,600"');
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

  if (options.userAgent)
    contextOptions.userAgent = options.userAgent;

  // Lang

  if (options.lang)
    contextOptions.locale = options.lang;

  // Color scheme

  if (options.colorScheme)
    contextOptions.colorScheme = options.colorScheme as 'dark' | 'light';

  // Timezone

  if (options.timezone)
    contextOptions.timezoneId = options.timezone;

  // Storage

  if (options.loadStorage)
    contextOptions.storageState = options.loadStorage;

  if (options.ignoreHttpsErrors)
    contextOptions.ignoreHTTPSErrors = true;

  // HAR

  if (options.saveHar) {
    contextOptions.recordHar = { path: path.resolve(process.cwd(), options.saveHar), mode: 'minimal' };
    if (options.saveHarGlob)
      contextOptions.recordHar.urlFilter = options.saveHarGlob;
    contextOptions.serviceWorkers = 'block';
  }

  let browser: Browser;
  let context: BrowserContext;

  if (options.userDataDir) {
    context = await browserType.launchPersistentContext(options.userDataDir, { ...launchOptions, ...contextOptions });
    browser = context.browser()!;
  } else {
    browser = await browserType.launch(launchOptions);
    context = await browser.newContext(contextOptions);
  }

  if (process.env.PWTEST_CLI_IS_UNDER_TEST) {
    (process as any)._didSetSourcesForTest = (text: string) => {
      process.stdout.write('\n-------------8<-------------\n');
      process.stdout.write(text);
      process.stdout.write('\n-------------8<-------------\n');
      const autoExitCondition = process.env.PWTEST_CLI_AUTO_EXIT_WHEN;
      if (autoExitCondition && text.includes(autoExitCondition))
        closeBrowser();
    };
    // Make sure we exit abnormally when browser crashes.
    const logs: string[] = [];
    require('playwright-core/lib/utilsBundle').debug.log = (...args: any[]) => {
      const line = require('util').format(...args) + '\n';
      logs.push(line);
      process.stderr.write(line);
    };
    browser.on('disconnected', () => {
      const hasCrashLine = logs.some(line => line.includes('process did exit:') && !line.includes('process did exit: exitCode=0, signal=null'));
      if (hasCrashLine) {
        process.stderr.write('Detected browser crash.\n');
        gracefullyProcessExitDoNotHang(1);
      }
    });
  }

  let closingBrowser = false;
  async function closeBrowser() {
    // We can come here multiple times. For example, saving storage creates
    // a temporary page and we call closeBrowser again when that page closes.
    if (closingBrowser)
      return;
    closingBrowser = true;
    if (options.saveStorage)
      await context.storageState({ path: options.saveStorage }).catch(e => null);
    if (options.saveHar)
      await context.close();
    await browser.close();
  }

  context.on('page', page => {
    page.on('dialog', () => {});  // Prevent dialogs from being automatically dismissed.
    page.on('close', () => {
      const hasPage = browser.contexts().some(context => context.pages().length > 0);
      if (hasPage)
        return;
      // Avoid the error when the last page is closed because the browser has been closed.
      closeBrowser().catch(() => {});
    });
  });
  process.on('SIGINT', async () => {
    await closeBrowser();
    gracefullyProcessExitDoNotHang(130);
  });

  const timeout = options.timeout ? parseInt(options.timeout, 10) : 0;
  context.setDefaultTimeout(timeout);
  context.setDefaultNavigationTimeout(timeout);

  // Omit options that we add automatically for presentation purpose.
  delete launchOptions.headless;
  delete launchOptions.executablePath;
  delete launchOptions.handleSIGINT;
  delete contextOptions.deviceScaleFactor;
  return { browser, browserName: browserType.name(), context, contextOptions, launchOptions };
}

async function openPage(context: BrowserContext, url: string | undefined): Promise<Page> {
  let page = context.pages()[0];
  if (!page)
    page = await context.newPage();
  if (url) {
    if (fs.existsSync(url))
      url = 'file://' + path.resolve(url);
    else if (!url.startsWith('http') && !url.startsWith('file://') && !url.startsWith('about:') && !url.startsWith('data:'))
      url = 'http://' + url;
    await page.goto(url);
  }
  return page;
}

async function open(options: Options, url: string | undefined) {
  const { context } = await launchContext(options, { headless: !!process.env.PWTEST_CLI_HEADLESS, executablePath: process.env.PWTEST_CLI_EXECUTABLE_PATH });
  await openPage(context, url);
}

async function codegen(options: Options & { target: string, output?: string, testIdAttribute?: string }, url: string | undefined) {
  const { target: language, output: outputFile, testIdAttribute: testIdAttributeName } = options;
  const tracesDir = path.join(os.tmpdir(), `playwright-recorder-trace-${Date.now()}`);
  const { context, launchOptions, contextOptions } = await launchContext(options, {
    headless: !!process.env.PWTEST_CLI_HEADLESS,
    executablePath: process.env.PWTEST_CLI_EXECUTABLE_PATH,
    tracesDir,
  });
  dotenv.config({ path: 'playwright.env' });
  await context._enableRecorder({
    language,
    launchOptions,
    contextOptions,
    device: options.device,
    saveStorage: options.saveStorage,
    mode: 'recording',
    testIdAttributeName,
    outputFile: outputFile ? path.resolve(outputFile) : undefined,
    handleSIGINT: false,
  });
  await openPage(context, url);
}

async function waitForPage(page: Page, captureOptions: CaptureOptions) {
  if (captureOptions.waitForSelector) {
    console.log(`Waiting for selector ${captureOptions.waitForSelector}...`);
    await page.waitForSelector(captureOptions.waitForSelector);
  }
  if (captureOptions.waitForTimeout) {
    console.log(`Waiting for timeout ${captureOptions.waitForTimeout}...`);
    await page.waitForTimeout(parseInt(captureOptions.waitForTimeout, 10));
  }
}

async function screenshot(options: Options, captureOptions: CaptureOptions, url: string, path: string) {
  const { context } = await launchContext(options, { headless: true });
  console.log('Navigating to ' + url);
  const page = await openPage(context, url);
  await waitForPage(page, captureOptions);
  console.log('Capturing screenshot into ' + path);
  await page.screenshot({ path, fullPage: !!captureOptions.fullPage });
  // launchContext takes care of closing the browser.
  await page.close();
}

async function pdf(options: Options, captureOptions: CaptureOptions, url: string, path: string) {
  if (options.browser !== 'chromium')
    throw new Error('PDF creation is only working with Chromium');
  const { context } = await launchContext({ ...options, browser: 'chromium' }, { headless: true });
  console.log('Navigating to ' + url);
  const page = await openPage(context, url);
  await waitForPage(page, captureOptions);
  console.log('Saving as pdf into ' + path);
  await page.pdf!({ path, format: captureOptions.paperFormat });
  // launchContext takes care of closing the browser.
  await page.close();
}

function lookupBrowserType(options: Options): BrowserType {
  let name = options.browser;
  if (options.device) {
    const device = playwright.devices[options.device];
    name = device.defaultBrowserType;
  }
  let browserType: any;
  switch (name) {
    case 'chromium': browserType = playwright.chromium; break;
    case 'webkit': browserType = playwright.webkit; break;
    case 'firefox': browserType = playwright.firefox; break;
    case 'cr': browserType = playwright.chromium; break;
    case 'wk': browserType = playwright.webkit; break;
    case 'ff': browserType = playwright.firefox; break;
  }
  if (browserType)
    return browserType;
  program.help();
}

function validateOptions(options: Options) {
  if (options.device && !(options.device in playwright.devices)) {
    const lines = [`Device descriptor not found: '${options.device}', available devices are:`];
    for (const name in playwright.devices)
      lines.push(`  "${name}"`);
    throw new Error(lines.join('\n'));
  }
  if (options.colorScheme && !['light', 'dark'].includes(options.colorScheme))
    throw new Error('Invalid color scheme, should be one of "light", "dark"');
}

function logErrorAndExit(e: Error) {
  if (process.env.PWDEBUGIMPL)
    console.error(e);
  else
    console.error(e.name + ': ' + e.message);
  gracefullyProcessExitDoNotHang(1);
}

function codegenId(): string {
  return process.env.PW_LANG_NAME || 'playwright-test';
}

function commandWithOpenOptions(command: string, description: string, options: any[][]): Command {
  let result = program.command(command).description(description);
  for (const option of options)
    result = result.option(option[0], ...option.slice(1));
  return result
      .option('-b, --browser <browserType>', 'browser to use, one of cr, chromium, ff, firefox, wk, webkit', 'chromium')
      .option('--block-service-workers', 'block service workers')
      .option('--channel <channel>', 'Chromium distribution channel, "chrome", "chrome-beta", "msedge-dev", etc')
      .option('--color-scheme <scheme>', 'emulate preferred color scheme, "light" or "dark"')
      .option('--device <deviceName>', 'emulate device, for example  "iPhone 11"')
      .option('--geolocation <coordinates>', 'specify geolocation coordinates, for example "37.819722,-122.478611"')
      .option('--ignore-https-errors', 'ignore https errors')
      .option('--load-storage <filename>', 'load context storage state from the file, previously saved with --save-storage')
      .option('--lang <language>', 'specify language / locale, for example "en-GB"')
      .option('--proxy-server <proxy>', 'specify proxy server, for example "http://myproxy:3128" or "socks5://myproxy:8080"')
      .option('--proxy-bypass <bypass>', 'comma-separated domains to bypass proxy, for example ".com,chromium.org,.domain.com"')
      .option('--save-har <filename>', 'save HAR file with all network activity at the end')
      .option('--save-har-glob <glob pattern>', 'filter entries in the HAR by matching url against this glob pattern')
      .option('--save-storage <filename>', 'save context storage state at the end, for later use with --load-storage')
      .option('--timezone <time zone>', 'time zone to emulate, for example "Europe/Rome"')
      .option('--timeout <timeout>', 'timeout for Playwright actions in milliseconds, no timeout by default')
      .option('--user-agent <ua string>', 'specify user agent string')
      .option('--user-data-dir <directory>', 'use the specified user data directory instead of a new context')
      .option('--viewport-size <size>', 'specify browser viewport size in pixels, for example "1280, 720"');
}

function buildBasePlaywrightCLICommand(cliTargetLang: string | undefined): string {
  switch (cliTargetLang) {
    case 'python':
      return `playwright`;
    case 'java':
      return `mvn exec:java -e -D exec.mainClass=com.microsoft.playwright.CLI -D exec.args="...options.."`;
    case 'csharp':
      return `pwsh bin/Debug/netX/playwright.ps1`;
    default: {
      const packageManagerCommand = getPackageManagerExecCommand();
      return `${packageManagerCommand} playwright`;
    }
  }
}
