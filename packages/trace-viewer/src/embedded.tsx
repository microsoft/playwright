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
import '@web/third_party/vscode/codicon.css';
import * as ReactDOM from 'react-dom/client';
import { EmbeddedWorkbenchLoader } from './ui/embeddedWorkbenchLoader';

(async () => {
  applyTheme();

  // workaround to send keystrokes back to vscode webview to keep triggering key bindings there
  const handleKeyEvent = (e: KeyboardEvent) => {
    if (!e.isTrusted)
      return;
    window.parent?.postMessage({
      type: e.type,
      key: e.key,
      keyCode: e.keyCode,
      code: e.code,
      shiftKey: e.shiftKey,
      altKey: e.altKey,
      ctrlKey: e.ctrlKey,
      metaKey: e.metaKey,
      repeat: e.repeat,
    }, '*');
  };
  window.addEventListener('keydown', handleKeyEvent);
  window.addEventListener('keyup', handleKeyEvent);

  if (window.location.protocol !== 'file:') {
    if (!navigator.serviceWorker)
      throw new Error(`Service workers are not supported.\nMake sure to serve the Trace Viewer (${window.location}) via HTTPS or localhost.`);
    navigator.serviceWorker.register('sw.bundle.js');
    if (!navigator.serviceWorker.controller) {
      await new Promise<void>(f => {
        navigator.serviceWorker.oncontrollerchange = () => f();
      });
    }

    // Keep SW running.
    setInterval(function() { fetch('ping'); }, 10000);
  }

  ReactDOM.createRoot(document.querySelector('#root')!).render(<EmbeddedWorkbenchLoader />);
})();
