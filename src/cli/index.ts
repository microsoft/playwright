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

import * as program from 'commander';
import { Playwright } from '../server/playwright';
import { BrowserType, LaunchOptions } from '../server/browserType';
import { DeviceDescriptors } from '../deviceDescriptors';
import { BrowserContextOptions } from '../browserContext';

const playwright = new Playwright(__dirname, require('../../browsers.json')['browsers']);

program
    .version('Version ' + require('../../package.json').version)
    .option('-b, --browser <browserType>', 'browser to use, one of cr, chromium, ff, firefox, wk, webkit', 'chromium')
    .option('--headless', 'run in headless mode', false)
    .option('--device <deviceName>', 'emulate device, for example  "iPhone 11"');

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
  { initial: 'cr', name: 'Chromium', type: 'chromium' },
  { initial: 'ff', name: 'Firefox', type: 'firefox' },
  { initial: 'wk', name: 'WebKit', type: 'webkit' },
];

for (const {initial, name, type} of browsers) {
  program
      .command(`${initial} [url]`)
      .description(`open page in ${name} browser`)
      .action(function(url, command) {
        open({ ...command.parent, browser: type }, url);
      }).on('--help', function() {
        console.log('');
        console.log('Examples:');
        console.log('');
        console.log(`  $ ${initial} https://example.com`);
      });
}

program.parse(process.argv);

type Options = {
  browser: string,
  device: string | undefined,
  verbose: boolean,
  headless: boolean,
};

async function open(options: Options, url: string | undefined) {
  const browserType = lookupBrowserType(options.browser);
  const launchOptions: LaunchOptions = { headless: options.headless };
  const browser = await browserType.launch(launchOptions);
  const contextOptions: BrowserContextOptions = options.device ? DeviceDescriptors[options.device] || {} : {};
  const page = await browser.newPage(contextOptions);
  if (url) {
    if (!url.startsWith('http'))
      url = 'http://' + url;
    await page.goto(url);
  }
  return { browser, page };
}

function lookupBrowserType(name: string): BrowserType {
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
