/**
 * Copyright 2018 Google Inc. All rights reserved.
 * Modifications copyright (c) Microsoft Corporation.
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
      body: '<iframe src="iframe.html" name="frame1"></iframe>',
      contentType: 'text/html'
    }).catch(() => {});
  });
  await page.route('**/iframe.html', route => {
    route.fulfill({
      body: `
        <html>
          <div>
            <button data-testid="buttonId">Hello iframe</button>
            <iframe src="iframe-2.html"></iframe>
          </div>
          <span>1</span>
          <span>2</span>
          <label for=target>Name</label><input id=target type=text placeholder=Placeholder title=Title alt=Alternative>
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

async function routeAmbiguous(page: Page) {
  await page.route('**/empty.html', route => {
    route.fulfill({
      body: `<iframe src="iframe-1.html"></iframe>
             <iframe src="iframe-2.html"></iframe>
             <iframe src="iframe-3.html"></iframe>`,
      contentType: 'text/html'
    }).catch(() => {});
  });
  await page.route('**/iframe-*', route => {
    const path = new URL(route.request().url()).pathname.slice(1);
    route.fulfill({
      body: `<html><button>Hello from ${path}</button></html>`,
      contentType: 'text/html'
    }).catch(() => {});
  });
}

it('should work for iframe @smoke', async ({ page, server }) => {
  await routeIframe(page);
  await page.goto(server.EMPTY_PAGE);
  const button = page.frameLocator('iframe').locator('button');
  await button.waitFor();
  expect(await button.innerText()).toBe('Hello iframe');
  await expect(button).toHaveText('Hello iframe');
  await button.click();
});

it('should work for nested iframe', async ({ page, server }) => {
  await routeIframe(page);
  await page.goto(server.EMPTY_PAGE);
  const button = page.frameLocator('iframe').frameLocator('iframe').locator('button');
  await button.waitFor();
  expect(await button.innerText()).toBe('Hello nested iframe');
  await expect(button).toHaveText('Hello nested iframe');
  await button.click();
});

it('should work for $ and $$', async ({ page, server }) => {
  await routeIframe(page);
  await page.goto(server.EMPTY_PAGE);
  const locator = page.frameLocator('iframe').locator('button');
  await expect(locator).toHaveText('Hello iframe');
  const spans = page.frameLocator('iframe').locator('span');
  await expect(spans).toHaveCount(2);
});

it('should wait for frame', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  const error = await page.locator('body').frameLocator('iframe').locator('span').click({ timeout: 1000 }).catch(e => e);
  expect(error.message).toContain(`waiting for locator('body').frameLocator('iframe')`);
});

it('should wait for frame 2', async ({ page, server }) => {
  await routeIframe(page);
  setTimeout(() => page.goto(server.EMPTY_PAGE).catch(() => {}), 300);
  await page.frameLocator('iframe').locator('button').click();
});

it('should wait for frame to go', async ({ page, server, isAndroid }) => {
  it.fixme(isAndroid);

  await routeIframe(page);
  await page.goto(server.EMPTY_PAGE);
  setTimeout(() => page.$eval('iframe', e => e.remove()).catch(() => {}), 300);
  await expect(page.frameLocator('iframe').locator('button')).toBeHidden();
});

it('should not wait for frame', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  await expect(page.frameLocator('iframe').locator('span')).toBeHidden();
});

it('should not wait for frame 2', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  await expect(page.frameLocator('iframe').locator('span')).not.toBeVisible();
});

it('should not wait for frame 3', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  await expect(page.frameLocator('iframe').locator('span')).toHaveCount(0);
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
  const button = page.frameLocator('iframe').locator('button');
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
  const button = page.frameLocator('iframe').locator('button:has-text("Hello nested iframe")');
  const promise = button.waitFor();
  await page.locator('iframe').evaluate(e => e.remove());
  await page.evaluate(() => {
    const iframe = document.createElement('iframe');
    iframe.src = 'iframe-2.html';
    document.body.appendChild(iframe);
  });
  await promise;
});

it('click should survive frame reattach', async ({ page, server }) => {
  await routeIframe(page);
  await page.goto(server.EMPTY_PAGE);
  const button = page.frameLocator('iframe').locator('button:has-text("Hello nested iframe")');
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
  const button = page.frameLocator('iframe').locator('button:has-text("Hello nested iframe")');
  const promise = button.click();
  void page.locator('iframe').evaluate(e => (e as HTMLIFrameElement).src = 'iframe-2.html');
  await promise;
});

it('should non work for non-frame', async ({ page, server }) => {
  await routeIframe(page);
  await page.setContent('<div></div>');
  const button = page.frameLocator('div').locator('button');
  const error = await button.waitFor().catch(e => e);
  expect(error.message).toContain('<div></div>');
  expect(error.message).toContain('<iframe> was expected');
});

it('locator.frameLocator should work for iframe', async ({ page, server }) => {
  await routeIframe(page);
  await page.goto(server.EMPTY_PAGE);
  const button = page.locator('body').frameLocator('iframe').locator('button');
  await button.waitFor();
  expect(await button.innerText()).toBe('Hello iframe');
  await expect(button).toHaveText('Hello iframe');
  await button.click();
});

it('locator.frameLocator should throw on ambiguity', async ({ page, server }) => {
  await routeAmbiguous(page);
  await page.goto(server.EMPTY_PAGE);
  const button = page.locator('body').frameLocator('iframe').locator('button');
  const error = await button.waitFor().catch(e => e);
  expect(error.message).toContain(`Error: strict mode violation: locator('body').locator('iframe') resolved to 3 elements`);
});

it('locator.frameLocator should not throw on first/last/nth', async ({ page, server }) => {
  await routeAmbiguous(page);
  await page.goto(server.EMPTY_PAGE);
  const button1 = page.locator('body').frameLocator('iframe').first().locator('button');
  await expect(button1).toHaveText('Hello from iframe-1.html');
  const button2 = page.locator('body').frameLocator('iframe').nth(1).locator('button');
  await expect(button2).toHaveText('Hello from iframe-2.html');
  const button3 = page.locator('body').frameLocator('iframe').last().locator('button');
  await expect(button3).toHaveText('Hello from iframe-3.html');
});

it('getBy coverage', async ({ page, server }) => {
  await routeIframe(page);
  await page.goto(server.EMPTY_PAGE);
  const button1 = page.frameLocator('iframe').getByRole('button');
  const button2 = page.frameLocator('iframe').getByText('Hello');
  const button3 = page.frameLocator('iframe').getByTestId('buttonId');
  await expect(button1).toHaveText('Hello iframe');
  await expect(button2).toHaveText('Hello iframe');
  await expect(button3).toHaveText('Hello iframe');
  const input1 = page.frameLocator('iframe').getByLabel('Name');
  await expect(input1).toHaveValue('');
  const input2 = page.frameLocator('iframe').getByPlaceholder('Placeholder');
  await expect(input2).toHaveValue('');
  const input3 = page.frameLocator('iframe').getByAltText('Alternative');
  await expect(input3).toHaveValue('');
  const input4 = page.frameLocator('iframe').getByTitle('Title');
  await expect(input4).toHaveValue('');
});

it('wait for hidden should succeed when frame is not in dom', async ({ page }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/21879' });
  await page.goto('about:blank');
  const button = page.frameLocator('iframe1').locator('button');
  expect(await button.isHidden()).toBeTruthy();
  await button.waitFor({ state: 'hidden', timeout: 1000 });
  await button.waitFor({ state: 'detached', timeout: 1000 });
  const error = await button.waitFor({ state: 'attached', timeout: 1000 }).catch(e => e);
  expect(error.message).toContain('Timeout 1000ms exceeded');
});

it('should work with COEP/COOP/CORP isolated iframe', async ({ page, server, browserName }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/28082' });
  it.fixme(browserName === 'firefox');
  await page.route('**/empty.html', route => {
    return route.fulfill({
      body: `<iframe src="https://${server.CROSS_PROCESS_PREFIX}/btn.html" allow="cross-origin-isolated; fullscreen" sandbox="allow-same-origin allow-scripts allow-popups" ></iframe>`,
      contentType: 'text/html',
      headers: {
        'cross-origin-embedder-policy': 'require-corp',
        'cross-origin-opener-policy': 'same-origin',
        'cross-origin-resource-policy': 'cross-origin',
      }
    });
  });
  await page.route('**/btn.html', route => {
    return route.fulfill({
      body: '<button onclick="window.__clicked=true">Click target</button>',
      contentType: 'text/html',
      headers: {
        'cross-origin-embedder-policy': 'require-corp',
        'cross-origin-opener-policy': 'same-origin',
        'cross-origin-resource-policy': 'cross-origin',
      }
    });
  });
  await page.goto(server.EMPTY_PAGE);
  await page.frameLocator('iframe').getByRole('button').click();
  expect(await page.frames()[1].evaluate(() => window['__clicked'])).toBe(true);
});

it('locator.contentFrame should work', async ({ page, server }) => {
  await routeIframe(page);
  await page.goto(server.EMPTY_PAGE);
  const locator = page.locator('iframe');
  const frameLocator = locator.contentFrame();
  const button = frameLocator.locator('button');
  expect(await button.innerText()).toBe('Hello iframe');
  await expect(button).toHaveText('Hello iframe');
  await button.click();
});

it('frameLocator.owner should work', async ({ page, server }) => {
  await routeIframe(page);
  await page.goto(server.EMPTY_PAGE);
  const frameLocator = page.frameLocator('iframe');
  const locator = frameLocator.owner();
  await expect(locator).toBeVisible();
  expect(await locator.getAttribute('name')).toBe('frame1');
});
