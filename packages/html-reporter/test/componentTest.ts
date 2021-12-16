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

import * as path from 'path';
import { test as baseTest, Locator } from '@playwright/test';

declare global {
  interface Window {
    __playwright_render: (component: string, props: any) => void;
  }
}

type TestFixtures = {
  render: (component: { type: string, props: Object }) => Promise<Locator>;
  capture: (locator: Locator, name: string) => Promise<void>;
  webpack: string;
};

export const test = baseTest.extend<TestFixtures>({
  webpack: '',
  render: async ({ page, webpack }, use) => {
    const webpackConfig = require(webpack);
    const outputPath = webpackConfig.output.path;
    const filename = webpackConfig.output.filename.replace('[name]', 'playwright');
    await use(async (component: { type: string, props: Object }) => {
      await page.route('http://component/index.html', route => {
        route.fulfill({
          body: `<html>
            <meta name='color-scheme' content='dark light'>
            <style>html, body { padding: 0; margin: 0; background: #aaa; }</style>
            <div id='root' style='width: 100%; height: 100%;'></div>
          </html>`,
          contentType: 'text/html'
        });
      });
      await page.goto('http://component/index.html');

      await page.addScriptTag({ path: path.resolve(__dirname, outputPath, filename) });

      const props = { ...component.props };
      for (const [key, value] of Object.entries(props)) {
        if (typeof value === 'function') {
          const functionName = '__pw_func_' + key;
          await page.exposeFunction(functionName, value);
          (props as any)[key] = functionName;
        }
      }
      await page.evaluate(v => {
        const props = v.props;
        for (const [key, value] of Object.entries(props)) {
          if (typeof value === 'string' && (value as string).startsWith('__pw_func_'))
            (props as any)[key] = (window as any)[value];
        }
        window.__playwright_render(v.type, props);
      }, { type: component.type, props });
      return page.locator('#pw-root');
    });
  },

  capture: async ({}, use, testInfo) => {
    await use(async (locator: Locator, name: string) => {
      const screenshotPath = path.join(__dirname, '..', 'screenshots', sanitizeForFilePath(path.basename(testInfo.file) + '-' + testInfo.title + '-' + name) + '.png');
      testInfo.attachments.push({ name, path: screenshotPath, contentType: 'image/png' });
      await locator.screenshot({ path: screenshotPath });
    });
  }
});

export function sanitizeForFilePath(s: string) {
  return s.replace(/[\x00-\x2C\x2E-\x2F\x3A-\x40\x5B-\x60\x7B-\x7F]+/g, '-');
}

export { expect } from '@playwright/test';
