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
import type { Port } from './crx/crxPlaywright';
import { getOrCreatePage, getPage } from './crx/crxPlaywright';
import { setUnderTest } from './polyfills/utils';

async function _onAttach(tabId: number, port: Port, underTest?: boolean) {
  if (underTest) setUnderTest();

  const page = await getOrCreatePage(tabId, port);
  // underTest is set on unit tests, so they will eventually enable recorder
  if (!underTest)
    await page.context()._enableRecorder({ language: 'javascript' });

  // console.log runs in the page, not here
  // eslint-disable-next-line no-console
  await page.evaluate(() => console.log('Recording...'));

  port.postMessage({ event: 'attached' });
}

async function _onDetach(tabId: number) {
  const page = await getPage(tabId);
  await page?.close();
}

const portRegex = /playwright-devtools-page-(\d+)/;

// https://developer.chrome.com/docs/extensions/mv3/devtools/#detecting-open-close
chrome.runtime.onConnect.addListener(port => {
  const [, tabIdString] = port.name.match(portRegex) ?? [];
  if (!tabIdString) return;

  // eslint-disable-next-line radix
  const tabId = parseInt(tabIdString);

  // https://stackoverflow.com/a/46628145
  port.onMessage.addListener(({ type }) => {
    switch (type) {
      case 'detach': _onDetach(tabId); break;
    }
  });

  port.onDisconnect.addListener(async () => {
    await _onDetach(tabId);
  });

  _onAttach(tabId, port);
});
