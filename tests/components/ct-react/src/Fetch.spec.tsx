import { test as _test, expect } from '@playwright/experimental-ct-react'
import { Fetch } from './Fetch';
import { serverFixtures } from '../../../../tests/config/serverFixtures';

const test = _test.extend(serverFixtures);

test('components routing should go through context', async ({ mount, context, server }) => {
  server.setRoute('/hello', (req, res) => {
    res.write('served via server');
    res.end();
  });

  let markRouted: (url: string) => void;
  const routedViaContext = new Promise(res => markRouted = res);
  await context.route('**/hello', async (route, request) => {
    markRouted(`${request.method()} ${request.url()}`);
    await route.fulfill({
      body: 'intercepted',
    });
  });

  const whoServedTheRequest = Promise.race([
    server.waitForRequest('/hello').then((req) => `served via server: ${req.method} ${req.url}`),
    routedViaContext.then(req => `served via context: ${req}`),
  ]);

  const component = await mount(<Fetch url={server.PREFIX + '/hello'} />);
  await expect.soft(whoServedTheRequest).resolves.toMatch(/served via context: GET.*\/hello.*/i);
  await expect.soft(component).toHaveText('intercepted');
});
