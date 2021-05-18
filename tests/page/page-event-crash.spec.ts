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

import { test as it, expect } from './pageTest';
import * as os from 'os';

function crash({ page, toImpl, browserName, platform, mode }: any) {
  if (browserName === 'chromium') {
    page.goto('chrome://crash').catch(e => {});
  } else if (browserName === 'webkit') {
    it.skip(mode !== 'default');
    it.fixme(platform === 'darwin' && parseInt(os.release(), 10) >= 20, 'Timing out after roll on BigSur');
    toImpl(page)._delegate._session.send('Page.crash', {}).catch(e => {});
  } else if (browserName === 'firefox') {
    it.skip(mode !== 'default');
    toImpl(page)._delegate._session.send('Page.crash', {}).catch(e => {});
  }
}

it.describe('', () => {
  it('should emit crash event when page crashes', async ({ page, toImpl, browserName, platform, mode }) => {
    await page.setContent(`<div>This page should crash</div>`);
    crash({ page, toImpl, browserName, platform, mode });
    const crashedPage = await new Promise(f => page.on('crash', f));
    expect(crashedPage).toBe(page);
  });

  it('should throw on any action after page crashes', async ({ page, toImpl, browserName, platform, mode }) => {
    await page.setContent(`<div>This page should crash</div>`);
    crash({ page, toImpl, browserName, platform, mode });
    await page.waitForEvent('crash');
    const err = await page.evaluate(() => {}).then(() => null, e => e);
    expect(err).toBeTruthy();
    expect(err.message).toContain('crash');
  });

  it('should cancel waitForEvent when page crashes', async ({ page, toImpl, browserName, platform, mode }) => {
    await page.setContent(`<div>This page should crash</div>`);
    const promise = page.waitForEvent('response').catch(e => e);
    crash({ page, toImpl, browserName, platform, mode });
    const error = await promise;
    expect(error.message).toContain('Page crashed');
  });

  it('should cancel navigation when page crashes', async ({ server, page, toImpl, browserName, platform, mode }) => {
    await page.setContent(`<div>This page should crash</div>`);
    server.setRoute('/one-style.css', () => {});
    const promise = page.goto(server.PREFIX + '/one-style.html').catch(e => e);
    await page.waitForNavigation({ waitUntil: 'domcontentloaded' });
    crash({ page, toImpl, browserName, platform, mode });
    const error = await promise;
    expect(error.message).toContain('Navigation failed because page crashed');
  });

  it('should be able to close context when page crashes', async ({ isAndroid, isElectron, page, toImpl, browserName, platform, mode }) => {
    it.skip(isAndroid);
    it.skip(isElectron);

    await page.setContent(`<div>This page should crash</div>`);
    crash({ page, toImpl, browserName, platform, mode });
    await page.waitForEvent('crash');
    await page.context().close();
  });
});
