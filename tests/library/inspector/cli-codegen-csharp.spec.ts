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

import path from 'path';
import fs from 'fs';
import { test, expect } from './inspectorTest';

const emptyHTML = new URL('file://' + path.join(__dirname, '..', '..', 'assets', 'empty.html')).toString();
const launchOptions = (channel: string) => {
  return channel ? `Channel = "${channel}",\n    Headless = false,` : `Headless = false,`;
};

function capitalize(browserName: string): string {
  return browserName[0].toUpperCase() + browserName.slice(1);
}

test('should print the correct imports and context options', async ({ browserName, channel, runCLI }) => {
  const cli = runCLI(['--target=csharp', emptyHTML]);
  const expectedResult = `using Microsoft.Playwright;
using System;
using System.Threading.Tasks;

using var playwright = await Playwright.CreateAsync();
await using var browser = await playwright.${capitalize(browserName)}.LaunchAsync(new BrowserTypeLaunchOptions
{
    ${launchOptions(channel)}
});
var context = await browser.NewContextAsync();`;
  await cli.waitFor(expectedResult);
});

test('should print the correct context options for custom settings', async ({ browserName, channel, runCLI }) => {
  const cli = runCLI([
    '--color-scheme=dark',
    '--geolocation=37.819722,-122.478611',
    '--lang=es',
    '--proxy-server=http://myproxy:3128',
    '--timezone=Europe/Rome',
    '--user-agent=hardkodemium',
    '--viewport-size=1280,720',
    '--target=csharp',
    emptyHTML]);
  const expectedResult = `
using var playwright = await Playwright.CreateAsync();
await using var browser = await playwright.${capitalize(browserName)}.LaunchAsync(new BrowserTypeLaunchOptions
{
    ${launchOptions(channel)}
    Proxy = new ProxySettings
    {
        Server = "http://myproxy:3128",
    },
});
var context = await browser.NewContextAsync(new BrowserNewContextOptions
{
    ColorScheme = ColorScheme.Dark,
    Geolocation = new Geolocation
    {
        Latitude = 37.819722m,
        Longitude = -122.478611m,
    },
    Locale = "es",
    Permissions = new[] { ContextPermission.Geolocation },
    TimezoneId = "Europe/Rome",
    UserAgent = "hardkodemium",
    ViewportSize = new ViewportSize
    {
        Height = 720,
        Width = 1280,
    },
});`;
  await cli.waitFor(expectedResult);
});

test('should print the correct context options when using a device', async ({ browserName, channel, runCLI }) => {
  test.skip(browserName !== 'chromium');

  const cli = runCLI(['--device=Pixel 2', '--target=csharp', emptyHTML]);
  const expectedResult = `
using var playwright = await Playwright.CreateAsync();
await using var browser = await playwright.${capitalize(browserName)}.LaunchAsync(new BrowserTypeLaunchOptions
{
    ${launchOptions(channel)}
});
var context = await browser.NewContextAsync(playwright.Devices["Pixel 2"]);`;
  await cli.waitFor(expectedResult);
});

test('should print the correct context options when using a device and additional options', async ({ browserName, channel, runCLI }) => {
  test.skip(browserName !== 'webkit');

  const cli = runCLI([
    '--device=iPhone 11',
    '--color-scheme=dark',
    '--geolocation=37.819722,-122.478611',
    '--lang=es',
    '--proxy-server=http://myproxy:3128',
    '--timezone=Europe/Rome',
    '--user-agent=hardkodemium',
    '--viewport-size=1280,720',
    '--target=csharp',
    emptyHTML]);
  const expectedResult = `
using var playwright = await Playwright.CreateAsync();
await using var browser = await playwright.${capitalize(browserName)}.LaunchAsync(new BrowserTypeLaunchOptions
{
    ${launchOptions(channel)}
    Proxy = new ProxySettings
    {
        Server = "http://myproxy:3128",
    },
});
var context = await browser.NewContextAsync(new BrowserNewContextOptions(playwright.Devices["iPhone 11"])
{
    ColorScheme = ColorScheme.Dark,
    Geolocation = new Geolocation
    {
        Latitude = 37.819722m,
        Longitude = -122.478611m,
    },
    Locale = "es",
    Permissions = new[] { ContextPermission.Geolocation },
    TimezoneId = "Europe/Rome",
    UserAgent = "hardkodemium",
    ViewportSize = new ViewportSize
    {
        Height = 720,
        Width = 1280,
    },
});`;
  await cli.waitFor(expectedResult);
});

test('should print load/save storageState', async ({ browserName, channel, runCLI }, testInfo) => {
  const loadFileName = testInfo.outputPath('load.json');
  const saveFileName = testInfo.outputPath('save.json');
  await fs.promises.writeFile(loadFileName, JSON.stringify({ cookies: [], origins: [] }), 'utf8');
  const cli = runCLI([`--load-storage=${loadFileName}`, `--save-storage=${saveFileName}`, '--target=csharp', emptyHTML]);
  const expectedResult1 = `
using var playwright = await Playwright.CreateAsync();
await using var browser = await playwright.${capitalize(browserName)}.LaunchAsync(new BrowserTypeLaunchOptions
{
    ${launchOptions(channel)}
});
var context = await browser.NewContextAsync(new BrowserNewContextOptions
{
    StorageStatePath = "${loadFileName.replace(/\\/g, '\\\\')}",
});`;
  await cli.waitFor(expectedResult1);
  const expectedResult2 = `
await context.StorageStateAsync(new BrowserContextStorageStateOptions
{
    Path = "${saveFileName.replace(/\\/g, '\\\\')}"
});
`;
  await cli.waitFor(expectedResult2);
});

test('should work with --save-har', async ({ runCLI }, testInfo) => {
  const harFileName = testInfo.outputPath('har.har');
  const expectedResult = `
var context = await browser.NewContextAsync(new BrowserNewContextOptions
{
    RecordHarMode = HarMode.Minimal,
    RecordHarPath = ${JSON.stringify(harFileName)},
    ServiceWorkers = ServiceWorkerPolicy.Block,
});`;
  const cli = runCLI(['--target=csharp', `--save-har=${harFileName}`], {
    autoExitWhen: expectedResult,
  });
  await cli.waitForCleanExit();
  const json = JSON.parse(fs.readFileSync(harFileName, 'utf-8'));
  expect(json.log.creator.name).toBe('Playwright');
});

for (const testFramework of ['nunit', 'mstest'] as const) {
  test(`should not print context options method override in ${testFramework} if no options were passed`, async ({ runCLI }) => {
    const cli = runCLI([`--target=csharp-${testFramework}`, emptyHTML]);
    await cli.waitFor(`Page.GotoAsync("${emptyHTML}")`);
    expect(cli.text()).not.toContain('public override BrowserNewContextOptions ContextOptions()');
  });

  test(`should print context options method override in ${testFramework} if options were passed`, async ({ runCLI }) => {
    const cli = runCLI([`--target=csharp-${testFramework}`, '--color-scheme=dark', emptyHTML]);
    await cli.waitFor(`Page.GotoAsync("${emptyHTML}")`);
    expect(cli.text()).toContain(`    public override BrowserNewContextOptions ContextOptions()
    {
        return new BrowserNewContextOptions
        {
            ColorScheme = ColorScheme.Dark,
        };
    }
`);
  });
}

test(`should print a valid basic program in mstest`, async ({ runCLI }) => {
  const cli = runCLI([`--target=csharp-mstest`, '--color-scheme=dark', emptyHTML]);
  await cli.waitFor(`Page.GotoAsync("${emptyHTML}")`);
  const expected = `using Microsoft.Playwright.MSTest;
using Microsoft.Playwright;

[TestClass]
public class Tests : PageTest
{
    public override BrowserNewContextOptions ContextOptions()
    {
        return new BrowserNewContextOptions
        {
            ColorScheme = ColorScheme.Dark,
        };
    }

    [TestMethod]
    public async Task MyTest()
    {
        await Page.GotoAsync("${emptyHTML}");
    }
}`;
  expect(cli.text()).toContain(expected);
});

test(`should print a valid basic program in nunit`, async ({ runCLI }) => {
  const cli = runCLI([`--target=csharp-nunit`, '--color-scheme=dark', emptyHTML]);
  await cli.waitFor(`Page.GotoAsync("${emptyHTML}")`);
  const expected = `using Microsoft.Playwright.NUnit;
using Microsoft.Playwright;

[Parallelizable(ParallelScope.Self)]
[TestFixture]
public class Tests : PageTest
{
    public override BrowserNewContextOptions ContextOptions()
    {
        return new BrowserNewContextOptions
        {
            ColorScheme = ColorScheme.Dark,
        };
    }

    [Test]
    public async Task MyTest()
    {
        await Page.GotoAsync("${emptyHTML}");
    }
}`;
  expect(cli.text()).toContain(expected);
});
