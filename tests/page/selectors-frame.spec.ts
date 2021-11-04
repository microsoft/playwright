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

import { Page } from 'playwright-core';
import { test as it, expect } from './pageTest';

async function routeIframe(page: Page) {
  await page.route('**/empty.html', route => {
    route.fulfill({
      body: '<iframe src="iframe.html"></iframe>',
      contentType: 'text/html'
    }).catch(() => {});
  });
  await page.route('**/iframe.html', route => {
    route.fulfill({
      body: `
        <html>
          <div>
            <button>Hello iframe</button>
            <iframe src="iframe-2.html"></iframe>
          </div>
          <span>1</span>
          <span>2</span>
        </html>`,
      contentType: 'text/html'
    }).catch(() => {});
  });
  await page.route('**/iframe-2.html', route => {
    route.fulfill({
      body: '<html><button>Hello nested iframe</button></html>',
      contentType: 'text/html'
    }).catch(() => {});
  });
}

it('should work for iframe', async ({ page, server }) => {
  await routeIframe(page);
  await page.goto(server.EMPTY_PAGE);
  const button = page.locator('iframe >> content-frame=true >> button');
  await button.waitFor();
  expect(await button.innerText()).toBe('Hello iframe');
  await expect(button).toHaveText('Hello iframe');
  await button.click();
});

it('should work for iframe (handle)', async ({ page, server }) => {
  await routeIframe(page);
  await page.goto(server.EMPTY_PAGE);
  const body = await page.$('body');
  const button = await body.waitForSelector('iframe >> content-frame=true >> button');
  expect(await button.innerText()).toBe('Hello iframe');
  expect(await button.textContent()).toBe('Hello iframe');
  await button.click();
});

it('should work for nested iframe', async ({ page, server }) => {
  await routeIframe(page);
  await page.goto(server.EMPTY_PAGE);
  const button = page.locator('iframe >> content-frame=true >> iframe >> content-frame=true >> button');
  await button.waitFor();
  expect(await button.innerText()).toBe('Hello nested iframe');
  await expect(button).toHaveText('Hello nested iframe');
  await button.click();
});

it('should work for nested iframe (handle)', async ({ page, server }) => {
  await routeIframe(page);
  await page.goto(server.EMPTY_PAGE);
  const body = await page.$('body');
  const button = await body.waitForSelector('iframe >> content-frame=true >> iframe >> content-frame=true >> button');
  expect(await button.innerText()).toBe('Hello nested iframe');
  expect(await button.textContent()).toBe('Hello nested iframe');
  await button.click();
});

it('should work for $ and $$', async ({ page, server }) => {
  await routeIframe(page);
  await page.goto(server.EMPTY_PAGE);
  const element = await page.$('iframe >> content-frame=true >> button');
  expect(await element.textContent()).toBe('Hello iframe');
  const elements = await page.$$('iframe >> content-frame=true >> span');
  expect(elements).toHaveLength(2);
});

it('should work for $ and $$ (handle)', async ({ page, server }) => {
  await routeIframe(page);
  await page.goto(server.EMPTY_PAGE);
  const body = await page.$('body');
  const element = await body.$('iframe >> content-frame=true >> button');
  expect(await element.textContent()).toBe('Hello iframe');
  const elements = await body.$$('iframe >> content-frame=true >> span');
  expect(elements).toHaveLength(2);
});

it('should work for $eval', async ({ page, server }) => {
  await routeIframe(page);
  await page.goto(server.EMPTY_PAGE);
  const value = await page.$eval('iframe >> content-frame=true >> button', b => b.nodeName);
  expect(value).toBe('BUTTON');
});

it('should work for $eval (handle)', async ({ page, server }) => {
  await routeIframe(page);
  await page.goto(server.EMPTY_PAGE);
  const body = await page.$('body');
  const value = await body.$eval('iframe >> content-frame=true >> button', b => b.nodeName);
  expect(value).toBe('BUTTON');
});

it('should work for $$eval', async ({ page, server }) => {
  await routeIframe(page);
  await page.goto(server.EMPTY_PAGE);
  const value = await page.$$eval('iframe >> content-frame=true >> span', ss => ss.map(s => s.textContent));
  expect(value).toEqual(['1', '2']);
});

it('should work for $$eval (handle)', async ({ page, server }) => {
  await routeIframe(page);
  await page.goto(server.EMPTY_PAGE);
  const body = await page.$('body');
  const value = await body.$$eval('iframe >> content-frame=true >> span', ss => ss.map(s => s.textContent));
  expect(value).toEqual(['1', '2']);
});

it('should not allow dangling content-frame', async ({ page, server }) => {
  await routeIframe(page);
  await page.goto(server.EMPTY_PAGE);
  const button = page.locator('iframe >> content-frame=true');
  const error = await button.click().catch(e => e);
  expect(error.message).toContain('Selector cannot end with');
  expect(error.message).toContain('iframe >> content-frame=true');
});

it('should allow leading content-frame on handle', async ({ page, server }) => {
  await routeIframe(page);
  await page.goto(server.EMPTY_PAGE);
  const iframe = await page.$('iframe');
  const button = await iframe.waitForSelector('content-frame=true >> button');
  await button.click();
});

it('should not allow leading content-frame on page', async ({ page, server }) => {
  await routeIframe(page);
  await page.goto(server.EMPTY_PAGE);
  const error = await page.waitForSelector('content-frame=true >> button').catch(e => e);
  expect(error.message).toContain('<iframe> was expected');
});

it('should not allow capturing before content-frame', async ({ page, server }) => {
  await routeIframe(page);
  await page.goto(server.EMPTY_PAGE);
  const button = page.locator('*css=iframe >> content-frame=true >> div');
  const error = await await button.click().catch(e => e);
  expect(error.message).toContain('Can not capture the selector before diving into the frame');
});

it('should capture after the content-frame', async ({ page, server }) => {
  await routeIframe(page);
  await page.goto(server.EMPTY_PAGE);
  const div = page.locator('iframe >> content-frame=true >> *css=div >> button');
  expect(await div.innerHTML()).toContain('<button>');
});

it('should click in lazy iframe', async ({ page, server }) => {
  await page.route('**/iframe.html', route => {
    route.fulfill({
      body: '<html><button>Hello iframe</button></html>',
      contentType: 'text/html'
    }).catch(() => {});
  });

  // empty pge
  await page.goto(server.EMPTY_PAGE);

  // add blank iframe
  setTimeout(() => {
    page.evaluate(() => {
      const iframe = document.createElement('iframe');
      document.body.appendChild(iframe);
    });
    // navigate iframe
    setTimeout(() => {
      page.evaluate(() => document.querySelector('iframe').src = 'iframe.html');
    }, 500);
  }, 500);

  // Click in iframe
  const button = page.locator('iframe >> content-frame=true >> button');
  const [, text] = await Promise.all([
    button.click(),
    button.innerText(),
    expect(button).toHaveText('Hello iframe')
  ]);
  expect(text).toBe('Hello iframe');
});
