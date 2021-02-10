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

import { expect } from 'folio';
import { folio } from './recorder.fixtures';
const { it, describe} = folio;

describe('pause', (suite, { mode }) => {
  suite.skip(mode !== 'default');
}, () => {
  it('should pause and resume the script', async ({ page, recorderClick }) => {
    await Promise.all([
      page.pause(),
      recorderClick('[title=Resume]')
    ]);
  });

  it('should resume from console', async ({page}) => {
    await Promise.all([
      page.pause(),
      page.waitForFunction(() => (window as any).playwright && (window as any).playwright.resume).then(() => {
        return page.evaluate('window.playwright.resume()');
      })
    ]);
  });

  it('should pause after a navigation', async ({page, server, recorderClick}) => {
    await page.goto(server.EMPTY_PAGE);
    await Promise.all([
      page.pause(),
      recorderClick('[title=Resume]')
    ]);
  });

  it('should show source', async ({page, server, recorderClick, recorderFrame}) => {
    await page.goto(server.EMPTY_PAGE);
    const pausePromise = page.pause();
    const frame = await recorderFrame();
    const source = await frame._evaluateExpression((() => {
      return document.querySelector('.source-line-paused .source-code').textContent;
    }).toString(), true, undefined, 'main');
    expect(source).toContain('page.pause()');
    await recorderClick('[title=Resume]');
    await pausePromise;
  });
});
