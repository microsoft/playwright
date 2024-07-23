import { test, expect } from '@playwright/experimental-ct-react';
import TitleWithFont from '@/components/TitleWithFont';
import Fetcher from '@/components/Fetcher';
import { http, HttpResponse, passthrough, bypass } from 'msw';
import httpServer from 'http';
import type net from 'net';

test('should load font without routes', async ({ mount, page }) => {
  const promise = page.waitForEvent('requestfinished', request => request.url().includes('iconfont'));
  await mount(<TitleWithFont />);
  const request = await promise;
  const response = await request.response();
  const body = await response!.body();
  expect(body.length).toBe(2656);
});

test('should load font with routes', async ({ mount, page }) => {
  test.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/27294' });
  await page.route('**/*.json', r => r.continue());
  const promise = page.waitForEvent('requestfinished', request => request.url().includes('iconfont'));
  await mount(<TitleWithFont />);
  const request = await promise;
  const response = await request.response();
  const body = await response!.body();
  expect(body.length).toBe(2656);
});

test.describe('request handlers', () => {
  test('should handle requests', async ({ page, mount, router }) => {
    let respond: (() => void) = () => {};
    const promise = new Promise<void>(f => respond = f);

    let postReceived: ((body: string) => void) = () => {};
    const postBody = new Promise<string>(f => postReceived = f);

    await router.use(
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

  test('should add dynamically', async ({ page, mount, router }) => {
    await router.route('**/data.json', async route => {
      await route.fulfill({ body: JSON.stringify({ name: '<original>' }) });
    });

    const component = await mount(<Fetcher />);
    await expect(component.getByTestId('name')).toHaveText('<original>');

    await router.use(
      http.get('/data.json', async () => {
        return HttpResponse.json({ name: 'John Doe' });
      }),
    );

    await component.getByRole('button', { name: 'Reset' }).click();
    await expect(component.getByTestId('name')).toHaveText('John Doe');
  });

  test('should passthrough', async ({ page, mount, router }) => {
    await router.route('**/data.json', async route => {
      await route.fulfill({ body: JSON.stringify({ name: '<original>' }) });
    });

    await router.use(
      http.get('/data.json', async () => {
        return passthrough();
      }),
    );

    const component = await mount(<Fetcher />);
    await expect(component.getByTestId('name')).toHaveText('<error>');
  });

  test('should fallback when nothing is returned', async ({ page, mount, router }) => {
    await router.route('**/data.json', async route => {
      await route.fulfill({ body: JSON.stringify({ name: '<original>' }) });
    });

    let called = false;
    await router.use(
      http.get('/data.json', async () => {
        called = true;
      }),
    );

    const component = await mount(<Fetcher />);
    await expect(component.getByTestId('name')).toHaveText('<original>');
    expect(called).toBe(true);
  });

  test('should bypass(request)', async ({ page, mount, router }) => {
    await router.route('**/data.json', async route => {
      await route.fulfill({ body: JSON.stringify({ name: `<original>` }) });
    });

    await router.use(
      http.get('/data.json', async ({ request }) => {
        return await fetch(bypass(request));
      }),
    );

    const component = await mount(<Fetcher />);
    await expect(component.getByTestId('name')).toHaveText('<error>');
  });

  test('should bypass(url) and get cookies', async ({ page, mount, router, browserName }) => {
    let cookie = '';
    const server = new httpServer.Server();
    server.on('request', (req, res) => {
      cookie = req.headers['cookie']!;
      res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ name: '<server>' }));
    });
    await new Promise<void>(f => server.listen(0, f));
    const port = (server.address() as net.AddressInfo).port;

    await router.route('**/data.json', async route => {
      await route.fulfill({ body: JSON.stringify({ name: `<original>` }) });
    });

    const component = await mount(<Fetcher />);
    await expect(component.getByTestId('name')).toHaveText('<original>');

    await page.evaluate(() => document.cookie = 'foo=bar');
    await router.use(
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

  test('should ignore navigation requests', async ({ page, mount, router }) => {
    await router.route('**/newpage', async route => {
      await route.fulfill({ body: `<div>original</div>`, contentType: 'text/html' });
    });

    await router.use(
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

  test('should throw when calling fetch(bypass) outside of a handler', async ({ page, router, baseURL }) => {
    await router.use(http.get('/data.json', async () => {}));

    const error = await fetch(bypass(baseURL + '/hello')).catch(e => e);
    expect(error.message).toContain(`Cannot call fetch(bypass()) outside of a request handler`);
  });

});

