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
import './polyfills/dependencies';
import { getOrCreatePage, getPage } from './crx/crxPlaywright';

async function _onAttach(tabId: number) {
  const page = await getOrCreatePage(tabId, { enableRecorder: true });
  // console.log runs in the page, not here
  // eslint-disable-next-line no-console
  await page.evaluate(() => console.log('Recording...'));
}

async function _onDetach(tabId: number) {
  const page = getPage(tabId);
  await page?.close();
}

// https://stackoverflow.com/a/46628145
chrome.runtime.onMessage.addListener(({ type, tabId }, _, sendResponse) => {
  (async () => {
    switch (type) {
      case 'attach': await _onAttach(tabId); break;
      case 'detach': await _onDetach(tabId); break;
    }
  // eslint-disable-next-line no-console
  })().then(sendResponse).catch(console.error);

  return true;
});

const portRegex = /playwright-devtools-page-(\d+)/;

// https://developer.chrome.com/docs/extensions/mv3/devtools/#detecting-open-close
chrome.runtime.onConnect.addListener(port => {
  const [, tabIdString] = port.name.match(portRegex) ?? [];
  if (!tabIdString) return;

  // eslint-disable-next-line radix
  const tabId = parseInt(tabIdString);

  port.onDisconnect.addListener(async () => {
    await _onDetach(tabId);
  });
});
