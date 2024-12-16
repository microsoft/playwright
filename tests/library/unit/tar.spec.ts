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


import { expect, test } from '@playwright/test';
import { createReadStream, constants } from 'fs';
import { access, readFile, readlink, readdir } from 'fs/promises';
import { TarExtractor } from '../../../packages/playwright-core/src/utils/tar';
import { finished } from 'stream/promises';
import { Readable } from 'stream';
import { createBrotliDecompress } from 'zlib';

test('tar extractor', async () => {
  const input = createReadStream('tests/assets/archive.tar');
  const extractor = new TarExtractor(name => test.info().outputPath(name));
  await finished(input.pipe(extractor));

  expect(await readFile(test.info().outputPath('tar-example/foo'), { encoding: 'utf-8' })).toEqual('foo-content');
  expect(await readFile(test.info().outputPath('tar-example/bar/baz'), { encoding: 'utf-8' })).toEqual('baz-content');
  expect(await readFile(test.info().outputPath('tar-example/build.sh'), { encoding: 'utf-8' })).toEqual('echo "hello world"');
  await access(test.info().outputPath('tar-example/build.sh'), constants.X_OK);
  expect(await readlink(test.info().outputPath('tar-example/symlink'))).toEqual('./foo');
  expect(await readFile(test.info().outputPath('tar-example/symlink'), { encoding: 'utf-8' })).toEqual('foo-content');
});

test.describe('browser downloads', () => {
  // not run by default because they're not hermetic. i'll remove them once we use the TAR extractor in our code.
  test.skip(process.env.TEST_TAR_BROWSER !== '1');

  test('chromium-headless-shell', async () => {
    const response = await fetch('https://playwright.azureedge.net/download-for-internal-testing/playwright/builds/chromium/1152/chromium-headless-shell-linux-arm64.tar.br');
    const input = Readable.fromWeb(response.body as any);
    const decompressor = createBrotliDecompress();
    const extractor = new TarExtractor(name => test.info().outputPath(name));
    await finished(input.pipe(decompressor).pipe(extractor));


    expect(await readdir(test.info().outputPath('chrome-linux'))).toEqual([
      'headless_command_resources.pak',
      'headless_lib_data.pak',
      'headless_lib_strings.pak',
      'headless_shell',
      'hyphen-data',
      'icudtl.dat',
      'libEGL.so',
      'libGLESv2.so',
      'libvk_swiftshader.so',
      'libvulkan.so.1',
      'v8_context_snapshot.bin',
      'vk_swiftshader_icd.json',
    ]);
    expect(await readFile(test.info().outputPath('chrome-linux/vk_swiftshader_icd.json'), { encoding: 'utf-8' })).toEqual(`{"file_format_version": "1.0.0", "ICD": {"library_path": "./libvk_swiftshader.so", "api_version": "1.0.5"}}`);
    expect(await readdir(test.info().outputPath('chrome-linux/hyphen-data'))).toEqual([
      'hyph-af.hyb',
      'hyph-as.hyb',
      'hyph-be.hyb',
      'hyph-bg.hyb',
      'hyph-bn.hyb',
      'hyph-cs.hyb',
      'hyph-cu.hyb',
      'hyph-cy.hyb',
      'hyph-da.hyb',
      'hyph-de-1901.hyb',
      'hyph-de-1996.hyb',
      'hyph-de-ch-1901.hyb',
      'hyph-el.hyb',
      'hyph-en-gb.hyb',
      'hyph-en-us.hyb',
      'hyph-es.hyb',
      'hyph-et.hyb',
      'hyph-eu.hyb',
      'hyph-fr.hyb',
      'hyph-ga.hyb',
      'hyph-gl.hyb',
      'hyph-gu.hyb',
      'hyph-hi.hyb',
      'hyph-hr.hyb',
      'hyph-hu.hyb',
      'hyph-hy.hyb',
      'hyph-it.hyb',
      'hyph-ka.hyb',
      'hyph-kn.hyb',
      'hyph-la.hyb',
      'hyph-lt.hyb',
      'hyph-lv.hyb',
      'hyph-ml.hyb',
      'hyph-mn-cyrl.hyb',
      'hyph-mr.hyb',
      'hyph-mul-ethi.hyb',
      'hyph-nb.hyb',
      'hyph-nl.hyb',
      'hyph-nn.hyb',
      'hyph-or.hyb',
      'hyph-pa.hyb',
      'hyph-pt.hyb',
      'hyph-ru.hyb',
      'hyph-sk.hyb',
      'hyph-sl.hyb',
      'hyph-sq.hyb',
      'hyph-sv.hyb',
      'hyph-ta.hyb',
      'hyph-te.hyb',
      'hyph-tk.hyb',
      'hyph-uk.hyb',
      'hyph-und-ethi.hyb',
      'manifest.json',
    ]);
  });

  test('chromium-mac-arm64', async () => {
    const response = await fetch('https://playwright.azureedge.net/download-for-internal-testing/playwright/builds/chromium/1152/chromium-mac-arm64.tar.br');
    const input = Readable.fromWeb(response.body as any);
    const decompressor = createBrotliDecompress();
    const extractor = new TarExtractor(name => test.info().outputPath(name));
    await finished(input.pipe(decompressor).pipe(extractor));


    expect(await readdir(test.info().outputPath('chrome-mac'))).toEqual(['Chromium.app']);
    expect(await readdir(test.info().outputPath('chrome-mac/Chromium.app'))).toEqual(['Contents']);
    expect(await readdir(test.info().outputPath('chrome-mac/Chromium.app/Contents'))).toEqual([
      'Frameworks',
      'Info.plist',
      'MacOS',
      'PkgInfo',
      'Resources',
    ]);
    expect(await readFile(test.info().outputPath('chrome-mac/Chromium.app/Contents/Info.plist'), { encoding: 'utf-8' })).toHaveLength(10903);
  });
});
