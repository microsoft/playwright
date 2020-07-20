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

const socks = require('socksv5');
const utils = require('./utils');
const {FFOX, CHROMIUM, WEBKIT, MAC} = testOptions;

describe('HTTP Proxy', () => {
  it('should use proxy', async ({browserType, server}) => {
    server.setRoute('/target.html', async (req, res) => {
      res.end('<html><title>Served by the proxy</title></html>');
    });
    const browser = await browserType.launch({
      proxy: { server: `localhost:${server.PORT}` }
    });
    const page = await browser.newPage();
    await page.goto('http://non-existent.com/target.html');
    expect(await page.title()).toBe('Served by the proxy');
    await browser.close();
  });

  it('should authenticate', async ({browserType, server}) => {
    server.setRoute('/target.html', async (req, res) => {
      const auth = req.headers['proxy-authorization'];
      if (!auth) {
        res.writeHead(407, 'Proxy Authentication Required', {
          'Proxy-Authenticate': 'Basic realm="Access to internal site"'
        });
        res.end();  
      } else {
        res.end(`<html><title>${auth}</title></html>`);
      }
    });
    const browser = await browserType.launch({
      proxy: { server: `localhost:${server.PORT}`, username: 'user', password: 'secret' }
    });
    const page = await browser.newPage();
    await page.goto('http://non-existent.com/target.html');
    expect(await page.title()).toBe('Basic ' + Buffer.from('user:secret').toString('base64'));
    await browser.close();
  });

  it('should exclude patterns', async ({browserType, server}) => {
    server.setRoute('/target.html', async (req, res) => {
      res.end('<html><title>Served by the proxy</title></html>');
    });
    const browser = await browserType.launch({
      proxy: { server: `localhost:${server.PORT}`, bypass: 'non-existent1.com, .non-existent2.com, .zone' }
    });

    const page = await browser.newPage();
    await page.goto('http://non-existent.com/target.html');
    expect(await page.title()).toBe('Served by the proxy');

    {
      const error = await page.goto('http://non-existent1.com/target.html').catch(e => e);
      expect(error.message).toBeTruthy();
    }

    {
      const error = await page.goto('http://sub.non-existent2.com/target.html').catch(e => e);
      expect(error.message).toBeTruthy();
    }

    {
      const error = await page.goto('http://foo.zone/target.html').catch(e => e);
      expect(error.message).toBeTruthy();
    }

    await browser.close();
  });
});

describe('SOCKS Proxy', () => {
  it('should use proxy', async ({ browserType, parallelIndex }) => {
    const server = socks.createServer((info, accept, deny) => {
      if (socket = accept(true)) {
        const body = '<html><title>Served by the SOCKS proxy</title></html>';
        socket.end([
          'HTTP/1.1 200 OK',
          'Connection: close',
          'Content-Type: text/html',
          'Content-Length: ' + Buffer.byteLength(body),
          '',
          body
        ].join('\r\n'));
      }
    });
    const socksPort = 9107 + parallelIndex * 2;
    server.listen(socksPort, 'localhost');
    server.useAuth(socks.auth.None());

    const browser = await browserType.launch({
      proxy: { server: `socks5://localhost:${socksPort}` }
    });
    const page = await browser.newPage();
    await page.goto('http://non-existent.com');
    expect(await page.title()).toBe('Served by the SOCKS proxy');
    await browser.close();
    server.close();
  });
});
