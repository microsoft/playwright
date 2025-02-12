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

import path from 'path';
import fs from 'fs';
import formidable from 'formidable';

test('should upload the file', async ({ page, server, asset }) => {
  await page.goto(server.PREFIX + '/input/fileupload.html');
  const filePath = path.relative(process.cwd(), asset('file-to-upload.txt'));
  const input = await page.$('input');
  await input.setInputFiles(filePath);
  expect(await page.evaluate(e => e.files[0].name, input)).toBe('file-to-upload.txt');
  expect(await page.evaluate(e => {
    const reader = new FileReader();
    const promise = new Promise(fulfill => reader.onload = fulfill);
    reader.readAsText(e.files[0]);
    return promise.then(() => reader.result);
  }, input)).toBe('contents of the file');
});

test('should upload a folder', async ({ page, server, browserName, headless, browserMajorVersion, isAndroid, macVersion, isMac }) => {
  test.skip(isAndroid);
  test.skip(browserName === 'webkit' && isMac && macVersion <= 12, 'WebKit on macOS-12 is frozen');

  await page.goto(server.PREFIX + '/input/folderupload.html');
  const input = await page.$('input');
  const dir = path.join(test.info().outputDir, 'file-upload-test');
  {
    await fs.promises.mkdir(dir, { recursive: true });
    await fs.promises.writeFile(path.join(dir, 'file1.txt'), 'file1 content');
    await fs.promises.writeFile(path.join(dir, 'file2'), 'file2 content');
    await fs.promises.mkdir(path.join(dir, 'sub-dir'));
    await fs.promises.writeFile(path.join(dir, 'sub-dir', 'really.txt'), 'sub-dir file content');
  }
  await input.setInputFiles(dir);
  expect(new Set(await page.evaluate(e => [...e.files].map(f => f.webkitRelativePath), input))).toEqual(new Set([
    // Note: this did not work before Chrome 127, see https://issues.chromium.org/issues/345393164.
    'file-upload-test/sub-dir/really.txt',
    'file-upload-test/file1.txt',
    'file-upload-test/file2',
  ]));
  const webkitRelativePaths = await page.evaluate(e => [...e.files].map(f => f.webkitRelativePath), input);
  for (let i = 0; i < webkitRelativePaths.length; i++) {
    const content = await input.evaluate((e, i) => {
      const reader = new FileReader();
      const promise = new Promise(fulfill => reader.onload = fulfill);
      reader.readAsText(e.files[i]);
      return promise.then(() => reader.result);
    }, i);
    expect(content).toEqual(fs.readFileSync(path.join(dir, '..', webkitRelativePaths[i])).toString());
  }
});

test('should upload a folder and throw for multiple directories', async ({ page, server, isAndroid, browserName, macVersion, isMac }) => {
  test.skip(isAndroid);
  test.skip(browserName === 'webkit' && isMac && macVersion <= 12, 'WebKit on macOS-12 is frozen');

  await page.goto(server.PREFIX + '/input/folderupload.html');
  const input = await page.$('input');
  const dir = path.join(test.info().outputDir, 'file-upload-test');
  {
    await fs.promises.mkdir(path.join(dir, 'folder1'), { recursive: true });
    await fs.promises.writeFile(path.join(dir, 'folder1', 'file1.txt'), 'file1 content');
    await fs.promises.mkdir(path.join(dir, 'folder2'), { recursive: true });
    await fs.promises.writeFile(path.join(dir, 'folder2', 'file2.txt'), 'file2 content');
  }
  await expect(input.setInputFiles([
    path.join(dir, 'folder1'),
    path.join(dir, 'folder2'),
  ])).rejects.toThrow('Multiple directories are not supported');
});

test('should throw if a directory and files are passed', async ({ page, server, isAndroid, browserName, macVersion, isMac }) => {
  test.skip(isAndroid);
  test.skip(browserName === 'webkit' && isMac && macVersion <= 12, 'WebKit on macOS-12 is frozen');

  await page.goto(server.PREFIX + '/input/folderupload.html');
  const input = await page.$('input');
  const dir = path.join(test.info().outputDir, 'file-upload-test');
  {
    await fs.promises.mkdir(path.join(dir, 'folder1'), { recursive: true });
    await fs.promises.writeFile(path.join(dir, 'folder1', 'file1.txt'), 'file1 content');
  }
  await expect(input.setInputFiles([
    path.join(dir, 'folder1'),
    path.join(dir, 'folder1', 'file1.txt'),
  ])).rejects.toThrow('File paths must be all files or a single directory');
});

test('should throw when uploading a folder in a normal file upload input', async ({ page, server, isAndroid, browserName, macVersion, isMac }) => {
  test.skip(isAndroid);
  test.skip(browserName === 'webkit' && isMac && macVersion <= 12, 'WebKit on macOS-12 is frozen');

  await page.goto(server.PREFIX + '/input/fileupload.html');
  const input = await page.$('input');
  const dir = path.join(test.info().outputDir, 'file-upload-test');
  {
    await fs.promises.mkdir(path.join(dir), { recursive: true });
    await fs.promises.writeFile(path.join(dir, 'file1.txt'), 'file1 content');
  }
  await expect(input.setInputFiles(dir)).rejects.toThrow('File input does not support directories, pass individual files instead');
});

test('should throw when uploading a file in a directory upload input', async ({ page, server, isAndroid, asset, browserName, macVersion, isMac }) => {
  test.skip(isAndroid);
  test.skip(browserName === 'webkit' && isMac && macVersion <= 12, 'WebKit on macOS-12 is frozen');

  await page.goto(server.PREFIX + '/input/folderupload.html');
  const input = await page.$('input');
  await expect(input.setInputFiles(asset('file to upload.txt'))).rejects.toThrow('[webkitdirectory] input requires passing a path to a directory');
});

test('should upload a file after popup', async ({ page, server, asset }) => {
  test.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/29923' });
  await page.goto(server.PREFIX + '/input/fileupload.html');
  {
    const [popup] = await Promise.all([
      page.waitForEvent('popup'),
      page.evaluate(() => window['__popup'] = window.open('about:blank')),
    ]);
    await popup.close();
  }
  const filePath = path.relative(process.cwd(), asset('file-to-upload.txt'));
  const input = await page.$('input');
  await input.setInputFiles(filePath);
  expect(await page.evaluate(e => e.files[0].name, input)).toBe('file-to-upload.txt');
});

test('should upload large file', async ({ page, server, isAndroid, isWebView2, mode }, testInfo) => {
  test.skip(isAndroid);
  test.skip(isWebView2);
  test.skip(mode.startsWith('service'));
  test.slow();

  await page.goto(server.PREFIX + '/input/fileupload.html');
  const uploadFile = testInfo.outputPath('200MB.zip');
  const str = 'A'.repeat(4 * 1024);
  const stream = fs.createWriteStream(uploadFile);
  for (let i = 0; i < 50 * 1024; i++) {
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
  const events = await input.evaluateHandle(e => {
    const events = [];
    e.addEventListener('input', () => events.push('input'));
    e.addEventListener('change', () => events.push('change'));
    return events;
  });
  await input.setInputFiles(uploadFile);
  expect(await input.evaluate(e => (e as HTMLInputElement).files[0].name)).toBe('200MB.zip');
  expect(await events.evaluate(e => e)).toEqual(['input', 'change']);
  const serverFilePromise = new Promise<formidable.File>(fulfill => {
    server.setRoute('/upload', async (req, res) => {
      const form = new formidable.IncomingForm({ uploadDir: testInfo.outputPath() });
      form.parse(req, function(err, fields, f) {
        res.end();
        const files = f as Record<string, formidable.File>;
        fulfill(files.file1);
      });
    });
  });
  const [file1] = await Promise.all([
    serverFilePromise,
    page.click('input[type=submit]')
  ]);
  expect(file1.originalFilename).toBe('200MB.zip');
  expect(file1.size).toBe(200 * 1024 * 1024);
  await Promise.all([uploadFile, file1.filepath].map(fs.promises.unlink));
});

test('should throw an error if the file does not exist', async ({ page, server, asset }) => {
  await page.goto(server.PREFIX + '/input/fileupload.html');
  const input = await page.$('input');
  const error = await input.setInputFiles('i actually do not exist.txt').catch(e => e);
  expect(error.message).toContain('ENOENT: no such file or directory');
  expect(error.message).toContain('i actually do not exist.txt');
});

test('should upload large file with relative path', async ({ page, server, isAndroid, isWebView2, mode }, testInfo) => {
  test.skip(isAndroid);
  test.skip(isWebView2);
  test.skip(mode.startsWith('service'));
  test.slow();

  await page.goto(server.PREFIX + '/input/fileupload.html');
  const uploadFile = testInfo.outputPath('200MB.zip');
  const str = 'A'.repeat(4 * 1024);
  const stream = fs.createWriteStream(uploadFile);
  for (let i = 0; i < 50 * 1024; i++) {
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
  const events = await input.evaluateHandle(e => {
    const events = [];
    e.addEventListener('input', () => events.push('input'));
    e.addEventListener('change', () => events.push('change'));
    return events;
  });
  const relativeUploadPath = path.relative(process.cwd(), uploadFile);
  expect(path.isAbsolute(relativeUploadPath)).toBeFalsy();
  await input.setInputFiles(relativeUploadPath);
  expect(await input.evaluate(e => (e as HTMLInputElement).files[0].name)).toBe('200MB.zip');
  expect(await events.evaluate(e => e)).toEqual(['input', 'change']);
  const serverFilePromise = new Promise<formidable.File>(fulfill => {
    server.setRoute('/upload', async (req, res) => {
      const form = new formidable.IncomingForm({ uploadDir: testInfo.outputPath() });
      form.parse(req, function(err, fields, f) {
        res.end();
        const files = f as Record<string, formidable.File>;
        fulfill(files.file1);
      });
    });
  });
  const [file1] = await Promise.all([
    serverFilePromise,
    page.click('input[type=submit]')
  ]);
  expect(file1.originalFilename).toBe('200MB.zip');
  expect(file1.size).toBe(200 * 1024 * 1024);
  await Promise.all([uploadFile, file1.filepath].map(fs.promises.unlink));
});

test('should upload the file with spaces in name', async ({ page, server, asset }) => {
  test.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/17451' });
  await page.goto(server.PREFIX + '/input/fileupload.html');
  const filePath = path.relative(process.cwd(), asset('file to upload.txt'));
  const input = await page.$('input');
  await input.setInputFiles(filePath);
  expect(await page.evaluate(e => e.files[0].name, input)).toBe('file to upload.txt');
  expect(await page.evaluate(e => {
    const reader = new FileReader();
    const promise = new Promise(fulfill => reader.onload = fulfill);
    reader.readAsText(e.files[0]);
    return promise.then(() => reader.result);
  }, input)).toBe('contents of the file');
});


test('should work @smoke', async ({ page, asset }) => {
  await page.setContent(`<input type=file>`);
  await page.setInputFiles('input', asset('file-to-upload.txt'));
  expect(await page.$eval('input', input => input.files.length)).toBe(1);
  expect(await page.$eval('input', input => input.files[0].name)).toBe('file-to-upload.txt');
});

test('should set from memory', async ({ page }) => {
  await page.setContent(`<input type=file>`);
  await page.setInputFiles('input', {
    name: 'test.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('this is a test')
  });
  expect(await page.$eval('input', input => input.files.length)).toBe(1);
  expect(await page.$eval('input', input => input.files[0].name)).toBe('test.txt');
});

test('should work with CSP', async ({ page, server, asset }) => {
  server.setCSP('/empty.html', 'default-src "none"');
  await page.goto(server.EMPTY_PAGE);
  await page.setContent(`<input type=file>`);
  await page.setInputFiles('input', asset('file-to-upload.txt'));
  expect(await page.$eval('input', input => input.files.length)).toBe(1);
  expect(await page.$eval('input', input => input.files[0].name)).toBe('file-to-upload.txt');
});

test('should detect mime type', async ({ page, server, asset }) => {

  let files: Record<string, formidable.File>;
  server.setRoute('/upload', async (req, res) => {
    const form = new formidable.IncomingForm();
    form.parse(req, function(err, fields, f) {
      files = f as Record<string, formidable.File>;
      res.end();
    });
  });
  await page.goto(server.EMPTY_PAGE);
  await page.setContent(`
    <form action="/upload" method="post" enctype="multipart/form-data" >
      <input type="file" name="file1">
      <input type="file" name="file2">
      <input type="submit" value="Submit">
    </form>`);
  await (await page.$('input[name=file1]')).setInputFiles(asset('file-to-upload.txt'));
  await (await page.$('input[name=file2]')).setInputFiles(asset('pptr.png'));
  await Promise.all([
    page.click('input[type=submit]'),
    server.waitForRequest('/upload'),
  ]);
  const { file1, file2 } = files;
  expect(file1.originalFilename).toBe('file-to-upload.txt');
  expect(file1.mimetype).toBe('text/plain');
  expect(fs.readFileSync(file1.filepath).toString()).toBe(
      fs.readFileSync(asset('file-to-upload.txt')).toString());
  expect(file2.originalFilename).toBe('pptr.png');
  expect(file2.mimetype).toBe('image/png');
  expect(fs.readFileSync(file2.filepath).toString()).toBe(
      fs.readFileSync(asset('pptr.png')).toString());
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

test('should emit input and change events', async ({ page, asset }) => {
  const events = [];
  await page.exposeFunction('eventHandled', e => events.push(e));
  await page.setContent(`
  <input id=input type=file></input>
  <script>
    input.addEventListener('input', e => eventHandled({ type: e.type }));
    input.addEventListener('change', e => eventHandled({ type: e.type }));
  </script>`);
  await (await page.$('input')).setInputFiles(asset('file-to-upload.txt'));
  expect(events.length).toBe(2);
  expect(events[0].type).toBe('input');
  expect(events[1].type).toBe('change');
});

test('input event.composed should be true and cross shadow dom boundary', async ({ page, server, asset }) => {
  test.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/28726' });
  await page.goto(server.EMPTY_PAGE);
  await page.setContent(`<body><script>
  const div = document.createElement('div');
  const shadowRoot = div.attachShadow({mode: 'open'});
  shadowRoot.innerHTML = '<input type=file></input>';
  document.body.appendChild(div);
</script></body>`);
  await page.locator('body').evaluate(select => {
    (window as any).firedBodyEvents = [];
    for (const event of ['input', 'change']) {
      select.addEventListener(event, e => {
        (window as any).firedBodyEvents.push(e.type + ':' + e.composed);
      }, false);
    }
  });

  await page.locator('input').evaluate(select => {
    (window as any).firedEvents = [];
    for (const event of ['input', 'change']) {
      select.addEventListener(event, e => {
        (window as any).firedEvents.push(e.type + ':' + e.composed);
      }, false);
    }
  });
  await page.locator('input').setInputFiles({
    name: 'test.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('this is a test')
  });
  expect(await page.evaluate(() => window['firedEvents'])).toEqual(['input:true', 'change:false']);
  expect(await page.evaluate(() => window['firedBodyEvents'])).toEqual(['input:true']);
});

test('input should trigger events when files changed second time', async ({ page, asset }) => {
  test.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/20079' });
  await page.setContent(`<input type=file multiple=true/>`);

  const input = page.locator('input');
  const events = await input.evaluateHandle(e => {
    const events = [];
    e.addEventListener('input', () => events.push('input'));
    e.addEventListener('change', () => events.push('change'));
    return events;
  });

  await input.setInputFiles(asset('file-to-upload.txt'));
  expect(await input.evaluate(e => (e as HTMLInputElement).files[0].name)).toBe('file-to-upload.txt');
  expect(await events.evaluate(e => e)).toEqual(['input', 'change']);

  await events.evaluate(e => e.length = 0);

  await input.setInputFiles(asset('pptr.png'));
  expect(await input.evaluate(e => (e as HTMLInputElement).files[0].name)).toBe('pptr.png');
  expect(await events.evaluate(e => e)).toEqual(['input', 'change']);
});

test('should preserve lastModified timestamp', async ({ page, asset }) => {
  test.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/27452' });
  await page.setContent(`<input type=file multiple=true/>`);
  const input = page.locator('input');
  const files = ['file-to-upload.txt', 'file-to-upload-2.txt'];
  await input.setInputFiles(files.map(f => asset(f)));
  expect(await input.evaluate(e => [...(e as HTMLInputElement).files].map(f => f.name))).toEqual(files);
  const timestamps = await input.evaluate(e => [...(e as HTMLInputElement).files].map(f => f.lastModified));
  const expectedTimestamps = files.map(file => Math.round(fs.statSync(asset(file)).mtimeMs));
  // On Linux browser sometimes reduces the timestamp by 1ms: 1696272058110.0715  -> 1696272058109 or even
  // rounds it to seconds in WebKit: 1696272058110 -> 1696272058000.
  for (let i = 0; i < timestamps.length; i++)
    expect(Math.abs(timestamps[i] - expectedTimestamps[i]), `expected: ${expectedTimestamps}; actual: ${timestamps}`).toBeLessThan(1000);
});
