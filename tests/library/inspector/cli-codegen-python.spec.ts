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

import fs from 'fs';
import path from 'path';
import { test, expect } from './inspectorTest';

const emptyHTML = new URL('file://' + path.join(__dirname, '..', '..', 'assets', 'empty.html')).toString();
const launchOptions = (channel: string) => {
  return channel ? `channel="${channel}", headless=False` : 'headless=False';
};

test('should print the correct imports and context options', async ({ runCLI, channel, browserName }) => {
  const cli = runCLI(['--target=python', emptyHTML]);
  const expectedResult = `import re
from playwright.sync_api import Playwright, sync_playwright, expect


def run(playwright: Playwright) -> None:
    browser = playwright.${browserName}.launch(${launchOptions(channel)})
    context = browser.new_context()`;
  await cli.waitFor(expectedResult);
});

test('should print the correct context options for custom settings', async ({ runCLI, channel, browserName }) => {
  const cli = runCLI(['--color-scheme=light', '--target=python', emptyHTML]);
  const expectedResult = `import re
from playwright.sync_api import Playwright, sync_playwright, expect


def run(playwright: Playwright) -> None:
    browser = playwright.${browserName}.launch(${launchOptions(channel)})
    context = browser.new_context(color_scheme="light")`;
  await cli.waitFor(expectedResult);
});

test('should print the correct context options when using a device', async ({ browserName, channel, runCLI }) => {
  test.skip(browserName !== 'chromium');

  const cli = runCLI(['--device=Pixel 2', '--target=python', emptyHTML]);
  const expectedResult = `import re
from playwright.sync_api import Playwright, sync_playwright, expect


def run(playwright: Playwright) -> None:
    browser = playwright.chromium.launch(${launchOptions(channel)})
    context = browser.new_context(**playwright.devices["Pixel 2"])`;
  await cli.waitFor(expectedResult);
});

test('should print the correct context options when using a device and additional options', async ({ browserName, channel, runCLI }) => {
  test.skip(browserName !== 'webkit');

  const cli = runCLI(['--color-scheme=light', '--device=iPhone 11', '--target=python', emptyHTML]);
  const expectedResult = `import re
from playwright.sync_api import Playwright, sync_playwright, expect


def run(playwright: Playwright) -> None:
    browser = playwright.webkit.launch(${launchOptions(channel)})
    context = browser.new_context(**playwright.devices["iPhone 11"], color_scheme="light")`;
  await cli.waitFor(expectedResult);
});

test('should save the codegen output to a file if specified', async ({ runCLI, channel, browserName }, testInfo) => {
  const tmpFile = testInfo.outputPath('example.py');
  const cli = runCLI(['--target=python', '--output', tmpFile, emptyHTML], {
    autoExitWhen: 'page.goto',
  });
  await cli.waitForCleanExit();
  const content = fs.readFileSync(tmpFile);
  expect(content.toString()).toBe(`import re
from playwright.sync_api import Playwright, sync_playwright, expect


def run(playwright: Playwright) -> None:
    browser = playwright.${browserName}.launch(${launchOptions(channel)})
    context = browser.new_context()
    page = context.new_page()
    page.goto("${emptyHTML}")
    page.close()

    # ---------------------
    context.close()
    browser.close()


with sync_playwright() as playwright:
    run(playwright)
`);
});

test('should print load/save storage_state', async ({ runCLI, channel, browserName }, testInfo) => {
  const loadFileName = testInfo.outputPath('load.json');
  const saveFileName = testInfo.outputPath('save.json');
  await fs.promises.writeFile(loadFileName, JSON.stringify({ cookies: [], origins: [] }), 'utf8');
  const cli = runCLI([`--load-storage=${loadFileName}`, `--save-storage=${saveFileName}`, '--target=python', emptyHTML]);
  const expectedResult1 = `import re
from playwright.sync_api import Playwright, sync_playwright, expect


def run(playwright: Playwright) -> None:
    browser = playwright.${browserName}.launch(${launchOptions(channel)})
    context = browser.new_context(storage_state="${loadFileName.replace(/\\/g, '\\\\')}")`;
  await cli.waitFor(expectedResult1);

  const expectedResult2 = `
    # ---------------------
    context.storage_state(path="${saveFileName.replace(/\\/g, '\\\\')}")
    context.close()
    browser.close()


with sync_playwright() as playwright:
    run(playwright)
`;
  await cli.waitFor(expectedResult2);
});
