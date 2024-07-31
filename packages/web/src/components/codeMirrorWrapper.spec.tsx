/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { expect, test } from '@playwright/experimental-ct-react';
import { CodeMirrorWrapper } from './codeMirrorWrapper';

test.use({ viewport: { width: 500, height: 500 } });

const javascriptSnippet = `import { test, expect } from '@playwright/test';

test('basic test', async ({ page }) => {
  await page.goto('https://playwright.dev/');
  const title = page.locator('.navbar__inner .navbar__title');
  await expect(title).toHaveText('Playwright');
});
`;

const pythonSnippet = `import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
         # Works across chromium, firefox and webkit
         browser = await p.chromium.launch(headless=False)

asyncio.run(main())
`;

const javaSnippet = `import com.microsoft.playwright.*;

public class Example {
  public static void main(String[] args) {
    try (Playwright playwright = Playwright.create()) {
      BrowserType chromium = playwright.chromium();
      Browser browser = chromium.launch(new BrowserType.LaunchOptions().setHeadless(false));
    }
  }
}
`;

const csharpSnippet = `
using Microsoft.Playwright;
using System.Threading.Tasks;

class Program
{
    public static async Task Main()
    {
        using var playwright = await Playwright.CreateAsync();
        await playwright.Chromium.LaunchAsync(new BrowserTypeLaunchOptions
        {
            Headless = false
        });
    }
}
`;

test('highlight JavaScript', async ({ mount }) => {
  const component = await mount(<CodeMirrorWrapper text={javascriptSnippet} language='javascript' />);
  await expect(component.locator('text="async"').first()).toHaveClass('cm-keyword');
});

test('highlight Python', async ({ mount }) => {
  const component = await mount(<CodeMirrorWrapper text={pythonSnippet} language='python' />);
  await expect(component.locator('text="async"').first()).toHaveClass('cm-keyword');
});

test('highlight Java', async ({ mount }) => {
  const component = await mount(<CodeMirrorWrapper text={javaSnippet} language='java' />);
  await expect(component.locator('text="public"').first()).toHaveClass('cm-keyword');
});

test('highlight C#', async ({ mount }) => {
  const component = await mount(<CodeMirrorWrapper text={csharpSnippet} language='csharp' />);
  await expect(component.locator('text="public"').first()).toHaveClass('cm-keyword');
});

test('highlight lines', async ({ mount }) => {
  const component = await mount(<CodeMirrorWrapper text={javascriptSnippet} language='javascript' highlight={[
    { line: 4, type: 'running' },
    { line: 5, type: 'paused' },
    { line: 6, type: 'error' },
  ]} />);
  await expect(component.locator('.source-line-running')).toContainText('goto');
  await expect(component.locator('.source-line-paused')).toContainText('title');
  await expect(component.locator('.source-line-error')).toContainText('expect');
});
