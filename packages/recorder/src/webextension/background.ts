/**
 * Copyright (c) Rui Figueira.
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

import { BrowserContext } from './browserContext';
import { Recorder } from './recorder/recorder';
import { BrowserRecorderApp } from './recorder/recorderApp';
import { Page } from './page';

async function record(tab: chrome.tabs.Tab) {
  if (!tab?.id)
    return;

  // ensure one attachment at a time
  chrome.action.disable();

  const browserContext = new BrowserContext();
  const page = new Page(tab.id, tab.url);
  browserContext.addPage(page);

  Recorder.setAppFactory(async recorder => {
    const recorderApp = await BrowserRecorderApp.open(recorder);

    const close = async () => {
      await recorderApp.close();
      // wait 1 second to ensure __pw_recorderSetMode binding is called
      await new Promise(resolve => setTimeout(resolve, 1000));
      browserContext.dispose();
      await chrome.action.enable();
    };

    page.on(Page.Events.Close, close);
    recorderApp.on(BrowserRecorderApp.Events.Close, close);

    return recorderApp;
  });

  await Recorder.show(browserContext, { mode: 'recording' });
}

chrome.action.onClicked.addListener(record);
