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

import * as path from 'path';
import * as program from 'commander';
import * as os from 'os';
import * as fs from 'fs';
import { installBrowsersWithProgressBar } from '../install/installer';

// TODO: we can import from '../..' instead, but that requires generating types
// before build, and currently type generator depends on the build.
import type { Browser, BrowserContext, Page, BrowserType } from '../client/api';
import type { Playwright } from '../client/playwright';
import type { BrowserContextOptions, LaunchOptions } from '../client/types';
const playwright = require('../inprocess') as Playwright;

program
    .version('Version ' + require('../../package.json').version)
    .option('-b, --browser <browserType>', 'browser to use, one of cr, chromium, ff, firefox, wk, webkit', 'chromium')
    .option('--color-scheme <scheme>', 'emulate preferred color scheme, "light" or "dark"')
    .option('--device <deviceName>', 'emulate device, for example  "iPhone 11"')
    .option('--geolocation <coordinates>', 'specify geolocation coordinates, for example "37.819722,-122.478611"')
    .option('--lang <language>', 'specify language / locale, for example "en-GB"')
    .option('--load-storage <filename>', 'load context storage state from the file, previously saved with --save-storage')
    .option('--proxy-server <proxy>', 'specify proxy server, for example "http://myproxy:3128" or "socks5://myproxy:8080"')
    .option('--save-storage <filename>', 'save context storage state at the end, for later use with --load-storage')
    .option('--timezone <time zone>', 'time zone to emulate, for example "Europe/Rome"')
    .option('--timeout <timeout>', 'timeout for Playwright actions in milliseconds', '10000')
    .option('--user-agent <ua string>', 'specify user agent string')
    .option('--viewport-size <size>', 'specify browser viewport size in pixels, for example "1280, 720"');

program
    .command('open [url]')
    .description('open page in browser specified via -b, --browser')
    .action(function(url, command) {
      open(command.parent, url);
    }).on('--help', function() {
      console.log('');
      console.log('Examples:');
      console.log('');
      console.log('  $ open');
      console.log('  $ -b webkit open https://example.com');
    });

const browsers = [
  { alias: 'cr', name: 'Chromium', type: 'chromium' },
  { alias: 'ff', name: 'Firefox', type: 'firefox' },
  { alias: 'wk', name: 'WebKit', type: 'webkit' },
];

for (const {alias, name, type} of browsers) {
  program
      .command(`${alias} [url]`)
      .description(`open page in ${name}`)
      .action(function(url, command) {
        open({ ...command.parent, browser: type }, url);
      }).on('--help', function() {
        console.log('');
        console.log('Examples:');
        console.log('');
        console.log(`  $ ${alias} https://example.com`);
      });
}

program
    .command('screenshot <url> <filename>')
    .description('capture a page screenshot')
    .option('--wait-for-selector <selector>', 'wait for selector before taking a screenshot')
    .option('--wait-for-timeout <timeout>', 'wait for timeout in milliseconds before taking a screenshot')
    .option('--full-page', 'whether to take a full page screenshot (entire scrollable area)')
    .action(function(url, filename, command) {
      screenshot(command.parent, command, url, filename);
    }).on('--help', function() {
      console.log('');
      console.log('Examples:');
      console.log('');
      console.log('  $ -b webkit screenshot https://example.com example.png');
    });

program
    .command('pdf <url> <filename>')
    .description('save page as pdf')
    .option('--wait-for-selector <selector>', 'wait for given selector before saving as pdf')
    .option('--wait-for-timeout <timeout>', 'wait for given timeout in milliseconds before saving as pdf')
    .action(function(url, filename, command) {
      pdf(command.parent, command, url, filename);
    }).on('--help', function() {
      console.log('');
      console.log('Examples:');
      console.log('');
      console.log('  $ pdf https://example.com example.pdf');
    });

program
    .command('install')
    .description('Ensure browsers necessary for this version of Playwright are installed')
    .action(function() {
      let browsersJsonDir = path.dirname(process.execPath);
      if (!fs.existsSync(path.join(browsersJsonDir, 'browsers.json'))) {
        browsersJsonDir = path.join(__dirname, '..', '..');
        if (!fs.existsSync(path.join(browsersJsonDir, 'browsers.json')))
          throw new Error('Failed to find browsers.json in ' + browsersJsonDir);
      }
      installBrowsersWithProgressBar(browsersJsonDir).catch((e: any) => {
        console.log(`Failed to install browsers\n${e}`);
        process.exit(1);
      });
    });

program.parse(process.argv);


type Options = {
  browser: string;
  colorScheme?: string;
  device?: string;
  geolocation?: string;
  lang?: string;
  loadStorage?: string;
  proxyServer?: string;
  saveStorage?: string;
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

async function launchContext(options: Options, headless: boolean): Promise<{ browser: Browser, browserName: string, launchOptions: LaunchOptions, contextOptions: BrowserContextOptions, context: BrowserContext }> {
  validateOptions(options);
  const browserType = lookupBrowserType(options);
  const launchOptions: LaunchOptions = { headless };
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

  // Close app when the last window closes.

  const context = await browser.newContext(contextOptions);

  let closingBrowser = false;
  async function closeBrowser() {
    // We can come here multiple times. For example, saving storage creates
    // a temporary page and we call closeBrowser again when that page closes.
    if (closingBrowser)
      return;
    closingBrowser = true;
    if (options.saveStorage)
      await context.storageState({ path: options.saveStorage }).catch(e => null);
    await browser.close();
  }

  context.on('page', page => {
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

  // Omit options that we add automatically for presentation purpose.
  delete launchOptions.headless;
  delete contextOptions.deviceScaleFactor;
  return { browser, browserName: browserType.name(), context, contextOptions, launchOptions };
}

async function openPage(context: BrowserContext, url: string | undefined): Promise<Page> {
  const page = await context.newPage();
  if (url) {
    if (fs.existsSync(url))
      url = 'file://' + path.resolve(url);
    else if (!url.startsWith('http') && !url.startsWith('file://') && !url.startsWith('about:'))
      url = 'http://' + url;
    await page.goto(url);
  }
  return page;
}

async function open(options: Options, url: string | undefined) {
  const { context } = await launchContext(options, false);
  await openPage(context, url);
  if (process.env.PWCLI_EXIT_FOR_TEST)
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
  switch (name) {
    case 'chromium': return playwright.chromium!;
    case 'webkit': return playwright.webkit!;
    case 'firefox': return playwright.firefox!;
    case 'cr': return playwright.chromium!;
    case 'wk': return playwright.webkit!;
    case 'ff': return playwright.firefox!;
  }
  program.help();
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
