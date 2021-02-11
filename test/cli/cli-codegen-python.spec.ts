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
import { folio } from './cli.fixtures';

const { it, expect } = folio;

const emptyHTML = new URL('file://' + path.join(__dirname, '..', 'assets', 'empty.html')).toString();

it('should print the correct imports and context options', async ({ runCLI, browserName }) => {
  const cli = runCLI(['codegen', '--target=python', emptyHTML]);
  const expectedResult = `from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.${browserName}.launch(headless=False)
    context = browser.new_context()`;
  await cli.waitFor(expectedResult);
  expect(cli.text()).toContain(expectedResult);
});

it('should print the correct context options for custom settings', async ({ runCLI, browserName }) => {
  const cli = runCLI(['--color-scheme=light', 'codegen', '--target=python', emptyHTML]);
  const expectedResult = `from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.${browserName}.launch(headless=False)
    context = browser.new_context(color_scheme="light")`;
  await cli.waitFor(expectedResult);
  expect(cli.text()).toContain(expectedResult);
});

it('should print the correct context options when using a device', async ({ runCLI }) => {
  const cli = runCLI(['--device=Pixel 2', 'codegen', '--target=python', emptyHTML]);
  const expectedResult = `from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch(headless=False)
    context = browser.new_context(**playwright.devices["Pixel 2"])`;
  await cli.waitFor(expectedResult);
  expect(cli.text()).toContain(expectedResult);
});

it('should print the correct context options when using a device and additional options', async ({ runCLI }) => {
  const cli = runCLI(['--color-scheme=light', '--device=iPhone 11', 'codegen', '--target=python', emptyHTML]);
  const expectedResult = `from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.webkit.launch(headless=False)
    context = browser.new_context(**playwright.devices["iPhone 11"], color_scheme="light")`;
  await cli.waitFor(expectedResult);
  expect(cli.text()).toContain(expectedResult);
});

it('should save the codegen output to a file if specified', async ({ runCLI, browserName, testInfo }) => {
  const tmpFile = testInfo.outputPath('script.js');
  const cli = runCLI(['codegen', '--target=python', '--output', tmpFile, emptyHTML]);
  await cli.exited;
  const content = fs.readFileSync(tmpFile);
  expect(content.toString()).toBe(`from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.${browserName}.launch(headless=False)
    context = browser.new_context()

    # Open new page
    page = context.new_page()

    # Go to ${emptyHTML}
    page.goto("${emptyHTML}")

    # Close page
    page.close()

    # ---------------------
    context.close()
    browser.close()

with sync_playwright() as playwright:
    run(playwright)`);
});

it('should print load/save storage_state', async ({ runCLI, browserName, testInfo }) => {
  const loadFileName = testInfo.outputPath('load.json');
  const saveFileName = testInfo.outputPath('save.json');
  await fs.promises.writeFile(loadFileName, JSON.stringify({ cookies: [], origins: [] }), 'utf8');
  const cli = runCLI([`--load-storage=${loadFileName}`, `--save-storage=${saveFileName}`, 'codegen', '--target=python', emptyHTML]);
  const expectedResult1 = `from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.${browserName}.launch(headless=False)
    context = browser.new_context(storage_state="${loadFileName}")`;
  await cli.waitFor(expectedResult1);

  const expectedResult2 = `
    # ---------------------
    context.storage_state(path="${saveFileName}")
    context.close()
    browser.close()

with sync_playwright() as playwright:
    run(playwright)`;
  await cli.waitFor(expectedResult2);
});
