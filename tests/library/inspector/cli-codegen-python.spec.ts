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
import { test, expect } from './inspectorTest';

const launchOptions = (channel: string) => {
  return channel ? `channel="${channel}", headless=False` : 'headless=False';
};

test('should print the correct imports and context options', async ({ runCLI, channel, browserName, server }) => {
  const cli = runCLI(['--target=python', server.EMPTY_PAGE]);
  const expectedResult = `import re
from playwright.sync_api import Playwright, sync_playwright, expect


def run(playwright: Playwright) -> None:
    browser = playwright.${browserName}.launch(${launchOptions(channel)})
    context = browser.new_context()`;
  await cli.waitFor(expectedResult);
});

test('should print the correct context options for custom settings', async ({ runCLI, channel, browserName, server }) => {
  const cli = runCLI(['--color-scheme=light', '--target=python', server.EMPTY_PAGE]);
  const expectedResult = `import re
from playwright.sync_api import Playwright, sync_playwright, expect


def run(playwright: Playwright) -> None:
    browser = playwright.${browserName}.launch(${launchOptions(channel)})
    context = browser.new_context(color_scheme="light")`;
  await cli.waitFor(expectedResult);
});

test('should print the correct context options when using a device', async ({ browserName, channel, runCLI, server }) => {
  test.skip(browserName !== 'chromium');

  const cli = runCLI(['--device=Pixel 2', '--target=python', server.EMPTY_PAGE]);
  const expectedResult = `import re
from playwright.sync_api import Playwright, sync_playwright, expect


def run(playwright: Playwright) -> None:
    browser = playwright.chromium.launch(${launchOptions(channel)})
    context = browser.new_context(**playwright.devices["Pixel 2"])`;
  await cli.waitFor(expectedResult);
});

test('should print the correct context options when using a device and additional options', async ({ browserName, channel, runCLI, server }) => {
  test.skip(browserName !== 'webkit');

  const cli = runCLI(['--color-scheme=light', '--device=iPhone 11', '--target=python', server.EMPTY_PAGE]);
  const expectedResult = `import re
from playwright.sync_api import Playwright, sync_playwright, expect


def run(playwright: Playwright) -> None:
    browser = playwright.webkit.launch(${launchOptions(channel)})
    context = browser.new_context(**playwright.devices["iPhone 11"], color_scheme="light")`;
  await cli.waitFor(expectedResult);
});

test('should save the codegen output to a file if specified', async ({ runCLI, channel, browserName, server }, testInfo) => {
  const tmpFile = testInfo.outputPath('example.py');
  const cli = runCLI(['--target=python', '--output', tmpFile, server.EMPTY_PAGE], {
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
    page.goto("${server.EMPTY_PAGE}")
    page.close()

    # ---------------------
    context.close()
    browser.close()


with sync_playwright() as playwright:
    run(playwright)
`);
});

test('should print load/save storage_state', async ({ runCLI, channel, browserName, server }, testInfo) => {
  const loadFileName = testInfo.outputPath('load.json');
  const saveFileName = testInfo.outputPath('save.json');
  await fs.promises.writeFile(loadFileName, JSON.stringify({ cookies: [], origins: [] }), 'utf8');
  const cli = runCLI([`--load-storage=${loadFileName}`, `--save-storage=${saveFileName}`, '--target=python', server.EMPTY_PAGE]);
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

test('should work with --save-har', async ({ runCLI }, testInfo) => {
  const harFileName = testInfo.outputPath('har.har');
  const expectedResult = `context.route_from_har(${JSON.stringify(harFileName)})`;
  const cli = runCLI(['--target=python-async', `--save-har=${harFileName}`], {
    autoExitWhen: expectedResult,
  });
  await cli.waitForCleanExit();
  const json = JSON.parse(fs.readFileSync(harFileName, 'utf-8'));
  expect(json.log.creator.name).toBe('Playwright');
});

test('should work with --save-har and --save-har-glob', async ({ runCLI }, testInfo) => {
  const harFileName = testInfo.outputPath('har.har');
  const expectedResult = `context.route_from_har(${JSON.stringify(harFileName)}, url="**/*.js")`;
  const cli = runCLI(['--target=python-async', `--save-har=${harFileName}`, '--save-har-glob=**/*.js'], {
    autoExitWhen: expectedResult,
  });
  await cli.waitForCleanExit();
  const json = JSON.parse(fs.readFileSync(harFileName, 'utf-8'));
  expect(json.log.creator.name).toBe('Playwright');
});
