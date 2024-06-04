import { test, expect } from '@playwright/experimental-ct-react';
import Fetcher from '@/components/Fetcher';
import { http, HttpResponse, passthrough, bypass } from 'msw';
import httpServer from 'http';
import type net from 'net';

test('should handle requests', async ({ page, mount, msw }) => {
  let respond: (() => void) = () => {};
  const promise = new Promise<void>(f => respond = f);

  let postReceived: ((body: string) => void) = () => {};
  const postBody = new Promise<string>(f => postReceived = f);

  await msw.use(
    http.get('/data.json', async () => {
      await promise;
      return HttpResponse.json({ name: 'John Doe' });
    }),
    http.post('/post', async ({ request }) => {
      postReceived(await request.text());
      return HttpResponse.text('ok');
    }),
  );

  const component = await mount(<Fetcher />);
  await expect(component.getByTestId('name')).toHaveText('<none>');

  respond();
  await expect(component.getByTestId('name')).toHaveText('John Doe');

  await component.getByRole('button', { name: 'Post it' }).click();
  expect(await postBody).toBe('hello from the page');
});

test('should add dynamically', async ({ page, mount, msw }) => {
  await page.context().route('**/data.json', async route => {
    await route.fulfill({ body: JSON.stringify({ name: '<original>' }) });
  });

  const component = await mount(<Fetcher />);
  await expect(component.getByTestId('name')).toHaveText('<original>');

  await msw.use(
    http.get('/data.json', async () => {
      return HttpResponse.json({ name: 'John Doe' });
    }),
  );

  await component.getByRole('button', { name: 'Reset' }).click();
  await expect(component.getByTestId('name')).toHaveText('John Doe');
});

test('should passthrough', async ({ page, mount, msw }) => {
  await page.context().route('**/data.json', async route => {
    await route.fulfill({ body: JSON.stringify({ name: '<original>' }) });
  });

  await msw.use(
    http.get('/data.json', async () => {
      return passthrough();
    }),
  );

  const component = await mount(<Fetcher />);
  await expect(component.getByTestId('name')).toHaveText('<error>');
});

test('should fallback when nothing is returned', async ({ page, mount, msw }) => {
  await page.context().route('**/data.json', async route => {
    await route.fulfill({ body: JSON.stringify({ name: '<original>' }) });
  });

  let called = false;
  await msw.use(
    http.get('/data.json', async () => {
      called = true;
    }),
  );

  const component = await mount(<Fetcher />);
  await expect(component.getByTestId('name')).toHaveText('<original>');
  expect(called).toBe(true);
});

test('should bypass(request)', async ({ page, mount, msw }) => {
  await page.context().route('**/data.json', async route => {
    await route.fulfill({ body: JSON.stringify({ name: `<original>` }) });
  });

  await msw.use(
    http.get('/data.json', async ({ request }) => {
      return await fetch(bypass(request));
    }),
  );

  const component = await mount(<Fetcher />);
  await expect(component.getByTestId('name')).toHaveText('<error>');
});

test('should bypass(url) and get cookies', async ({ page, mount, msw, browserName }) => {
  let cookie = '';
  const server = new httpServer.Server();
  server.on('request', (req, res) => {
    cookie = req.headers['cookie']!;
    res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ name: '<server>' }));
  });
  await new Promise<void>(f => server.listen(0, f));
  const port = (server.address() as net.AddressInfo).port;

  await page.context().route('**/data.json', async route => {
    await route.fulfill({ body: JSON.stringify({ name: `<original>` }) });
  });

  const component = await mount(<Fetcher />);
  await expect(component.getByTestId('name')).toHaveText('<original>');

  await page.evaluate(() => document.cookie = 'foo=bar');
  await msw.use(
    http.get('/data.json', async ({ request }) => {
      if (browserName !== 'webkit') {
        // WebKit does not have cookies while intercepting.
        expect(request.headers.get('cookie')).toBe('foo=bar');
      }
      return await fetch(bypass(`http://localhost:${port}`));
    }),
  );
  await component.getByRole('button', { name: 'Reset' }).click();
  await expect(component.getByTestId('name')).toHaveText('<server>');

  expect(cookie).toBe('foo=bar');
  await new Promise(f => server.close(f));
});

test('should ignore navigation requests', async ({ page, mount, msw }) => {
  await page.context().route('**/newpage', async route => {
    await route.fulfill({ body: `<div>original</div>`, contentType: 'text/html' });
  });

  await msw.use(
    http.get('/newpage', async ({ request }) => {
      return new Response(`<div>intercepted</div>`, {
        headers: new Headers({ 'Content-Type': 'text/html' }),
      });
    }),
  );

  await mount(<div />);
  await page.goto('/newpage');
  await expect(page.locator('div')).toHaveText('original');
});

test('should throw when calling fetch(bypass) outside of a handler', async ({ page, msw, baseURL }) => {
  await msw.use(
    http.get('/data.json', async () => {
    }),
  );

  const error = await fetch(bypass(baseURL + '/hello')).catch(e => e);
  expect(error.message).toContain(`Cannot call fetch(bypass()) outside of a request handler`);
});
