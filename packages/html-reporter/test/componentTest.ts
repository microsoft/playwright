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
    __playwright_options: (component: string) => { viewport: { width: number, height: number } };
  }
}

type TestFixtures = {
  renderComponent: (component: string, params?: any) => Promise<Locator>;
  webpack: string;
};

export const test = baseTest.extend<TestFixtures>({
  webpack: '',
  renderComponent: async ({ page, webpack }, use, testInfo) => {
    const webpackConfig = require(webpack);
    const outputPath = webpackConfig.output.path;
    const filename = webpackConfig.output.filename.replace('[name]', 'playwright');
    await use(async (component: string, optionalParams?: Object) => {
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
      const options = await page.evaluate((component: string) => {
        return window.__playwright_options(component);
      }, component);
      await page.setViewportSize(options.viewport);

      const params = { ...optionalParams };
      for (const [key, value] of Object.entries(params)) {
        if (typeof value === 'function') {
          const functionName = '__pw_func_' + key;
          await page.exposeFunction(functionName, value);
          (params as any)[key] = functionName;
        }
      }
      await page.evaluate(v => {
        const params = v.params;
        for (const [key, value] of Object.entries(params)) {
          if (typeof value === 'string' && (value as string).startsWith('__pw_func_'))
            (params as any)[key] = window[value];
        }
        window.__playwright_render(v.component, params);
      }, { component, params });
      return page.locator('#pw-root');
    });
  },
});

export { expect } from '@playwright/test';
