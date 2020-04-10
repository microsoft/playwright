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

const fs = require('fs');
const path = require('path');
const {FFOX, CHROMIUM, WEBKIT, defaultBrowserOptions} = require('./utils').testOptions(browserType);

describe('Download', function() {
  beforeEach(async(state) => {
    state.server.setRoute('/download', (req, res) => {
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', 'attachment');
      res.end(`Hello world`);
    });
  });

  it('should report downloads with acceptDownloads: false', async({page, server}) => {
    await page.setContent(`<a download=true href="${server.PREFIX}/download">download</a>`);
    const [ download ] = await Promise.all([
      page.waitForEvent('download'),
      page.click('a')
    ]);
    let error;
    expect(download.url()).toBe(`${server.PREFIX}/download`);
    await download.path().catch(e => error = e);
    expect(await download.failure()).toContain('acceptDownloads');
    expect(error.message).toContain('acceptDownloads: true');
  });
  it('should report downloads with acceptDownloads: true', async({browser, server}) => {
    const page = await browser.newPage({ acceptDownloads: true });
    await page.setContent(`<a download=true href="${server.PREFIX}/download">download</a>`);
    const [ download ] = await Promise.all([
      page.waitForEvent('download'),
      page.click('a')
    ]);
    const path = await download.path();
    expect(fs.existsSync(path)).toBeTruthy();
    expect(fs.readFileSync(path).toString()).toBe('Hello world');
    await page.close();
  });
  it('should delete file', async({browser, server}) => {
    const page = await browser.newPage({ acceptDownloads: true });
    await page.setContent(`<a download=true href="${server.PREFIX}/download">download</a>`);
    const [ download ] = await Promise.all([
      page.waitForEvent('download'),
      page.click('a')
    ]);
    const path = await download.path();
    expect(fs.existsSync(path)).toBeTruthy();
    await download.delete();
    expect(fs.existsSync(path)).toBeFalsy();
    await page.close();
  });
  it('should expose stream', async({browser, server}) => {
    const page = await browser.newPage({ acceptDownloads: true });
    await page.setContent(`<a download=true href="${server.PREFIX}/download">download</a>`);
    const [ download ] = await Promise.all([
      page.waitForEvent('download'),
      page.click('a')
    ]);
    const stream = await download.createReadStream();
    let content = '';
    stream.on('data', data => content += data.toString());
    await new Promise(f => stream.on('end', f));
    expect(content).toBe('Hello world');
    stream.close();
    await page.close();
  });
  it('should delete downloads on context destruction', async({browser, server}) => {
    const page = await browser.newPage({ acceptDownloads: true });
    await page.setContent(`<a download=true href="${server.PREFIX}/download">download</a>`);
    const [ download1 ] = await Promise.all([
      page.waitForEvent('download'),
      page.click('a')
    ]);
    const [ download2 ] = await Promise.all([
      page.waitForEvent('download'),
      page.click('a')
    ]);
    const path1 = await download1.path();
    const path2 = await download2.path();
    expect(fs.existsSync(path1)).toBeTruthy();
    expect(fs.existsSync(path2)).toBeTruthy();
    await page.context().close();
    expect(fs.existsSync(path1)).toBeFalsy();
    expect(fs.existsSync(path2)).toBeFalsy();
  });
  it('should delete downloads on browser gone', async ({ server, browserType }) => {
    const browser = await browserType.launch(defaultBrowserOptions);
    const page = await browser.newPage({ acceptDownloads: true });
    await page.setContent(`<a download=true href="${server.PREFIX}/download">download</a>`);
    const [ download1 ] = await Promise.all([
      page.waitForEvent('download'),
      page.click('a')
    ]);
    const [ download2 ] = await Promise.all([
      page.waitForEvent('download'),
      page.click('a')
    ]);
    const path1 = await download1.path();
    const path2 = await download2.path();
    expect(fs.existsSync(path1)).toBeTruthy();
    expect(fs.existsSync(path2)).toBeTruthy();
    await browser.close();
    expect(fs.existsSync(path1)).toBeFalsy();
    expect(fs.existsSync(path2)).toBeFalsy();
    expect(fs.existsSync(path.join(path1, '..'))).toBeFalsy();
  });
});
