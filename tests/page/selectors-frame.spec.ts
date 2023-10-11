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

import type { Page } from 'playwright-core';
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

it('should work for iframe @smoke', async ({ page, server }) => {
  await routeIframe(page);
  await page.goto(server.EMPTY_PAGE);
  const button = page.locator('iframe >> internal:control=enter-frame >> button');
  await button.waitFor();
  expect(await button.innerText()).toBe('Hello iframe');
  await expect(button).toHaveText('Hello iframe');
  await button.click();
});

it('should work for iframe (handle)', async ({ page, server }) => {
  await routeIframe(page);
  await page.goto(server.EMPTY_PAGE);
  const body = await page.$('body');
  const button = await body.waitForSelector('iframe >> internal:control=enter-frame >> button');
  expect(await button.innerText()).toBe('Hello iframe');
  expect(await button.textContent()).toBe('Hello iframe');
  await button.click();
});

it('should work for nested iframe', async ({ page, server }) => {
  await routeIframe(page);
  await page.goto(server.EMPTY_PAGE);
  const button = page.locator('iframe >> internal:control=enter-frame >> iframe >> internal:control=enter-frame >> button');
  await button.waitFor();
  expect(await button.innerText()).toBe('Hello nested iframe');
  await expect(button).toHaveText('Hello nested iframe');
  await button.click();
});

it('should work for nested iframe (handle)', async ({ page, server }) => {
  await routeIframe(page);
  await page.goto(server.EMPTY_PAGE);
  const body = await page.$('body');
  const button = await body.waitForSelector('iframe >> internal:control=enter-frame >> iframe >> internal:control=enter-frame >> button');
  expect(await button.innerText()).toBe('Hello nested iframe');
  expect(await button.textContent()).toBe('Hello nested iframe');
  await button.click();
});

it('should work for $ and $$', async ({ page, server }) => {
  await routeIframe(page);
  await page.goto(server.EMPTY_PAGE);
  const element = await page.$('iframe >> internal:control=enter-frame >> button');
  expect(await element.textContent()).toBe('Hello iframe');
  const elements = await page.$$('iframe >> internal:control=enter-frame >> span');
  expect(elements).toHaveLength(2);
});

it('$ should not wait for frame', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  expect(await page.$('iframe >> internal:control=enter-frame >> canvas')).toBeFalsy();
  const body = await page.$('body');
  expect(await body.$('iframe >> internal:control=enter-frame >> canvas')).toBeFalsy();
});

it('$$ should not wait for frame', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  expect(await page.$$('iframe >> internal:control=enter-frame >> canvas')).toHaveLength(0);
  const body = await page.$('body');
  expect(await body.$$('iframe >> internal:control=enter-frame >> canvas')).toHaveLength(0);
});

it('$eval should throw for missing frame', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  {
    const error = await page.$eval('iframe >> internal:control=enter-frame >> canvas', e => 1).catch(e => e);
    expect(error.message).toContain('page.$eval: Failed to find element matching selector');
  }
  {
    const body = await page.$('body');
    const error = await body.$eval('iframe >> internal:control=enter-frame >> canvas', e => 1).catch(e => e);
    expect(error.message).toContain('elementHandle.$eval: Failed to find element matching selector');
  }
});

it('$$eval should throw for missing frame', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  {
    const error = await page.$$eval('iframe >> internal:control=enter-frame >> canvas', e => 1).catch(e => e);
    expect(error.message).toContain('page.$$eval: Failed to find frame for selector');
  }
  {
    const body = await page.$('body');
    const error = await body.$$eval('iframe >> internal:control=enter-frame >> canvas', e => 1).catch(e => e);
    expect(error.message).toContain('Failed to find frame for selector');
  }
});

it('should work for $ and $$ (handle)', async ({ page, server }) => {
  await routeIframe(page);
  await page.goto(server.EMPTY_PAGE);
  const body = await page.$('body');
  const element = await body.$('iframe >> internal:control=enter-frame >> button');
  expect(await element.textContent()).toBe('Hello iframe');
  const elements = await body.$$('iframe >> internal:control=enter-frame >> span');
  expect(elements).toHaveLength(2);
});

it('should work for $eval', async ({ page, server }) => {
  await routeIframe(page);
  await page.goto(server.EMPTY_PAGE);
  const value = await page.$eval('iframe >> internal:control=enter-frame >> button', b => b.nodeName);
  expect(value).toBe('BUTTON');
});

it('should work for $eval (handle)', async ({ page, server }) => {
  await routeIframe(page);
  await page.goto(server.EMPTY_PAGE);
  const body = await page.$('body');
  const value = await body.$eval('iframe >> internal:control=enter-frame >> button', b => b.nodeName);
  expect(value).toBe('BUTTON');
});

it('should work for $$eval', async ({ page, server }) => {
  await routeIframe(page);
  await page.goto(server.EMPTY_PAGE);
  const value = await page.$$eval('iframe >> internal:control=enter-frame >> span', ss => ss.map(s => s.textContent));
  expect(value).toEqual(['1', '2']);
});

it('should work for $$eval (handle)', async ({ page, server }) => {
  await routeIframe(page);
  await page.goto(server.EMPTY_PAGE);
  const body = await page.$('body');
  const value = await body.$$eval('iframe >> internal:control=enter-frame >> span', ss => ss.map(s => s.textContent));
  expect(value).toEqual(['1', '2']);
});

it('should not allow dangling enter-frame', async ({ page, server }) => {
  await routeIframe(page);
  await page.goto(server.EMPTY_PAGE);
  const button = page.locator('iframe >> internal:control=enter-frame');
  const error = await button.click().catch(e => e);
  expect(error.message).toContain('Selector cannot end with');
  expect(error.message).toContain('iframe >> internal:control=enter-frame');
});

it('should not allow leading enter-frame', async ({ page, server }) => {
  await routeIframe(page);
  await page.goto(server.EMPTY_PAGE);
  const error = await page.waitForSelector('internal:control=enter-frame >> button').catch(e => e);
  expect(error.message).toContain('Selector cannot start with');
});

it('should not allow capturing before enter-frame', async ({ page, server }) => {
  await routeIframe(page);
  await page.goto(server.EMPTY_PAGE);
  const button = page.locator('*css=iframe >> internal:control=enter-frame >> div');
  const error = await await button.click().catch(e => e);
  expect(error.message).toContain('Can not capture the selector before diving into the frame');
});

it('should capture after the enter-frame', async ({ page, server }) => {
  await routeIframe(page);
  await page.goto(server.EMPTY_PAGE);
  const div = page.locator('iframe >> internal:control=enter-frame >> *css=div >> button');
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
    void page.evaluate(() => {
      const iframe = document.createElement('iframe');
      document.body.appendChild(iframe);
    });
    // navigate iframe
    setTimeout(() => {
      void page.evaluate(() => document.querySelector('iframe').src = 'iframe.html');
    }, 500);
  }, 500);

  // Click in iframe
  const button = page.locator('iframe >> internal:control=enter-frame >> button');
  const [, text] = await Promise.all([
    button.click(),
    button.innerText(),
    expect(button).toHaveText('Hello iframe')
  ]);
  expect(text).toBe('Hello iframe');
});

it('waitFor should survive frame reattach', async ({ page, server }) => {
  await routeIframe(page);
  await page.goto(server.EMPTY_PAGE);
  const button = page.locator('iframe >> internal:control=enter-frame >> button:has-text("Hello nested iframe")');
  const promise = button.waitFor();
  await page.locator('iframe').evaluate(e => e.remove());
  await page.evaluate(() => {
    const iframe = document.createElement('iframe');
    iframe.src = 'iframe-2.html';
    document.body.appendChild(iframe);
  });
  await promise;
});

it('waitForSelector should survive frame reattach (handle)', async ({ page, server }) => {
  await routeIframe(page);
  await page.goto(server.EMPTY_PAGE);
  const body = await page.$('body');
  const promise = body.waitForSelector('iframe >> internal:control=enter-frame >> button:has-text("Hello nested iframe")');
  await page.locator('iframe').evaluate(e => e.remove());
  await page.evaluate(() => {
    const iframe = document.createElement('iframe');
    iframe.src = 'iframe-2.html';
    document.body.appendChild(iframe);
  });
  await promise;
});

it('waitForSelector should survive iframe navigation (handle)', async ({ page, server }) => {
  await routeIframe(page);
  await page.goto(server.EMPTY_PAGE);
  const body = await page.$('body');
  const promise = body.waitForSelector('iframe >> internal:control=enter-frame >> button:has-text("Hello nested iframe")');
  void page.locator('iframe').evaluate(e => (e as HTMLIFrameElement).src = 'iframe-2.html');
  await promise;
});

it('click should survive frame reattach', async ({ page, server }) => {
  await routeIframe(page);
  await page.goto(server.EMPTY_PAGE);
  const button = page.locator('iframe >> internal:control=enter-frame >> button:has-text("Hello nested iframe")');
  const promise = button.click();
  await page.locator('iframe').evaluate(e => e.remove());
  await page.evaluate(() => {
    const iframe = document.createElement('iframe');
    iframe.src = 'iframe-2.html';
    document.body.appendChild(iframe);
  });
  await promise;
});

it('click should survive iframe navigation', async ({ page, server }) => {
  await routeIframe(page);
  await page.goto(server.EMPTY_PAGE);
  const button = page.locator('iframe >> internal:control=enter-frame >> button:has-text("Hello nested iframe")');
  const promise = button.click();
  void page.locator('iframe').evaluate(e => (e as HTMLIFrameElement).src = 'iframe-2.html');
  await promise;
});

it('click should survive navigation', async ({ page, server }) => {
  await routeIframe(page);
  await page.goto(server.PREFIX + '/iframe.html');
  const promise = page.click('button:has-text("Hello nested iframe")');
  await page.waitForTimeout(100);
  await page.goto(server.PREFIX + '/iframe-2.html');
  await promise;
});

it('should fail if element removed while waiting on element handle', async ({ page, server }) => {
  it.fixme();
  await routeIframe(page);
  await page.goto(server.PREFIX + '/iframe.html');
  const button = await page.$('button');
  const promise = button.waitForSelector('something');
  await page.waitForTimeout(100);
  await page.evaluate(() => document.body.innerText = '');
  await promise;
});

it('should non work for non-frame', async ({ page, server }) => {
  await routeIframe(page);
  await page.setContent('<div></div>');
  const button = page.locator('div >> internal:control=enter-frame >> button');
  const error = await button.waitFor().catch(e => e);
  expect(error.message).toContain('<div></div>');
  expect(error.message).toContain('<iframe> was expected');
});
