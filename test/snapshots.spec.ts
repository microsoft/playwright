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
import { it, describe } from './fixtures';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import type {Page} from '../src/server/page';
import fs from 'fs';
import path from 'path';

describe('screenshot', (suite, { mode }) => {
  suite.skip(mode !== 'default');
}, () => {
  it('button', async ({page, server, toImpl, testInfo}) => {
    await page.goto(server.PREFIX + '/input/button.html');
    await testPage(toImpl(page), testInfo.outputPath('snapshot.png'));
  });

  // fails because of the focus ring
  // fails because of the text caret
  // fails because of textarea selection
  it.skip('textarea', async ({page, server, toImpl, testInfo}) => {
    await page.goto(server.PREFIX + '/input/textarea.html');
    await page.fill('textarea', 'hello world');
    await page.$eval('textarea', t => t.setSelectionRange(5, 10));
    await testPage(toImpl(page), testInfo.outputPath('snapshot.png'));
  });

  it('scrollable', async ({page, server, toImpl, testInfo}) => {
    await page.goto(server.PREFIX + '/input/scrollable.html');
    await testPage(toImpl(page), testInfo.outputPath('snapshot.png'));
  });

  // the snapshot renderer doesn't yet integrate network files
  it.skip('image', async ({page, server, toImpl, testInfo}) => {
    await page.goto(server.EMPTY_PAGE);
    server.setRoute('/fakeimage.png', (request, response) => {
      server.serveFile(request, response, path.join(__dirname, 'assets', 'digits', '1.png'));
    });
    await page.setContent(`<img style="zoom: 5" src="/fakeimage.png">`);
    server.reset();
    await testPage(toImpl(page), testInfo.outputPath('snapshot.png'));
  });
});

async function testPage(page: Page, filePath: string) {
  const expectedBuffer = await page.screenshot();
  const snapshot = await page.snapshot();
  await page.loadSnapshot(snapshot);
  const actualBuffer = await page.screenshot();

  const actual = PNG.sync.read(actualBuffer);
  const expected = PNG.sync.read(expectedBuffer);
  if (expected.width !== actual.width || expected.height !== actual.height)
    throw new Error(`Sizes differ; expected image ${expected.width}px X ${expected.height}px, but got ${actual.width}px X ${actual.height}px. `);

  const diff = new PNG({width: expected.width, height: expected.height});
  const count = pixelmatch(expected.data, actual.data, diff.data, expected.width, expected.height, { threshold: 0 });
  if (count !== 0) {
    await fs.promises.writeFile(filePath, PNG.sync.write(diff));
    throw new Error(`diff saved to ${filePath}`);
  }
}
