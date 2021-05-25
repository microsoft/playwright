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

const emptyHTML = new URL('file://' + path.join(__dirname, '..', 'assets', 'empty.html')).toString();
const launchOptions = (channel: string) => {
  return channel ? `Headless = false,\n            Channel = "${channel}",` : `Headless = false,`;
};

function capitalize(browserName: string): string {
  return browserName[0].toUpperCase() + browserName.slice(1);
}

test('should print the correct imports and context options', async ({ browserName, channel, runCLI }) => {
  const cli = runCLI(['--target=csharp', emptyHTML]);
  const expectedResult = `using Microsoft.Playwright;
using System;
using System.Threading.Tasks;

class Program
{
    public static async Task Main()
    {
        using var playwright = await Playwright.CreateAsync();
        await using var browser = await playwright.${capitalize(browserName)}.LaunchAsync(new BrowserTypeLaunchOptions
        {
            ${launchOptions(channel)}
        });
        var context = await browser.NewContextAsync();`;
  await cli.waitFor(expectedResult).catch(e => e);
  expect(cli.text()).toContain(expectedResult);
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
            ViewportSize = new ViewportSize
            {
                Width = 1280,
                Height = 720,
            },
            Geolocation = new Geolocation
            {
                Latitude = 37.819722m,
                Longitude = -122.478611m,
            },
            Permissions = new[] { ContextPermission.Geolocation },
            UserAgent = "hardkodemium",
            Locale = "es",
            ColorScheme = ColorScheme.Dark,
            TimezoneId = "Europe/Rome",
        });`;
  await cli.waitFor(expectedResult);
  expect(cli.text()).toContain(expectedResult);
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
  expect(cli.text()).toContain(expectedResult);
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
            UserAgent = "hardkodemium",
            ViewportSize = new ViewportSize
            {
                Width = 1280,
                Height = 720,
            },
            Geolocation = new Geolocation
            {
                Latitude = 37.819722m,
                Longitude = -122.478611m,
            },
            Permissions = new[] { ContextPermission.Geolocation },
            Locale = "es",
            ColorScheme = ColorScheme.Dark,
            TimezoneId = "Europe/Rome",
        });`;

  await cli.waitFor(expectedResult);
  expect(cli.text()).toContain(expectedResult);
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
            StorageStatePath = "${loadFileName}",
        });`;
  await cli.waitFor(expectedResult1);
  const expectedResult2 = `
        await context.StorageStateAsync(new BrowserContextStorageStateOptions
        {
            Path = "${saveFileName}"
        });
`;
  await cli.waitFor(expectedResult2);
});
