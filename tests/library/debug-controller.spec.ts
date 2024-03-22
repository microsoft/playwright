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

import { expect, playwrightTest as baseTest } from '../config/browserTest';
import { PlaywrightServer } from '../../packages/playwright-core/lib/remote/playwrightServer';
import { createGuid } from '../../packages/playwright-core/lib/utils/crypto';
import { Backend } from '../config/debugControllerBackend';
import type { Browser, BrowserContext, BrowserContextOptions } from '@playwright/test';
import type * as channels from '@protocol/channels';

type BrowserWithReuse = Browser & { _newContextForReuse: (options?: BrowserContextOptions) => Promise<BrowserContext> };
type Fixtures = {
  wsEndpoint: string;
  backend: channels.DebugControllerChannel;
  connectedBrowserFactory: () => Promise<BrowserWithReuse>;
  connectedBrowser: BrowserWithReuse;
};

const test = baseTest.extend<Fixtures>({
  wsEndpoint: async ({ headless }, use) => {
    process.env.PW_DEBUG_CONTROLLER_HEADLESS = headless ? '1' : '';
    const server = new PlaywrightServer({ mode: 'extension', path: '/' + createGuid(), maxConnections: Number.MAX_VALUE, enableSocksProxy: false });
    const wsEndpoint = await server.listen();
    await use(wsEndpoint);
    await server.close();
  },
  backend: async ({ wsEndpoint }, use) => {
    const backend = new Backend();
    await backend.connect(wsEndpoint);
    await backend.initialize();
    await use(backend.channel);
    await backend.close();
  },
  connectedBrowserFactory: async ({ wsEndpoint, browserType }, use) => {
    const browsers: BrowserWithReuse [] = [];
    await use(async () => {
      const browser = await browserType.connect(wsEndpoint, {
        headers: {
          'x-playwright-launch-options': JSON.stringify((browserType as any)._defaultLaunchOptions),
          'x-playwright-reuse-context': '1',
        },
      }) as BrowserWithReuse;
      browsers.push(browser);
      return browser;
    });
    for (const browser of browsers)
      await browser.close();
  },
  connectedBrowser: async ({ connectedBrowserFactory }, use) => {
    await use(await connectedBrowserFactory());
  },
});

test.slow(true, 'All controller tests are slow');
test.skip(({ mode }) => mode.startsWith('service'));

test('should pick element', async ({ backend, connectedBrowser }) => {
  const events = [];
  backend.on('inspectRequested', event => events.push(event));

  await backend.setRecorderMode({ mode: 'inspecting' });

  const context = await connectedBrowser._newContextForReuse();
  const [page] = context.pages();

  await page.setContent('<button>Submit</button>');
  await page.getByRole('button').click();
  await page.getByRole('button').click();

  expect(events).toEqual([
    {
      selector: 'internal:role=button[name=\"Submit\"i]',
      locator: 'getByRole(\'button\', { name: \'Submit\' })',
    }, {
      selector: 'internal:role=button[name=\"Submit\"i]',
      locator: 'getByRole(\'button\', { name: \'Submit\' })',
    },
  ]);

  // No events after mode disabled
  await backend.setRecorderMode({ mode: 'none' });
  await page.locator('body').click();
  expect(events).toHaveLength(2);
});

test('should report pages', async ({ backend, connectedBrowser }) => {
  const events = [];
  backend.on('stateChanged', event => events.push(event));
  await backend.setReportStateChanged({ enabled: true });

  const context = await connectedBrowser._newContextForReuse();
  const page1 = await context.newPage();
  const page2 = await context.newPage();
  await page1.close();
  await page2.close();

  await backend.setReportStateChanged({ enabled: false });
  const page3 = await context.newPage();
  await page3.close();

  expect(events).toEqual([
    {
      pageCount: 1,
    }, {
      pageCount: 2,
    }, {
      pageCount: 1,
    }, {
      pageCount: 0,
    }
  ]);
});

test('should navigate all', async ({ backend, connectedBrowser }) => {
  const context = await connectedBrowser._newContextForReuse();
  const page1 = await context.newPage();
  const page2 = await context.newPage();

  await backend.navigate({ url: 'data:text/plain,Hello world' });

  expect(await page1.evaluate(() => window.location.href)).toBe('data:text/plain,Hello world');
  expect(await page2.evaluate(() => window.location.href)).toBe('data:text/plain,Hello world');
});

test('should reset for reuse', async ({ backend, connectedBrowser }) => {
  const context = await connectedBrowser._newContextForReuse();
  const page1 = await context.newPage();
  const page2 = await context.newPage();
  await backend.navigate({ url: 'data:text/plain,Hello world' });

  const context2 = await connectedBrowser._newContextForReuse();
  expect(await context2.pages()[0].evaluate(() => window.location.href)).toBe('about:blank');
  expect(await page1.evaluate(() => window.location.href)).toBe('about:blank');
  expect(await page2.evaluate(() => window.location.href).catch(e => e.message)).toContain('Target page, context or browser has been closed');
});

test('should highlight all', async ({ backend, connectedBrowser }) => {
  const context = await connectedBrowser._newContextForReuse();
  const page1 = await context.newPage();
  const page2 = await context.newPage();
  await backend.navigate({ url: 'data:text/html,<button>Submit</button>' });
  await backend.highlight({ selector: 'button' });
  await expect(page1.getByText('locator(\'button\')')).toBeVisible();
  await expect(page2.getByText('locator(\'button\')')).toBeVisible();
  await backend.hideHighlight();
  await expect(page1.getByText('locator(\'button\')')).toBeHidden({ timeout: 1000000 });
  await expect(page2.getByText('locator(\'button\')')).toBeHidden();
});

test('should record', async ({ backend, connectedBrowser }) => {
  const events = [];
  backend.on('sourceChanged', event => events.push(event));

  await backend.setRecorderMode({ mode: 'recording' });

  const context = await connectedBrowser._newContextForReuse();
  const [page] = context.pages();

  await page.setContent('<button>Submit</button>');
  await page.getByRole('button').click();

  await expect.poll(() => events[events.length - 1]).toEqual({
    header: `import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {`,
    footer: `});`,
    actions: [
      `  await page.goto('about:blank');`,
      `  await page.getByRole('button', { name: 'Submit' }).click();`,
    ],
    text: `import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('about:blank');
  await page.getByRole('button', { name: 'Submit' }).click();
});`
  });
  const length = events.length;
  // No events after mode disabled
  await backend.setRecorderMode({ mode: 'none' });
  await page.getByRole('button').click();
  expect(events).toHaveLength(length);
});

test('should record with the same browser if triggered with the same options', async ({ backend, connectedBrowser }) => {
  // This test emulates when the user records a test, stops recording, and then records another test with the same browserName/launchOptions/contextOptions

  const events = [];
  backend.on('sourceChanged', event => events.push(event));

  // 1. Start Recording
  await backend.setRecorderMode({ mode: 'recording' });
  const context = await connectedBrowser._newContextForReuse();
  expect(context.pages().length).toBe(1);

  // 2. Record a click action.
  const page = context.pages()[0];
  await page.setContent('<button>Submit</button>');
  await page.getByRole('button').click();

  // 3. Stop recording.
  await backend.setRecorderMode({ mode: 'none' });

  // 4. Start recording again.
  await backend.setRecorderMode({ mode: 'recording' });
  expect(context.pages().length).toBe(1);

  // 5. Record another click action.
  await page.getByRole('button').click();

  // 4. Expect the click action to be recorded.
  await expect.poll(() => events[events.length - 1]).toEqual({
    header: `import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {`,
    footer: `});`,
    actions: [
      `  await page.getByRole('button', { name: 'Submit' }).click();`,
    ],
    text: `import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.getByRole('button', { name: 'Submit' }).click();
});`
  });
});

test('should record with a new browser if triggered with different browserName', async ({ wsEndpoint, playwright, backend }) => {
  // This test emulates when the user records a test, stops recording, and then records another test with a different browserName

  const events = [];
  backend.on('sourceChanged', event => events.push(event));

  // 1. Start Recording
  const browser1 = await playwright.chromium.connect(wsEndpoint, {
    headers: {
      'x-playwright-reuse-context': '1',
    }
  }) as BrowserWithReuse;
  await backend.setRecorderMode({ mode: 'recording' });

  // 2. Record a click action.
  {
    const context = await browser1._newContextForReuse();
    expect(context.pages().length).toBe(1);
    const page = context.pages()[0];
    await page.setContent('<button>Submit</button>');
    await page.getByRole('button').click();
    expect(page.context().browser().browserType().name()).toBe('chromium');
  }

  // 3. Stop recording.
  await backend.setRecorderMode({ mode: 'none' });

  // 4. Start recording again with a different browserName.
  await backend.setRecorderMode({ mode: 'recording', browserName: 'firefox' });

  // 5. Record another click action.
  {
    expect(browser1.isConnected()).toBe(false);
    const browser = await playwright.firefox.connect(wsEndpoint, {
      headers: {
        'x-playwright-reuse-context': '1',
      }
    }) as BrowserWithReuse;
    expect(browser.browserType().name()).toBe('firefox');
    const context = await browser._newContextForReuse();
    const page = context.pages()[0];
    await page.setContent('<button>Submit</button>');
    await page.getByRole('button').click();
  }

  // 6. Expect the click action to be recorded.
  await expect.poll(() => events[events.length - 1]).toEqual({
    header: `import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {`,
    footer: `});`,
    actions: [
      "  await page.goto('about:blank');",
      `  await page.getByRole('button', { name: 'Submit' }).click();`,
    ],
    text: `import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('about:blank');
  await page.getByRole('button', { name: 'Submit' }).click();
});`
  });
});

test('should record with same browser but re-applied context options if triggered with different contextOptions', async ({ playwright, wsEndpoint, backend,  }) => {
  // This test emulates when the user records a test, stops recording, and then records another test with different contextOptions

  const events = [];
  backend.on('sourceChanged', event => events.push(event));

  // 1. Start Recording
  await backend.setRecorderMode({ mode: 'recording' });
  const browser = await playwright.chromium.connect(wsEndpoint, {
    headers: {
      'x-playwright-reuse-context': '1',
    }
  }) as BrowserWithReuse;
  const context = await browser._newContextForReuse({ userAgent: 'hello 123', viewport: { width: 1111, height: 1111 } });
  expect(context.pages().length).toBe(1);

  // 2. Record a click action.
  const page = context.pages()[0];
  await page.setContent('<button>Submit</button>');
  await page.getByRole('button').click();
  expect(await page.evaluate(() => window.innerWidth)).toBe(1111);
  expect(await page.evaluate(() => window.innerHeight)).toBe(1111);
  expect(await page.evaluate(() => navigator.userAgent)).toBe('hello 123');

  // 3. Stop recording.
  await backend.setRecorderMode({ mode: 'none' });

  // 4. Start recording again with different contextOptions.
  await backend.setRecorderMode({ mode: 'recording', contextOptions: { userAgent: 'hello 345', viewport: { width: 500, height: 500 } } });
  expect(context.pages().length).toBe(1);
  expect(await page.evaluate(() => window.innerWidth)).toBe(500);
  expect(await page.evaluate(() => window.innerHeight)).toBe(500);
  expect(await page.evaluate(() => navigator.userAgent)).toBe('hello 345');

  // 5. Record another click action.
  await page.getByRole('button').click();

  // 6. Expect the click action to be recorded.
  await expect.poll(() => events[events.length - 1]).toEqual({
    header: `import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {`,
    footer: `});`,
    actions: [
      `  await page.getByRole('button', { name: 'Submit' }).click();`,
    ],
    text: `import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.getByRole('button', { name: 'Submit' }).click();
});`
  });
});

test('should record custom data-testid', async ({ backend, connectedBrowser }) => {
  // This test emulates "record at cursor" functionality
  // with custom test id attribute in the config.

  const events = [];
  backend.on('sourceChanged', event => events.push(event));
  // 1. "Show browser" (or "run test").
  {
    const page = await connectedBrowser._newContextForReuse().then(context => context.newPage());
    await page.setContent(`<div data-custom-id='one'>One</div>`);
  }
  // 2. "Record at cursor".
  await backend.setRecorderMode({ mode: 'recording', testIdAttributeName: 'data-custom-id' });

  // 3. Record a click action.
  {
    const page = (connectedBrowser.contexts())[0].pages()[0];
    await page.locator('div').click();
  }

  // 4. Expect "getByTestId" locator.
  await expect.poll(() => events[events.length - 1]).toEqual({
    header: `import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {`,
    footer: `});`,
    actions: [
      `  await page.getByTestId('one').click();`,
    ],
    text: `import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.getByTestId('one').click();
});`
  });
});

test('should reset routes before reuse', async ({ server, connectedBrowserFactory }) => {
  const browser1 = await connectedBrowserFactory();
  const context1 = await browser1._newContextForReuse();
  await context1.route(server.PREFIX + '/title.html', route => route.fulfill({ body: '<title>Hello</title>', contentType: 'text/html' }));
  const page1 = await context1.newPage();
  await page1.route(server.PREFIX + '/consolelog.html', route => route.fulfill({ body: '<title>World</title>', contentType: 'text/html' }));

  await page1.goto(server.PREFIX + '/title.html');
  await expect(page1).toHaveTitle('Hello');
  await page1.goto(server.PREFIX + '/consolelog.html');
  await expect(page1).toHaveTitle('World');
  await browser1.close();

  const browser2 = await connectedBrowserFactory();
  const context2 = await browser2._newContextForReuse();
  const page2 = await context2.newPage();

  await page2.goto(server.PREFIX + '/title.html');
  await expect(page2).toHaveTitle('Woof-Woof');
  await page2.goto(server.PREFIX + '/consolelog.html');
  await expect(page2).toHaveTitle('console.log test');
  await browser2.close();
});
