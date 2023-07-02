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

import type { CrxApplication } from '@playwright/experimental-crx';
import { _setUnderTest, _crx } from '@playwright/experimental-crx';

// we must lazy initialize it
let _crxPromise: Promise<CrxApplication> | undefined;

Object.assign(self, { _setUnderTest, _crx });

async function getCrx() {
  if (!_crxPromise) {
    _crxPromise = _crx.start().then(crx => {
      crx.recorder.addListener('hide', async () => {
        await crx.detachAll();
        await chrome.action.enable();
      });
      return crx;
    });
  }

  return await _crxPromise;
}

async function attach(tab: chrome.tabs.Tab) {
  await chrome.action.disable();

  const crx = await getCrx();

  if (crx.recorder.isHidden())
    await crx.recorder.show({ mode: 'recording' });

  try {
    await crx.attach(tab.id!);
    await chrome.action.disable(tab.id);
  } catch (e) {
    // do nothing
  }
  await chrome.action.enable();
}

chrome.action.onClicked.addListener(attach);

chrome.contextMenus.create({
  id: 'pw-recorder',
  title: 'Attach to Playwright Recorder',
  contexts: ['page'],
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (tab) await attach(tab);
});

