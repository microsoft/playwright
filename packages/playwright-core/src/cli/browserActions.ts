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

import { playwright } from '../inprocess';
import { gracefullyProcessExitDoNotHang, ManualPromise } from '../utils';
import { debug, dotenv, program } from '../utilsBundle';

import type { Browser } from '../client/browser';
import type { BrowserContext } from '../client/browserContext';
import type { BrowserType } from '../client/browserType';
import type { Page } from '../client/page';
import type { BrowserContextOptions, LaunchOptions } from '../client/types';

export type Options = {
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

export type CaptureOptions = {
  waitForSelector?: string;
  waitForTimeout?: string;
  fullPage: boolean;
  paperFormat?: string;
};

async function launchContext(options: Options, extraOptions: LaunchOptions): Promise<{ browser: Browser, browserName: string, launchOptions: LaunchOptions, contextOptions: BrowserContextOptions, context: BrowserContext, closeBrowser: () => Promise<void> }> {
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
  return { browser, browserName: browserType.name(), context, contextOptions, launchOptions, closeBrowser };
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

export async function open(options: Options, url: string | undefined) {
  const { context } = await launchContext(options, { headless: !!process.env.PWTEST_CLI_HEADLESS, executablePath: process.env.PWTEST_CLI_EXECUTABLE_PATH });
  await context._exposeConsoleApi();
  await openPage(context, url);
}

export async function codegen(options: Options & { target: string, output?: string, testIdAttribute?: string }, url: string | undefined) {
  const { target: language, output: outputFile, testIdAttribute: testIdAttributeName } = options;
  const tracesDir = path.join(os.tmpdir(), `playwright-recorder-trace-${Date.now()}`);
  const { context, browser, launchOptions, contextOptions, closeBrowser } = await launchContext(options, {
    headless: !!process.env.PWTEST_CLI_HEADLESS,
    executablePath: process.env.PWTEST_CLI_EXECUTABLE_PATH,
    tracesDir,
  });
  const donePromise = new ManualPromise<void>();
  maybeSetupTestHooks(browser, closeBrowser, donePromise);
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
  donePromise.resolve();
}

async function maybeSetupTestHooks(browser: Browser, closeBrowser: () => Promise<void>, donePromise: Promise<void>) {
  if (!process.env.PWTEST_CLI_IS_UNDER_TEST)
    return;

  // Make sure we exit abnormally when browser crashes.
  const logs: string[] = [];
  debug.log = (...args: any[]) => {
    const line = require('util').format(...args) + '\n';
    logs.push(line);
    // eslint-disable-next-line no-restricted-properties
    process.stderr.write(line);
  };
  browser.on('disconnected', () => {
    const hasCrashLine = logs.some(line => line.includes('process did exit:') && !line.includes('process did exit: exitCode=0, signal=null'));
    if (hasCrashLine) {
      // eslint-disable-next-line no-restricted-properties
      process.stderr.write('Detected browser crash.\n');
      gracefullyProcessExitDoNotHang(1);
    }
  });

  const close = async () => {
    await donePromise;
    await closeBrowser();
  };

  if (process.env.PWTEST_CLI_EXIT_AFTER_TIMEOUT) {
    setTimeout(close, +process.env.PWTEST_CLI_EXIT_AFTER_TIMEOUT);
    return;
  }

  // Note: we cannot use SIGINT, as it is not available on Windows.
  let stdin = '';
  process.stdin.on('data', data => {
    stdin += data.toString();
    if (stdin.startsWith('exit')) {
      process.stdin.destroy();
      close();
    }
  });
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

export async function screenshot(options: Options, captureOptions: CaptureOptions, url: string, path: string) {
  const { context } = await launchContext(options, { headless: true });
  console.log('Navigating to ' + url);
  const page = await openPage(context, url);
  await waitForPage(page, captureOptions);
  console.log('Capturing screenshot into ' + path);
  await page.screenshot({ path, fullPage: !!captureOptions.fullPage });
  // launchContext takes care of closing the browser.
  await page.close();
}

export async function pdf(options: Options, captureOptions: CaptureOptions, url: string, path: string) {
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
