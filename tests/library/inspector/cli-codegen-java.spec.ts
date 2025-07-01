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
  return channel ? `.setChannel("${channel}")\n        .setHeadless(false)` : '.setHeadless(false)';
};

test('should print the correct imports and context options', async ({ runCLI, channel, browserName, server }) => {
  const cli = runCLI(['--target=java', server.EMPTY_PAGE]);
  const expectedResult = `import com.microsoft.playwright.*;
import com.microsoft.playwright.options.*;
import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;
import java.util.*;

public class Example {
  public static void main(String[] args) {
    try (Playwright playwright = Playwright.create()) {
      Browser browser = playwright.${browserName}().launch(new BrowserType.LaunchOptions()
        ${launchOptions(channel)});
      BrowserContext context = browser.newContext();`;
  await cli.waitFor(expectedResult);
});

test('should print the correct context options for custom settings', async ({ runCLI, server }) => {
  const cli = runCLI(['--color-scheme=light', '--target=java', server.EMPTY_PAGE]);
  const expectedResult = `BrowserContext context = browser.newContext(new Browser.NewContextOptions()
        .setColorScheme(ColorScheme.LIGHT));`;
  await cli.waitFor(expectedResult);
});

test('should print the correct context options when using a device', async ({ browserName, runCLI, server }) => {
  test.skip(browserName !== 'chromium');

  const cli = runCLI(['--device=Pixel 2', '--target=java', server.EMPTY_PAGE]);
  await cli.waitFor(`.setViewportSize(411, 731));`);
  const expectedResult = `BrowserContext context = browser.newContext(new Browser.NewContextOptions()
        .setDeviceScaleFactor(2.625)
        .setHasTouch(true)
        .setIsMobile(true)
        .setUserAgent("Mozilla/5.0 (Linux; Android 8.0; Pixel 2 Build/OPD3.170816.012) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/XXXX Mobile Safari/537.36")
        .setViewportSize(411, 731));`;
  expect(cli.text().replace(/(.*Chrome\/)(.*?)( .*)/m, '$1XXXX$3')).toContain(expectedResult);
});

test('should print the correct context options when using a device and additional options', async ({ browserName, runCLI, server }) => {
  test.skip(browserName !== 'webkit');

  const cli = runCLI(['--color-scheme=light', '--device=iPhone 11', '--target=java', server.EMPTY_PAGE]);
  await cli.waitFor(`.setViewportSize(414, 715));`);
  const expectedResult = `BrowserContext context = browser.newContext(new Browser.NewContextOptions()
        .setColorScheme(ColorScheme.LIGHT)
        .setDeviceScaleFactor(2)
        .setHasTouch(true)
        .setIsMobile(true)
        .setUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 12_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/XXXX Mobile/15E148 Safari/604.1")
        .setViewportSize(414, 715));`;
  expect(cli.text().replace(/(.*Version\/)(.*?)( .*)/m, '$1XXXX$3')).toContain(expectedResult);
});

test('should print load/save storage_state', async ({ runCLI, server }, testInfo) => {
  const loadFileName = testInfo.outputPath('load.json');
  const saveFileName = testInfo.outputPath('save.json');
  await fs.promises.writeFile(loadFileName, JSON.stringify({ cookies: [], origins: [] }), 'utf8');
  const cli = runCLI([`--load-storage=${loadFileName}`, `--save-storage=${saveFileName}`, '--target=java', server.EMPTY_PAGE]);
  const expectedResult1 = `BrowserContext context = browser.newContext(new Browser.NewContextOptions()
        .setStorageStatePath(Paths.get(${JSON.stringify(loadFileName)})));`;
  await cli.waitFor(expectedResult1);

  const expectedResult2 = `
      context.storageState(new BrowserContext.StorageStateOptions().setPath("${saveFileName.replace(/\\/g, '\\\\')}"))`;
  await cli.waitFor(expectedResult2);
});

test('should work with --save-har and --save-har-glob as java-library', async ({ runCLI }, testInfo) => {
  const harFileName = testInfo.outputPath('har.har');
  const expectedResult = `context.routeFromHAR(Paths.get(${JSON.stringify(harFileName)}), new BrowserContext.RouteFromHAROptions()
        .setUrl("**/*.js"));`;
  const cli = runCLI(['--target=java', `--save-har=${harFileName}`, '--save-har-glob=**/*.js'], {
    autoExitWhen: expectedResult,
  });

  await cli.waitForCleanExit();
  const json = JSON.parse(fs.readFileSync(harFileName, 'utf-8'));
  expect(json.log.creator.name).toBe('Playwright');
});

test('should work with --save-har and --save-har-glob as java-junit', async ({ runCLI }, testInfo) => {
  const harFileName = testInfo.outputPath('har.har');
  const expectedResult = `page.routeFromHAR(Paths.get(${JSON.stringify(harFileName)}), new Page.RouteFromHAROptions()
      .setUrl("**/*.js"));`;
  const cli = runCLI(['--target=java-junit', `--save-har=${harFileName}`, '--save-har-glob=**/*.js'], {
    autoExitWhen: expectedResult,
  });

  await cli.waitForCleanExit();
  const json = JSON.parse(fs.readFileSync(harFileName, 'utf-8'));
  expect(json.log.creator.name).toBe('Playwright');
});

test('should print the correct imports in junit', async ({ runCLI, server }) => {
  const cli = runCLI(['--target=java-junit', server.EMPTY_PAGE]);
  const expectedImportResult = `import com.microsoft.playwright.junit.UsePlaywright;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.options.*;

import org.junit.jupiter.api.*;
import static com.microsoft.playwright.assertions.PlaywrightAssertions.*;`;
  await cli.waitFor(expectedImportResult);
});

test('should print a valid basic program in junit', async ({ runCLI, server }) => {
  const cli = runCLI(['--target=java-junit', server.EMPTY_PAGE]);
  const expectedResult = `import com.microsoft.playwright.junit.UsePlaywright;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.options.*;

import org.junit.jupiter.api.*;
import static com.microsoft.playwright.assertions.PlaywrightAssertions.*;

@UsePlaywright
public class TestExample {
  @Test
  void test(Page page) {
    page.navigate("${server.EMPTY_PAGE}");
  }
}`;
  await cli.waitFor(expectedResult);
});
