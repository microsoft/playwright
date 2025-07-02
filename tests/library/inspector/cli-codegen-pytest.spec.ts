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

test('should print the correct imports and context options', async ({ runCLI, server }) => {
  const cli = runCLI(['--target=python-pytest', server.EMPTY_PAGE]);
  const expectedResult = `import re
from playwright.sync_api import Page, expect


def test_example(page: Page) -> None:`;
  await cli.waitFor(expectedResult);
});

test('should print the correct context options when using a device and lang', async ({ browserName, runCLI, server }, testInfo) => {
  test.skip(browserName !== 'webkit');

  const tmpFile = testInfo.outputPath('script.js');
  const cli = runCLI(['--target=python-pytest', '--device=iPhone 11', '--lang=en-US', '--output', tmpFile, server.EMPTY_PAGE], {
    autoExitWhen: 'page.goto',
  });
  await cli.waitForCleanExit();
  const content = fs.readFileSync(tmpFile);
  expect(content.toString()).toBe(`import pytest
import re
from playwright.sync_api import Page, expect


@pytest.fixture(scope="session")
def browser_context_args(browser_context_args, playwright):
    return {**playwright.devices["iPhone 11"], "locale": "en-US"}


def test_example(page: Page) -> None:
    page.goto("${server.EMPTY_PAGE}")
`);
});

test('should save the codegen output to a file if specified', async ({ runCLI, server }, testInfo) => {
  const tmpFile = testInfo.outputPath('test_example.py');
  const cli = runCLI(['--target=python-pytest', '--output', tmpFile, server.EMPTY_PAGE], {
    autoExitWhen: 'page.goto',
  });
  await cli.waitForCleanExit();
  const content = fs.readFileSync(tmpFile);
  expect(content.toString()).toBe(`import re
from playwright.sync_api import Page, expect


def test_example(page: Page) -> None:
    page.goto("${server.EMPTY_PAGE}")
`);
});

test('should work with --save-har', async ({ runCLI }, testInfo) => {
  const harFileName = testInfo.outputPath('har.har');
  const expectedResult = `page.route_from_har(${JSON.stringify(harFileName)})`;
  const cli = runCLI(['--target=python-pytest', `--save-har=${harFileName}`], {
    autoExitWhen: expectedResult,
  });
  await cli.waitForCleanExit();
  const json = JSON.parse(fs.readFileSync(harFileName, 'utf-8'));
  expect(json.log.creator.name).toBe('Playwright');
});

test('should work with --save-har and --save-har-glob', async ({ runCLI }, testInfo) => {
  const harFileName = testInfo.outputPath('har.har');
  const expectedResult = `page.route_from_har(${JSON.stringify(harFileName)}, url="**/*.js")`;
  const cli = runCLI(['--target=python-pytest', `--save-har=${harFileName}`, '--save-har-glob=**/*.js'], {
    autoExitWhen: expectedResult,
  });
  await cli.waitForCleanExit();
  const json = JSON.parse(fs.readFileSync(harFileName, 'utf-8'));
  expect(json.log.creator.name).toBe('Playwright');
});
