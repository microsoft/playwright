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
import { test, expect } from './npmTest';
import http from 'http';
import net from 'net';
import type { AddressInfo } from 'net';

const CDNS = [
  'https://cdn.playwright.dev/dbazure/download/playwright', // ESRP
  'https://playwright.download.prss.microsoft.com/dbazure/download/playwright', // ESRP Fallback
  'https://cdn.playwright.dev',
];

const DL_STAT_BLOCK = /^.*from url: (.*)$\n^.*to location: (.*)$\n^.*response status code: (.*)$\n^.*total bytes: (\d+)$\n^.*download complete, size: (\d+)$\n^.*SUCCESS downloading (\w+) .*$/gm;

const parsedDownloads = (rawLogs: string) => {
  const out: { url: string, status: number, name: string }[] = [];
  for (const match of rawLogs.matchAll(DL_STAT_BLOCK)) {
    const [, url, /* filepath */, status, /* size */, /* receivedBytes */, name] = match;
    out.push({ url, status: Number.parseInt(status, 10), name: name.toLocaleLowerCase() });
  }
  return out;
};

test.use({ isolateBrowsers: true });

const extraInstalledSoftware = process.platform === 'win32' ? ['winldd' as const] : [];

for (const cdn of CDNS) {
  test(`playwright cdn failover should work (${cdn})`, async ({ exec, checkInstalledSoftwareOnDisk }) => {
    await exec('npm i playwright');
    const result = await exec('npx playwright install', { env: { PW_TEST_CDN_THAT_SHOULD_WORK: cdn, DEBUG: 'pw:install' } });
    expect(result).toHaveLoggedSoftwareDownload(['chromium', 'chromium-headless-shell', 'ffmpeg', 'firefox', 'webkit', ...extraInstalledSoftware]);
    await checkInstalledSoftwareOnDisk((['chromium', 'chromium-headless-shell', 'ffmpeg', 'firefox', 'webkit', ...extraInstalledSoftware]));
    const dls = parsedDownloads(result);
    for (const software of ['chromium', 'ffmpeg', 'firefox', 'webkit'])
      expect(dls).toContainEqual({ status: 200, name: software, url: expect.stringContaining(cdn) });
    await exec('node sanity.js playwright chromium firefox webkit');
    await exec('node esm-playwright.mjs');
  });
}

test(`playwright cdn should race with a timeout`, async ({ exec }) => {
  const server = http.createServer(() => {});
  await new Promise<void>(resolve => server.listen(0, resolve));
  try {
    await exec('npm i playwright');
    const result = await exec('npx playwright install', {
      env: {
        PLAYWRIGHT_DOWNLOAD_HOST: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
        DEBUG: 'pw:install',
        PLAYWRIGHT_DOWNLOAD_CONNECTION_TIMEOUT: '1000',
      },
      expectToExitWithError: true
    });
    expect(result).toContain(`timed out after 1000ms`);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test(`playwright cdn should not timeout on redirect`, {
  annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/34686' }
}, async ({ exec }) => {
  const server = http.createServer(async (req, res) => {
    if (req.url !== '/foo.zip') {
      res.writeHead(307, {
        'Connection': 'keep-alive',
        'location': `http://127.0.0.1:${(server.address() as AddressInfo).port}/foo.zip`,
      });
      res.flushHeaders();
      // Keep the connection open, the client is expected to close it.
      return;
    }
    const emptyZip = Buffer.from([
      0x50, 0x4B, 0x05, 0x06, // EOCD
      0x00, 0x00,             // Disk number
      0x00, 0x00,             // Central dir start disk
      0x00, 0x00,             // Central dir records on this disk
      0x00, 0x00,             // Total central dir records
      0x00, 0x00, 0x00, 0x00, // Central dir size
      0x00, 0x00, 0x00, 0x00, // Offset of start of central dir
      0x00, 0x00              // ZIP comment length
    ]);
    res.socket.setNoDelay(true);
    res.writeHead(200, {
      'Content-Type': 'application/zip',
      'Content-Disposition': 'attachment; filename="empty.zip"',
      'Content-Length': emptyZip.length,
    });
    res.flushHeaders();
    // Send one byte at a time in small intervals (< 1000ms) during 2 seconds
    // to keep the second connection slow but alive.
    for (let i = 0; i < emptyZip.length; i ++) {
      res.write(emptyZip.subarray(i, i + 1));
      await new Promise(resolve => setTimeout(resolve, 2000 / emptyZip.length));
    }
    res.end();
  });
  await new Promise<void>(resolve => server.listen(0, resolve));

  try {
    await exec('npm i playwright');
    const result = await exec('npx playwright install chromium', {
      env: {
        PLAYWRIGHT_DOWNLOAD_HOST: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
        DEBUG: 'pw:install',
        PLAYWRIGHT_DOWNLOAD_CONNECTION_TIMEOUT: '1000',
      },
      expectToExitWithError: true
    });
    // Steps after the extraction will fail, but the download should succeed without timeouts.
    expect(result).toContain(`pw:install SUCCESS downloading Chromium`);
    expect(result).not.toContain(`timed out after 1000ms`);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test(`npx playwright install should not hang when CDN closes the connection`, async ({ exec }) => {
  let retryCount = 0;
  const server = http.createServer((req, res) => {
    ++retryCount;
    res.writeHead(200, {
      'Content-Length': 100 * 1024 * 1024,
      'Content-Type': 'application/zip',
    });
    res.end('a');
  });
  await new Promise<void>(resolve => server.listen(0, resolve));
  try {
    await exec('npm i playwright');
    const result = await exec('npx playwright install', {
      env: {
        PLAYWRIGHT_DOWNLOAD_HOST: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
        DEBUG: 'pw:install',
      },
      expectToExitWithError: true
    });
    expect(retryCount).toBe(5);
    expect([...result.matchAll(/Download failed: server closed connection/g)]).toHaveLength(5);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test(`npx playwright install should not hang when CDN TCP connection stalls`, async ({ exec }) => {
  let retryCount = 0;
  const socketsToDestroy = [];
  const server = net.createServer(socket => {
    socketsToDestroy.push(socket);
    ++retryCount;
    socket.write('HTTP/1.1 200 OK\r\n');
    socket.write('Content-Length: 100000000\r\n');
    socket.write('Content-Type: application/zip\r\n');
    socket.write('\r\n');
    socket.write('a');
  });
  await new Promise<void>(resolve => server.listen(0, resolve));
  try {
    await exec('npm i playwright');
    const result = await exec('npx playwright install', {
      env: {
        PLAYWRIGHT_DOWNLOAD_HOST: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
        DEBUG: 'pw:install',
        PLAYWRIGHT_DOWNLOAD_CONNECTION_TIMEOUT: '1000',
      },
      expectToExitWithError: true
    });
    expect(retryCount).toBe(5);
    expect([...result.matchAll(/timed out after/g)]).toHaveLength(5);
  } finally {
    for (const socket of socketsToDestroy)
      socket.destroy();
    await new Promise(resolve => server.close(resolve));
  }
});
