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
import { access, readFile, readlink } from 'fs/promises';
import { TarExtractor } from '../../../packages/playwright-core/src/utils/tar';
import { finished } from 'stream/promises';

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
