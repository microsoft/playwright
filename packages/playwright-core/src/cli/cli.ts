#!/usr/bin/env node

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
import type { Command } from '../utilsBundle';
import { program } from '../utilsBundle';
import { runDriver, runServer, printApiJson, launchBrowserServer } from './driver';
import { showTraceViewer } from '../server/trace/viewer/traceViewer';
import * as playwright from '../..';
import type { BrowserContext } from '../client/browserContext';
import type { Browser } from '../client/browser';
import type { Page } from '../client/page';
import type { BrowserType } from '../client/browserType';
import type { BrowserContextOptions, LaunchOptions } from '../client/types';
import { spawn } from 'child_process';
import { getPlaywrightVersion } from '../common/userAgent';
import { wrapInASCIIBox, isLikelyNpxGlobal, assert } from '../utils';
import { spawnAsync } from '../utils/spawnAsync';
import { launchGridAgent } from '../grid/gridAgent';
import type { GridFactory } from '../grid/gridServer';
import { GridServer } from '../grid/gridServer';
import type { Executable } from '../server';
import { registry, writeDockerVersion } from '../server';

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
      open(options, url, language()).catch(logErrorAndExit);
    })
    .addHelpText('afterAll', `
Examples:

  $ open  $ open -b webkit https://example.com`);

commandWithOpenOptions('codegen [url]', 'open page and generate code for user actions',
    [
      ['-o, --output <file name>', 'saves the generated script to a file'],
      ['--target <language>', `language to generate, one of javascript, test, python, python-async, csharp`, language()],
    ]).action(function(url, options) {
  codegen(options, url, options.target, options.output).catch(logErrorAndExit);
}).addHelpText('afterAll', `
Examples:

  $ codegen
  $ codegen --target=python
  $ codegen -b webkit https://example.com`);

program
    .command('debug <app> [args...]', { hidden: true })
    .description('run command in debug mode: disable timeout, open inspector')
    .allowUnknownOption(true)
    .action(function(app, options) {
      spawn(app, options, {
        env: { ...process.env, PWDEBUG: '1' },
        stdio: 'inherit'
      });
    }).addHelpText('afterAll', `
Examples:

  $ debug node test.js
  $ debug npm run test`);

function suggestedBrowsersToInstall() {
  return registry.executables().filter(e => e.installType !== 'none' && e.type !== 'tool').map(e => e.name).join(', ');
}

function checkBrowsersToInstall(args: string[]): Executable[] {
  const faultyArguments: string[] = [];
  const executables: Executable[] = [];
  for (const arg of args) {
    const executable = registry.findExecutable(arg);
    if (!executable || executable.installType === 'none')
      faultyArguments.push(arg);
    else
      executables.push(executable);
  }
  if (faultyArguments.length) {
    console.log(`Invalid installation targets: ${faultyArguments.map(name => `'${name}'`).join(', ')}. Expecting one of: ${suggestedBrowsersToInstall()}`);
    process.exit(1);
  }
  return executables;
}

program
    .command('install [browser...]')
    .description('ensure browsers necessary for this version of Playwright are installed')
    .option('--with-deps', 'install system dependencies for browsers')
    .option('--force', 'force reinstall of stable browser channels')
    .action(async function(args: string[], options: { withDeps?: boolean, force?: boolean }) {
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
        if (!args.length) {
          const executables = registry.defaultExecutables();
          if (options.withDeps)
            await registry.installDeps(executables, false);
          await registry.install(executables, false /* forceReinstall */);
        } else {
          const installDockerImage = args.some(arg => arg === 'docker-image');
          args = args.filter(arg => arg !== 'docker-image');
          if (installDockerImage) {
            const imageName = `mcr.microsoft.com/playwright:v${getPlaywrightVersion()}-focal`;
            const { code } = await spawnAsync('docker', ['pull', imageName], { stdio: 'inherit' });
            if (code !== 0) {
              console.log('Failed to pull docker image');
              process.exit(1);
            }
          }

          const executables = checkBrowsersToInstall(args);
          if (options.withDeps)
            await registry.installDeps(executables, false);
          await registry.install(executables, !!options.force /* forceReinstall */);
        }
      } catch (e) {
        console.log(`Failed to install browsers\n${e}`);
        process.exit(1);
      }
    }).addHelpText('afterAll', `

Examples:
  - $ install
    Install default browsers.

  - $ install chrome firefox
    Install custom browsers, supports ${suggestedBrowsersToInstall()}.`);


program
    .command('install-deps [browser...]')
    .description('install dependencies necessary to run browsers (will ask for sudo permissions)')
    .option('--dry-run', 'Do not execute installation commands, only print them')
    .action(async function(args: string[], options: { dryRun?: boolean }) {
      try {
        if (!args.length)
          await registry.installDeps(registry.defaultExecutables(), !!options.dryRun);
        else
          await registry.installDeps(checkBrowsersToInstall(args), !!options.dryRun);
      } catch (e) {
        console.log(`Failed to install browser dependencies\n${e}`);
        process.exit(1);
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
        open({ ...options, browser: type }, url, options.target).catch(logErrorAndExit);
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
      ['--wait-for-selector <selector>', 'wait for given selector before saving as pdf'],
      ['--wait-for-timeout <timeout>', 'wait for given timeout in milliseconds before saving as pdf'],
    ]).action(function(url, filename, options) {
  pdf(options, options, url, filename).catch(logErrorAndExit);
}).addHelpText('afterAll', `
Examples:

  $ pdf https://example.com example.pdf`);

program
    .command('experimental-grid-server', { hidden: true })
    .option('--port <port>', 'grid port; defaults to 3333')
    .option('--address <address>', 'address of the server')
    .option('--agent-factory <factory>', 'path to grid agent factory or npm package')
    .option('--auth-token <authToken>', 'optional authentication token')
    .action(function(options) {
      launchGridServer(options.agentFactory, options.port || 3333, options.address, options.authToken);
    });

program
    .command('experimental-grid-agent', { hidden: true })
    .requiredOption('--agent-id <agentId>', 'agent ID')
    .requiredOption('--grid-url <gridURL>', 'grid URL')
    .option('--run-id <github run_id>', 'Workflow run_id')
    .action(function(options) {
      launchGridAgent(options.agentId, options.gridUrl, options.runId);
    });

program
    .command('run-driver', { hidden: true })
    .action(function(options) {
      runDriver();
    });

program
    .command('run-server', { hidden: true })
    .option('--port <port>', 'Server port')
    .option('--path <path>', 'Endpoint Path', '/')
    .option('--max-clients <maxClients>', 'Maximum clients')
    .option('--no-socks-proxy', 'Disable Socks Proxy')
    .action(function(options) {
      runServer(options.port ? +options.port : undefined,  options.path, options.maxClients ? +options.maxClients : Infinity, options.socksProxy).catch(logErrorAndExit);
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
    .description('Show trace viewer')
    .action(function(traces, options) {
      if (options.browser === 'cr')
        options.browser = 'chromium';
      if (options.browser === 'ff')
        options.browser = 'firefox';
      if (options.browser === 'wk')
        options.browser = 'webkit';
      showTraceViewer(traces, options.browser, false, 9322).catch(logErrorAndExit);
    }).addHelpText('afterAll', `
Examples:

  $ show-trace https://example.com/trace.zip`);

if (!process.env.PW_LANG_NAME) {
  let playwrightTestPackagePath = null;
  try {
    playwrightTestPackagePath = require.resolve('@playwright/test/lib/cli', {
      paths: [__dirname, process.cwd()]
    });
  } catch {}

  if (playwrightTestPackagePath) {
    require(playwrightTestPackagePath).addTestCommand(program);
    require(playwrightTestPackagePath).addShowReportCommand(program);
    require(playwrightTestPackagePath).addListFilesCommand(program);
  } else {
    {
      const command = program.command('test').allowUnknownOption(true);
      command.description('Run tests with Playwright Test. Available in @playwright/test package.');
      command.action(async () => {
        console.error('Please install @playwright/test package to use Playwright Test.');
        console.error('  npm install -D @playwright/test');
        process.exit(1);
      });
    }

    {
      const command = program.command('show-report').allowUnknownOption(true);
      command.description('Show Playwright Test HTML report. Available in @playwright/test package.');
      command.action(async () => {
        console.error('Please install @playwright/test package to use Playwright Test.');
        console.error('  npm install -D @playwright/test');
        process.exit(1);
      });
    }
  }
}

program.parse(process.argv);

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
  saveStorage?: string;
  saveTrace?: string;
  timeout: string;
  timezone?: string;
  viewportSize?: string;
  userAgent?: string;
};

type CaptureOptions = {
  waitForSelector?: string;
  waitForTimeout?: string;
  fullPage: boolean;
};

async function launchContext(options: Options, headless: boolean, executablePath?: string): Promise<{ browser: Browser, browserName: string, launchOptions: LaunchOptions, contextOptions: BrowserContextOptions, context: BrowserContext }> {
  validateOptions(options);
  const browserType = lookupBrowserType(options);
  const launchOptions: LaunchOptions = { headless, executablePath };
  if (options.channel)
    launchOptions.channel = options.channel as any;

  const contextOptions: BrowserContextOptions =
    // Copy the device descriptor since we have to compare and modify the options.
    options.device ? { ...playwright.devices[options.device] } : {};

  // In headful mode, use host device scale factor for things to look nice.
  // In headless, keep things the way it works in Playwright by default.
  // Assume high-dpi on MacOS. TODO: this is not perfect.
  if (!headless)
    contextOptions.deviceScaleFactor = os.platform() === 'darwin' ? 2 : 1;

  // Work around the WebKit GTK scrolling issue.
  if (browserType.name() === 'webkit' && process.platform === 'linux') {
    delete contextOptions.hasTouch;
    delete contextOptions.isMobile;
  }

  if (contextOptions.isMobile && browserType.name() === 'firefox')
    contextOptions.isMobile = undefined;

  // Proxy

  if (options.proxyServer) {
    launchOptions.proxy = {
      server: options.proxyServer
    };
    if (options.proxyBypass)
      launchOptions.proxy.bypass = options.proxyBypass;
  }

  const browser = await browserType.launch(launchOptions);

  // Viewport size
  if (options.viewportSize) {
    try {
      const [ width, height ] = options.viewportSize.split(',').map(n => parseInt(n, 10));
      contextOptions.viewport = { width, height };
    } catch (e) {
      console.log('Invalid window size format: use "width, height", for example --window-size=800,600');
      process.exit(0);
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
      console.log('Invalid geolocation format: user lat, long, for example --geolocation="37.819722,-122.478611"');
      process.exit(0);
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

  // Close app when the last window closes.

  const context = await browser.newContext(contextOptions);

  let closingBrowser = false;
  async function closeBrowser() {
    // We can come here multiple times. For example, saving storage creates
    // a temporary page and we call closeBrowser again when that page closes.
    if (closingBrowser)
      return;
    closingBrowser = true;
    if (options.saveTrace)
      await context.tracing.stop({ path: options.saveTrace });
    if (options.saveStorage)
      await context.storageState({ path: options.saveStorage }).catch(e => null);
    await browser.close();
  }

  context.on('page', page => {
    page.on('dialog', () => {});  // Prevent dialogs from being automatically dismissed.
    page.on('close', () => {
      const hasPage = browser.contexts().some(context => context.pages().length > 0);
      if (hasPage)
        return;
      // Avoid the error when the last page is closed because the browser has been closed.
      closeBrowser().catch(e => null);
    });
  });
  if (options.timeout) {
    context.setDefaultTimeout(parseInt(options.timeout, 10));
    context.setDefaultNavigationTimeout(parseInt(options.timeout, 10));
  }

  if (options.saveTrace)
    await context.tracing.start({ screenshots: true, snapshots: true });

  // Omit options that we add automatically for presentation purpose.
  delete launchOptions.headless;
  delete launchOptions.executablePath;
  delete contextOptions.deviceScaleFactor;
  return { browser, browserName: browserType.name(), context, contextOptions, launchOptions };
}

async function openPage(context: BrowserContext, url: string | undefined): Promise<Page> {
  const page = await context.newPage();
  if (url) {
    if (fs.existsSync(url))
      url = 'file://' + path.resolve(url);
    else if (!url.startsWith('http') && !url.startsWith('file://') && !url.startsWith('about:') && !url.startsWith('data:'))
      url = 'http://' + url;
    await page.goto(url);
  }
  return page;
}

async function open(options: Options, url: string | undefined, language: string) {
  const { context, launchOptions, contextOptions } = await launchContext(options, !!process.env.PWTEST_CLI_HEADLESS, process.env.PWTEST_CLI_EXECUTABLE_PATH);
  await context._enableRecorder({
    language,
    launchOptions,
    contextOptions,
    device: options.device,
    saveStorage: options.saveStorage,
  });
  await openPage(context, url);
  if (process.env.PWTEST_CLI_EXIT)
    await Promise.all(context.pages().map(p => p.close()));
}

async function codegen(options: Options, url: string | undefined, language: string, outputFile?: string) {
  const { context, launchOptions, contextOptions } = await launchContext(options, !!process.env.PWTEST_CLI_HEADLESS, process.env.PWTEST_CLI_EXECUTABLE_PATH);
  await context._enableRecorder({
    language,
    launchOptions,
    contextOptions,
    device: options.device,
    saveStorage: options.saveStorage,
    startRecording: true,
    outputFile: outputFile ? path.resolve(outputFile) : undefined
  });
  await openPage(context, url);
  if (process.env.PWTEST_CLI_EXIT)
    await Promise.all(context.pages().map(p => p.close()));
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
  const { browser, context } = await launchContext(options, true);
  console.log('Navigating to ' + url);
  const page = await openPage(context, url);
  await waitForPage(page, captureOptions);
  console.log('Capturing screenshot into ' + path);
  await page.screenshot({ path, fullPage: !!captureOptions.fullPage });
  await browser.close();
}

async function pdf(options: Options, captureOptions: CaptureOptions, url: string, path: string) {
  if (options.browser !== 'chromium') {
    console.error('PDF creation is only working with Chromium');
    process.exit(1);
  }
  const { browser, context } = await launchContext({ ...options, browser: 'chromium' }, true);
  console.log('Navigating to ' + url);
  const page = await openPage(context, url);
  await waitForPage(page, captureOptions);
  console.log('Saving as pdf into ' + path);
  await page.pdf!({ path });
  await browser.close();
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
  process.exit(1);
}

function validateOptions(options: Options) {
  if (options.device && !(options.device in playwright.devices)) {
    console.log(`Device descriptor not found: '${options.device}', available devices are:`);
    for (const name in playwright.devices)
      console.log(`  "${name}"`);
    process.exit(0);
  }
  if (options.colorScheme && !['light', 'dark'].includes(options.colorScheme)) {
    console.log('Invalid color scheme, should be one of "light", "dark"');
    process.exit(0);
  }
}

function logErrorAndExit(e: Error) {
  console.error(e);
  process.exit(1);
}

function language(): string {
  return process.env.PW_LANG_NAME || 'test';
}

function commandWithOpenOptions(command: string, description: string, options: any[][]): Command {
  let result = program.command(command).description(description);
  for (const option of options)
    result = result.option(option[0], ...option.slice(1));
  return result
      .option('-b, --browser <browserType>', 'browser to use, one of cr, chromium, ff, firefox, wk, webkit', 'chromium')
      .option('--channel <channel>', 'Chromium distribution channel, "chrome", "chrome-beta", "msedge-dev", etc')
      .option('--color-scheme <scheme>', 'emulate preferred color scheme, "light" or "dark"')
      .option('--device <deviceName>', 'emulate device, for example  "iPhone 11"')
      .option('--geolocation <coordinates>', 'specify geolocation coordinates, for example "37.819722,-122.478611"')
      .option('--ignore-https-errors', 'ignore https errors')
      .option('--load-storage <filename>', 'load context storage state from the file, previously saved with --save-storage')
      .option('--lang <language>', 'specify language / locale, for example "en-GB"')
      .option('--proxy-server <proxy>', 'specify proxy server, for example "http://myproxy:3128" or "socks5://myproxy:8080"')
      .option('--proxy-bypass <bypass>', 'comma-separated domains to bypass proxy, for example ".com,chromium.org,.domain.com"')
      .option('--save-storage <filename>', 'save context storage state at the end, for later use with --load-storage')
      .option('--save-trace <filename>', 'record a trace for the session and save it to a file')
      .option('--timezone <time zone>', 'time zone to emulate, for example "Europe/Rome"')
      .option('--timeout <timeout>', 'timeout for Playwright actions in milliseconds', '10000')
      .option('--user-agent <ua string>', 'specify user agent string')
      .option('--viewport-size <size>', 'specify browser viewport size in pixels, for example "1280, 720"');
}

async function launchGridServer(factoryPathOrPackageName: string, port: number, address: string | undefined, authToken: string | undefined): Promise<void> {
  if (!factoryPathOrPackageName)
    factoryPathOrPackageName = path.join('..', 'grid', 'simpleGridFactory');
  let factory;
  try {
    factory = require(path.resolve(factoryPathOrPackageName));
  } catch (e) {
    factory = require(factoryPathOrPackageName);
  }
  if (factory && typeof factory === 'object' && ('default' in factory))
    factory = factory['default'];
  if (!factory || !factory.launch || typeof factory.launch !== 'function')
    throw new Error('factory does not export `launch` method');
  factory.name = factory.name || factoryPathOrPackageName;
  const gridServer = new GridServer(factory as GridFactory, authToken, address);
  await gridServer.start(port);
  console.log('Grid server is running at ' + gridServer.gridURL());
}

function buildBasePlaywrightCLICommand(cliTargetLang: string | undefined): string {
  switch (cliTargetLang) {
    case 'python':
      return `playwright`;
    case 'java':
      return `mvn exec:java -e -Dexec.mainClass=com.microsoft.playwright.CLI -Dexec.args="...options.."`;
    case 'csharp':
      return `pwsh bin\\Debug\\netX\\playwright.ps1`;
    default:
      return `npx playwright`;
  }
}
