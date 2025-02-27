/**
 * Copyright 2017 Google Inc. All rights reserved.
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

import { test, expect } from './pageTest';
import { attachFrame } from '../config/utils';

import fs from 'fs';
import formidable from 'formidable';

test('should upload multiple large files', async ({ page, server, isAndroid, isWebView2, mode }, testInfo) => {
  test.skip(isAndroid);
  test.skip(isWebView2);
  test.skip(mode.startsWith('service'));
  test.slow();

  const filesCount = 10;
  await page.goto(server.PREFIX + '/input/fileupload-multi.html');
  const uploadFile = testInfo.outputPath('50MB_1.zip');
  const str = 'A'.repeat(1024);
  const stream = fs.createWriteStream(uploadFile);
  // 49 is close to the actual limit
  for (let i = 0; i < 49 * 1024; i++) {
    await new Promise<void>((fulfill, reject) => {
      stream.write(str, err => {
        if (err)
          reject(err);
        else
          fulfill();
      });
    });
  }
  await new Promise(f => stream.end(f));
  const input = page.locator('input[type="file"]');
  const uploadFiles = [uploadFile];
  for (let i = 2; i <= filesCount; i++) {
    const dstFile = testInfo.outputPath(`50MB_${i}.zip`);
    fs.copyFileSync(uploadFile, dstFile);
    uploadFiles.push(dstFile);
  }
  const fileChooserPromise = page.waitForEvent('filechooser');
  await input.click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(uploadFiles);
  const filesLen = await page.evaluate('document.getElementsByTagName("input")[0].files.length');
  expect(fileChooser.isMultiple()).toBe(true);
  expect(filesLen).toEqual(filesCount);
  await Promise.all(uploadFiles.map(path => fs.promises.unlink(path)));
});

test('should emit event once', async ({ page, server }) => {
  await page.setContent(`<input type=file>`);
  const [chooser] = await Promise.all([
    new Promise(f => page.once('filechooser', f)),
    page.click('input'),
  ]);
  expect(chooser).toBeTruthy();
});

test('should emit event via prepend', async ({ page, server }) => {
  await page.setContent(`<input type=file>`);
  const [chooser] = await Promise.all([
    new Promise(f => page.prependListener('filechooser', f)),
    page.click('input'),
  ]);
  expect(chooser).toBeTruthy();
});

test('should emit event for iframe', async ({ page, server }) => {
  const frame = await attachFrame(page, 'frame1', server.EMPTY_PAGE);
  await frame.setContent(`<input type=file>`);
  const [chooser] = await Promise.all([
    new Promise(f => page.once('filechooser', f)),
    frame.click('input'),
  ]);
  expect(chooser).toBeTruthy();
});

test('should emit event on/off', async ({ page, server }) => {
  await page.setContent(`<input type=file>`);
  const [chooser] = await Promise.all([
    new Promise(f => {
      const listener = chooser => {
        page.off('filechooser', listener);
        f(chooser);
      };
      page.on('filechooser', listener);
    }),
    page.click('input'),
  ]);
  expect(chooser).toBeTruthy();
});

test('should emit event addListener/removeListener', async ({ page, server }) => {
  await page.setContent(`<input type=file>`);
  const [chooser] = await Promise.all([
    new Promise(f => {
      const listener = chooser => {
        page.removeListener('filechooser', listener);
        f(chooser);
      };
      page.addListener('filechooser', listener);
    }),
    page.click('input'),
  ]);
  expect(chooser).toBeTruthy();
});

test('should work when file input is attached to DOM', async ({ page, server }) => {
  await page.setContent(`<input type=file>`);
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.click('input'),
  ]);
  expect(chooser).toBeTruthy();
});

test('should work when file input is not attached to DOM', async ({ page, asset }) => {
  const [, content] = await Promise.all([
    page.waitForEvent('filechooser').then(chooser => chooser.setFiles(asset('file-to-upload.txt'))),
    page.evaluate(async () => {
      const el = document.createElement('input');
      el.type = 'file';
      el.click();
      await new Promise(x => el.oninput = x);
      const reader = new FileReader();
      const promise = new Promise(fulfill => reader.onload = fulfill);
      reader.readAsText(el.files[0]);
      return promise.then(() => reader.result);
    }),
  ]);
  expect(content).toBe('contents of the file');
});

test('should not throw when filechooser belongs to iframe', async ({ page, server, browserName }) => {
  await page.goto(server.PREFIX + '/frames/one-frame.html');
  const frame = page.mainFrame().childFrames()[0];
  await frame.setContent(`
    <div>Click me</div>
    <script>
      document.querySelector('div').addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.click();
        window.parent.__done = true;
      });
    </script>
  `);
  await Promise.all([
    page.waitForEvent('filechooser'),
    frame.click('div')
  ]);
  await page.waitForFunction(() => (window as any).__done);
});

test('should not throw when frame is detached immediately', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/frames/one-frame.html');
  const frame = page.mainFrame().childFrames()[0];
  await frame.setContent(`
    <div>Click me</div>
    <script>
      document.querySelector('div').addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.click();
        window.parent.__done = true;
        const iframe = window.parent.document.querySelector('iframe');
        iframe.remove();
      });
    </script>
  `);
  page.on('filechooser', () => {});  // To ensure we handle file choosers.
  await frame.click('div');
  await page.waitForFunction(() => (window as any).__done);
});

test('should respect timeout', async ({ page, playwright }) => {
  let error = null;
  await page.waitForEvent('filechooser', { timeout: 1 }).catch(e => error = e);
  expect(error).toBeInstanceOf(playwright.errors.TimeoutError);
});

test('should respect default timeout when there is no custom timeout', async ({ page, playwright }) => {
  page.setDefaultTimeout(1);
  let error = null;
  await page.waitForEvent('filechooser').catch(e => error = e);
  expect(error).toBeInstanceOf(playwright.errors.TimeoutError);
});

test('should prioritize exact timeout over default timeout', async ({ page, playwright }) => {
  page.setDefaultTimeout(0);
  let error = null;
  await page.waitForEvent('filechooser', { timeout: 1 }).catch(e => error = e);
  expect(error).toBeInstanceOf(playwright.errors.TimeoutError);
});

test('should work with no timeout', async ({ page, server }) => {
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser', { timeout: 0 }),
    page.evaluate(() => window.builtins.setTimeout(() => {
      const el = document.createElement('input');
      el.type = 'file';
      el.click();
    }, 50))
  ]);
  expect(chooser).toBeTruthy();
});

test('should return the same file chooser when there are many watchdogs simultaneously', async ({ page, server }) => {
  await page.setContent(`<input type=file>`);
  const [fileChooser1, fileChooser2] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.waitForEvent('filechooser'),
    page.$eval('input', input => input.click()),
  ]);
  expect(fileChooser1 === fileChooser2).toBe(true);
});

test('should accept single file', async ({ page, asset }) => {
  await page.setContent(`<input type=file oninput='javascript:console.timeStamp()'>`);
  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.click('input'),
  ]);
  expect(fileChooser.page()).toBe(page);
  expect(fileChooser.element()).toBeTruthy();
  await fileChooser.setFiles(asset('file-to-upload.txt'));
  expect(await page.$eval('input', input => input.files.length)).toBe(1);
  expect(await page.$eval('input', input => input.files[0].name)).toBe('file-to-upload.txt');
});

// @see https://github.com/microsoft/playwright/issues/4704
test('should not trim big uploaded files', async ({ page, server }) => {

  let files: Record<string, formidable.File>;
  server.setRoute('/upload', async (req, res) => {
    const form = new formidable.IncomingForm();
    form.parse(req, function(err, fields, f) {
      files = f as Record<string, formidable.File>;
      res.end();
    });
  });
  await page.goto(server.EMPTY_PAGE);

  const DATA_SIZE = Math.pow(2, 20);
  await Promise.all([
    page.evaluate(async size => {
      const body = new FormData();
      body.set('file', new Blob([new Uint8Array(size)]));
      await fetch('/upload', { method: 'POST', body });
    }, DATA_SIZE),
    server.waitForRequest('/upload'),
  ]);
  expect(files.file.size).toBe(DATA_SIZE);
});

test('should be able to read selected file', async ({ page, asset }) => {
  await page.setContent(`<input type=file>`);
  const [, content] = await Promise.all([
    page.waitForEvent('filechooser').then(fileChooser => fileChooser.setFiles(asset('file-to-upload.txt'))),
    page.$eval('input', async picker => {
      picker.click();
      await new Promise(x => picker.oninput = x);
      const reader = new FileReader();
      const promise = new Promise(fulfill => reader.onload = fulfill);
      reader.readAsText(picker.files[0]);
      return promise.then(() => reader.result);
    }),
  ]);
  expect(content).toBe('contents of the file');
});

test('should be able to reset selected files with empty file list', async ({ page, asset }) => {
  await page.setContent(`<input type=file>`);
  const [, fileLength1] = await Promise.all([
    page.waitForEvent('filechooser').then(fileChooser => fileChooser.setFiles(asset('file-to-upload.txt'))),
    page.$eval('input', async picker => {
      picker.click();
      await new Promise(x => picker.oninput = x);
      return picker.files.length;
    }),
  ]);
  expect(fileLength1).toBe(1);
  const [, fileLength2] = await Promise.all([
    page.waitForEvent('filechooser').then(fileChooser => fileChooser.setFiles([])),
    page.$eval('input', async picker => {
      picker.click();
      await new Promise(x => picker.oninput = x);
      return picker.files.length;
    }),
  ]);
  expect(fileLength2).toBe(0);
});

test('should work for single file pick', async ({ page, server }) => {
  await page.setContent(`<input type=file>`);
  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.click('input'),
  ]);
  expect(fileChooser.isMultiple()).toBe(false);
});

test('should work for "multiple"', async ({ page, server }) => {
  await page.setContent(`<input multiple type=file>`);
  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.click('input'),
  ]);
  expect(fileChooser.isMultiple()).toBe(true);
});

test('should work for "webkitdirectory"', async ({ page, server }) => {
  await page.setContent(`<input multiple webkitdirectory type=file>`);
  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.click('input'),
  ]);
  expect(fileChooser.isMultiple()).toBe(true);
});

test('should emit event after navigation', async ({ page, server, browserName, browserMajorVersion }) => {
  test.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/11375' });
  test.skip(browserName === 'chromium' && browserMajorVersion < 99);

  const logs = [];
  page.on('filechooser', () => logs.push('filechooser'));
  await page.goto(server.PREFIX + '/empty.html');
  await page.setContent(`<input type=file>`);
  await Promise.all([
    page.waitForEvent('filechooser'),
    page.click('input'),
  ]);
  await page.goto(server.CROSS_PROCESS_PREFIX + '/empty.html');
  await page.setContent(`<input type=file>`);
  await Promise.all([
    page.waitForEvent('filechooser'),
    page.click('input'),
  ]);
  expect(logs).toEqual(['filechooser', 'filechooser']);
});

test('should trigger listener added before navigation', async ({ page, server, browserMajorVersion, isElectron }) => {
  test.skip(isElectron && browserMajorVersion <= 98);
  // Add listener before cross process navigation.
  const chooserPromise = new Promise(f => page.once('filechooser', f));
  await page.goto(server.PREFIX + '/empty.html');
  await page.goto(server.CROSS_PROCESS_PREFIX + '/empty.html');
  await page.setContent(`<input type=file>`);
  const [chooser] = await Promise.all([
    chooserPromise,
    page.click('input'),
  ]);
  expect(chooser).toBeTruthy();
});
