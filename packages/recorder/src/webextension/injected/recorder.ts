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

import { InjectedScript } from 'playwright-core/lib/server/injected/injectedScript';
import { PollingRecorder } from 'playwright-core/lib/server/injected/recorder/recorder';

const wnd = window as any;

if (!wnd['__pw_injectedScript']) {
  const bindingNames = [
    '__pw_recorderPerformAction',
    '__pw_recorderRecordAction',
    '__pw_recorderState',
    '__pw_recorderSetSelector',
    '__pw_recorderSetMode',
    '__pw_recorderSetOverlayState',
    '__pw_refreshOverlay',
  ];

  for (const bindingName of bindingNames) {
    wnd[bindingName] = async (...args: any[]) => {
      return await chrome.runtime.sendMessage({
        bindingName,
        args,
      });
    };
  }

  const injectedScript = new InjectedScript(window, false, 'javascript', 'data-testid', 1, 'chrome', []);
  new PollingRecorder(injectedScript, false);

  wnd['__pw_injectedScript'] = injectedScript;
}
