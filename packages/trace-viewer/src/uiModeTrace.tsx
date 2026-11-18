/**
 * Copyright (c) Microsoft Corporation.
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

import '@web/common.css';
import { applyTheme } from '@web/theme';
import { settings } from '@web/uiUtils';
import '@web/third_party/vscode/codicon.css';
import * as ReactDOM from 'react-dom/client';
import { startServiceWorker } from './ui/serviceWorker';
import { UIModeTraceFrame } from './ui/uiModeTraceFrame';
import type { UIModeTraceEvent, UIModeTraceRequest } from './ui/uiModeTraceProtocol';

// The trace viewer for UI mode. UI mode shows this page in a frame, and they exchange messages.
(async () => {
  // UI mode gives the theme in the address, so the first paint has the correct colors.
  const theme = new URLSearchParams(window.location.search).get('theme');
  if (theme)
    localStorage['theme'] = theme;
  applyTheme();
  await startServiceWorker();

  let parentOrigin = '*';
  const sendEvent = (event: UIModeTraceEvent) => window.parent.postMessage(event, parentOrigin);
  const root = ReactDOM.createRoot(document.querySelector('#root')!);

  // A drag of a split view writes a setting on each mouse move.
  let saveSettingsTimer: number | undefined;
  const saveSettings = () => {
    clearTimeout(saveSettingsTimer);
    saveSettingsTimer = window.setTimeout(() => sendEvent({ method: 'saveSettings', settings: { ...localStorage } }), 300);
  };

  window.addEventListener('message', event => {
    if (event.source !== window.parent)
      return;
    const request = event.data as UIModeTraceRequest;
    if (request.method === 'settings') {
      parentOrigin = event.origin;
      for (const [name, value] of Object.entries(request.settings)) {
        localStorage[name] = String(value);
        settings.onChangeEmitter.dispatchEvent(new Event(name));
      }
      window.saveSettings = saveSettings;
    } else if (request.method === 'update') {
      root.render(<UIModeTraceFrame params={request.params} sendEvent={sendEvent} />);
    }
  });

  window.addEventListener('keydown', event => {
    if (event.defaultPrevented)
      return;
    // Do not load the page again, the embedder has it.
    if (event.code === 'F5')
      event.preventDefault();
    const { key, code, ctrlKey, shiftKey, altKey, metaKey } = event;
    sendEvent({ method: 'keydown', event: { key, code, ctrlKey, shiftKey, altKey, metaKey } });
  });

  sendEvent({ method: 'ready' });
})();
