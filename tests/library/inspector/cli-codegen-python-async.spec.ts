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

test('should print the correct imports and context options', async ({ browserName, channel, runCLI }) => {
  const cli = runCLI(['--target=python-async', emptyHTML]);
  const expectedResult = `import asyncio
import re
from playwright.async_api import Playwright, async_playwright, expect


async def run(playwright: Playwright) -> None:
    browser = await playwright.${browserName}.launch(${launchOptions(channel)})
    context = await browser.new_context()`;
  await cli.waitFor(expectedResult);
});

test('should print the correct context options for custom settings', async ({ browserName, channel, runCLI }) => {
  const cli = runCLI(['--color-scheme=light', '--target=python-async', emptyHTML]);
  const expectedResult = `import asyncio
import re
from playwright.async_api import Playwright, async_playwright, expect


async def run(playwright: Playwright) -> None:
    browser = await playwright.${browserName}.launch(${launchOptions(channel)})
    context = await browser.new_context(color_scheme="light")`;
  await cli.waitFor(expectedResult);
});

test('should print the correct context options when using a device', async ({ browserName, channel, runCLI }) => {
  test.skip(browserName !== 'chromium');

  const cli = runCLI(['--device=Pixel 2', '--target=python-async', emptyHTML]);
  const expectedResult = `import asyncio
import re
from playwright.async_api import Playwright, async_playwright, expect


async def run(playwright: Playwright) -> None:
    browser = await playwright.chromium.launch(${launchOptions(channel)})
    context = await browser.new_context(**playwright.devices["Pixel 2"])`;
  await cli.waitFor(expectedResult);
});

test('should print the correct context options when using a device and additional options', async ({ browserName, channel, runCLI }) => {
  test.skip(browserName !== 'webkit');

  const cli = runCLI(['--color-scheme=light', '--device=iPhone 11', '--target=python-async', emptyHTML]);
  const expectedResult = `import asyncio
import re
from playwright.async_api import Playwright, async_playwright, expect


async def run(playwright: Playwright) -> None:
    browser = await playwright.webkit.launch(${launchOptions(channel)})
    context = await browser.new_context(**playwright.devices["iPhone 11"], color_scheme="light")`;
  await cli.waitFor(expectedResult);
});

test('should save the codegen output to a file if specified', async ({ browserName, channel, runCLI }, testInfo) => {
  const tmpFile = testInfo.outputPath('example.py');
  const cli = runCLI(['--target=python-async', '--output', tmpFile, emptyHTML], {
    autoExitWhen: 'page.goto',
  });
  await cli.waitForCleanExit();
  const content = fs.readFileSync(tmpFile);
  expect(content.toString()).toBe(`import asyncio
import re
from playwright.async_api import Playwright, async_playwright, expect


async def run(playwright: Playwright) -> None:
    browser = await playwright.${browserName}.launch(${launchOptions(channel)})
    context = await browser.new_context()
    page = await context.new_page()
    await page.goto("${emptyHTML}")
    await page.close()

    # ---------------------
    await context.close()
    await browser.close()


async def main() -> None:
    async with async_playwright() as playwright:
        await run(playwright)


asyncio.run(main())
`);
});

test('should print load/save storage_state', async ({ browserName, channel, runCLI }, testInfo) => {
  const loadFileName = testInfo.outputPath('load.json');
  const saveFileName = testInfo.outputPath('save.json');
  await fs.promises.writeFile(loadFileName, JSON.stringify({ cookies: [], origins: [] }), 'utf8');
  const cli = runCLI([`--load-storage=${loadFileName}`, `--save-storage=${saveFileName}`, '--target=python-async', emptyHTML]);
  const expectedResult1 = `import asyncio
import re
from playwright.async_api import Playwright, async_playwright, expect


async def run(playwright: Playwright) -> None:
    browser = await playwright.${browserName}.launch(${launchOptions(channel)})
    context = await browser.new_context(storage_state="${loadFileName.replace(/\\/g, '\\\\')}")`;
  await cli.waitFor(expectedResult1);

  const expectedResult2 = `
    # ---------------------
    await context.storage_state(path="${saveFileName.replace(/\\/g, '\\\\')}")
    await context.close()
    await browser.close()


async def main() -> None:
    async with async_playwright() as playwright:
        await run(playwright)


asyncio.run(main())
`;
  await cli.waitFor(expectedResult2);
});

test('should work with --save-har', async ({ runCLI }, testInfo) => {
  const harFileName = testInfo.outputPath('har.har');
  const expectedResult = `context = await browser.new_context(record_har_mode="minimal", record_har_path=${JSON.stringify(harFileName)}, service_workers="block")`;
  const cli = runCLI(['--target=python-async', `--save-har=${harFileName}`], {
    autoExitWhen: expectedResult,
  });
  await cli.waitForCleanExit();
  const json = JSON.parse(fs.readFileSync(harFileName, 'utf-8'));
  expect(json.log.creator.name).toBe('Playwright');
});
