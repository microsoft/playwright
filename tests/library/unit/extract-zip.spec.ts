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
import path from 'path';
import * as yazl from 'yazl';
import { test as it, expect } from '@playwright/test';
import { extractZip } from '../../../packages/utils/third_party/extractZip';

async function writeZip(zipPath: string, entries: { name: string, content: string, mode?: number }[]) {
  const zipFile = new yazl.ZipFile();
  for (const entry of entries)
    zipFile.addBuffer(Buffer.from(entry.content), entry.name, { mode: entry.mode });
  zipFile.end();
  await new Promise<void>((resolve, reject) => {
    zipFile.outputStream.pipe(fs.createWriteStream(zipPath)).on('close', resolve).on('error', reject);
  });
}

it('ZP-001 should not write through a symlink that leaves the extraction folder', async ({}, testInfo) => {
  const victim = testInfo.outputPath('victim.txt');
  await fs.promises.writeFile(victim, 'original');
  const zipPath = testInfo.outputPath('evil.zip');
  const kSymlinkMode = 0o120777;
  await writeZip(zipPath, [
    { name: 'escape', content: victim, mode: kSymlinkMode },
    { name: 'escape', content: 'overwritten' },
  ]);

  await expect(extractZip(zipPath, { dir: testInfo.outputPath('extracted') })).rejects.toThrow('Symlink entry "escape" is not allowed');
  await expect(extractZip(zipPath, { dir: testInfo.outputPath('extracted-with-symlinks'), allowSymlinks: true })).rejects.toThrow('Refusing to overwrite symlink');
  expect(await fs.promises.readFile(victim, 'utf8')).toBe('original');
});

it('ZP-002 should extract regular files and directories', async ({}, testInfo) => {
  const zipPath = testInfo.outputPath('ok.zip');
  await writeZip(zipPath, [
    { name: 'index.html', content: 'index' },
    { name: 'nested/file.txt', content: 'nested' },
  ]);

  const dir = testInfo.outputPath('extracted');
  await extractZip(zipPath, { dir });
  expect(await fs.promises.readFile(path.join(dir, 'index.html'), 'utf8')).toBe('index');
  expect(await fs.promises.readFile(path.join(dir, 'nested', 'file.txt'), 'utf8')).toBe('nested');
});
