import { test, expect } from '@playwright/experimental-ct-react17';
import Fetch from '@/components/Fetch';
import DelayedData from '@/components/DelayedData';
import Button from '@/components/Button';
import EmptyFragment from '@/components/EmptyFragment';
const { serverFixtures } = require('../../../../tests/config/serverFixtures');

test('render props', async ({ mount }) => {
  const component = await mount(<Button title="Submit" />);
  await expect(component).toContainText('Submit');
});

test('render attributes', async ({ mount }) => {
  const component = await mount(<Button className="primary" title="Submit" />);
  await expect(component).toHaveClass('primary');
});

test('render delayed data', async ({ mount }) => {
  const component = await mount(<DelayedData data="complete" />);
  await expect(component).toHaveText('complete');
});

test('render an empty component', async ({ mount, page }) => {
  const component = await mount(<EmptyFragment />);
  expect(await page.evaluate(() => 'props' in window && window.props)).toEqual({});
  expect(await component.allTextContents()).toEqual(['']);
  expect(await component.textContent()).toBe('');
  await expect(component).toHaveText('');
});

const testWithServer = test.extend(serverFixtures);
testWithServer(
  'components routing should go through context',
  async ({ mount, context, server }) => {
    server.setRoute('/hello', (req: any, res: any) => {
      res.write('served via server');
      res.end();
    });

    let markRouted: (url: string) => void;
    const routedViaContext = new Promise((res) => (markRouted = res));
    await context.route('**/hello', async (route, request) => {
      markRouted(`${request.method()} ${request.url()}`);
      await route.fulfill({
        body: 'intercepted',
      });
    });

    const whoServedTheRequest = Promise.race([
      server
        .waitForRequest('/hello')
        .then((req: any) => `served via server: ${req.method} ${req.url}`),
      routedViaContext.then((req) => `served via context: ${req}`),
    ]);

    const component = await mount(<Fetch url={server.PREFIX + '/hello'} />);
    await expect
      .soft(whoServedTheRequest)
      .resolves.toMatch(/served via context: GET.*\/hello.*/i);
    await expect.soft(component).toHaveText('intercepted');
  }
);

test('should return 404 if server does not handle the request', async ({ page }) => {
  test.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/23364' });
  const helloPromise = page.waitForResponse('/hello');
  const statusCode = await page.evaluate(async () => {
    const response = await fetch('/hello');
    return response.status;
  });
  expect(statusCode).toBe(404);
  const response = await helloPromise;
  expect(response.status()).toBe(404);
  expect(response.statusText()).toBe('Not Found');
});
