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

// if not running as a chrome extension, skip this...
if (typeof chrome !== 'undefined' && chrome.runtime) {
  let _port: chrome.runtime.Port | undefined;

  window.dispatch = async function _onDispatch(data: any) {
    _port?.postMessage({ type: 'recorderEvent', ...data });
  };

  chrome.runtime.onConnect.addListener(port => {
    _port = port;

    port.onMessage.addListener(async msg => {
      if (!('type' in msg) || msg.type !== 'recorder') return;

      switch (msg.method) {
        case 'setPaused': window.playwrightSetPaused(msg.paused); break;
        case 'setMode': window.playwrightSetMode(msg.mode); break;
        case 'setSources': window.playwrightSetSources(msg.sources); break;
        case 'updateCallLogs': window.playwrightUpdateLogs(msg.callLogs); break;
        case 'setSelector': window.playwrightSetSelector(msg.selector, msg.focus); break;
        case 'setFileIfNeeded': window.playwrightSetFileIfNeeded(msg.file); break;
      }
    });

    port.onDisconnect.addListener(() => {
      _port = undefined;
    });
  });
}
