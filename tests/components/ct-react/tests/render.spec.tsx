import { test, expect } from '@playwright/experimental-ct-react';
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

test('get textContent of the empty fragment', async ({ mount }) => {
  const component = await mount(<EmptyFragment />);
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
