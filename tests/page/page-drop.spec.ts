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

import fs from 'fs';

import { test as it, expect } from './pageTest';

it.skip(({ isAndroid }) => isAndroid, 'No drag&drop on Android.');

async function setupDropzone(page: import('playwright-core').Page) {
  await page.setContent(`
    <style>#dropzone { width: 300px; height: 200px; border: 2px dashed #888; }</style>
    <div id="dropzone"></div>
    <script>
      window.__dropInfo = null;
      const zone = document.getElementById('dropzone');
      zone.addEventListener('dragenter', e => e.preventDefault());
      zone.addEventListener('dragover', e => e.preventDefault());
      zone.addEventListener('drop', async e => {
        e.preventDefault();
        const files = [];
        for (const file of e.dataTransfer.files)
          files.push({ name: file.name, type: file.type, size: file.size, text: await file.text() });
        const data = {};
        for (const t of e.dataTransfer.types) {
          if (t !== 'Files')
            data[t] = e.dataTransfer.getData(t);
        }
        window.__dropInfo = { files, data };
      });
    </script>
  `);
}

it('should drop a file payload', async ({ page }) => {
  await setupDropzone(page);
  await page.locator('#dropzone').drop({
    files: { name: 'note.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') },
  });
  await expect.poll(() => page.evaluate(() => (window as any).__dropInfo)).toEqual({
    files: [{ name: 'note.txt', type: 'text/plain', size: 5, text: 'hello' }],
    data: {},
  });
});

it('should drop multiple file payloads', async ({ page }) => {
  await setupDropzone(page);
  await page.locator('#dropzone').drop({
    files: [
      { name: 'a.txt', mimeType: 'text/plain', buffer: Buffer.from('AAA') },
      { name: 'b.txt', mimeType: 'text/plain', buffer: Buffer.from('BB') },
    ],
  });
  const info = await page.evaluate(() => (window as any).__dropInfo);
  expect(info.files.map((f: any) => [f.name, f.text])).toEqual([['a.txt', 'AAA'], ['b.txt', 'BB']]);
});

it('should drop a file by local path', async ({ page }, testInfo) => {
  await setupDropzone(page);
  const filePath = testInfo.outputPath('hello.txt');
  await fs.promises.writeFile(filePath, 'path-content');
  await page.locator('#dropzone').drop({ files: filePath });
  const info = await page.evaluate(() => (window as any).__dropInfo);
  expect(info.files).toHaveLength(1);
  expect(info.files[0].name).toBe('hello.txt');
  expect(info.files[0].text).toBe('path-content');
});

it('should drop clipboard-like data', async ({ page }) => {
  await setupDropzone(page);
  await page.locator('#dropzone').drop({
    data: {
      'text/plain': 'hello world',
      'text/uri-list': 'https://example.com',
    },
  });
  const info = await page.evaluate(() => (window as any).__dropInfo);
  expect(info.files).toEqual([]);
  expect(info.data['text/plain']).toBe('hello world');
  expect(info.data['text/uri-list']).toBe('https://example.com');
});

it('should drop files and data together', async ({ page }) => {
  await setupDropzone(page);
  await page.locator('#dropzone').drop({
    files: { name: 'mix.txt', mimeType: 'text/plain', buffer: Buffer.from('mix') },
    data: { 'text/plain': 'label' },
  });
  const info = await page.evaluate(() => (window as any).__dropInfo);
  expect(info.files[0].text).toBe('mix');
  expect(info.data['text/plain']).toBe('label');
});

it('should throw when target does not accept drop', async ({ page }) => {
  // Dropzone without preventDefault on dragover.
  await page.setContent(`
    <div id="dropzone" style="width: 200px; height: 100px;"></div>
  `);
  await expect(page.locator('#dropzone').drop({
    data: { 'text/plain': 'nope' },
  })).rejects.toThrow(/drop target did not accept the drop/i);
});

it('should throw when neither files nor data provided', async ({ page }) => {
  await setupDropzone(page);
  await expect(page.locator('#dropzone').drop({})).rejects.toThrow(/At least one of "files" or "data"/);
});
