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

function toMessage(message: any): string {
  return String(message === undefined || message === null ? '' : message);
}

// Stock WebKit RDP has no dialog API. We override window.alert/confirm/prompt
// to tunnel calls through a synchronous XHR to our DialogBridge HTTP server,
// which holds the response until the host-side Dialog handler resolves.
export function installDialogBridge(window: Window & typeof globalThis, endpoint: string) {
  function post(type: string, message: string, defaultValue: string): any {
    const xhr = new window.XMLHttpRequest();
    try { xhr.open('POST', endpoint, false); } catch (e) { return null; }
    // text/plain body keeps this a "simple" CORS request — no preflight.
    try { xhr.send(JSON.stringify({ type, message, defaultValue })); } catch (e) { return null; }
    if (xhr.status !== 200)
      return null;
    try { return JSON.parse(xhr.responseText); } catch (e) { return null; }
  }
  Object.defineProperty(window, 'alert', {
    configurable: true, writable: false,
    value: function(message: any) { post('alert', toMessage(message), ''); },
  });
  Object.defineProperty(window, 'confirm', {
    configurable: true, writable: false,
    value: function(message: any) {
      const r = post('confirm', toMessage(message), '');
      return !!(r && r.accept);
    },
  });
  Object.defineProperty(window, 'prompt', {
    configurable: true, writable: false,
    value: function(message: any, defaultValue: any) {
      const def = toMessage(defaultValue);
      const r = post('prompt', toMessage(message), def);
      if (!r || !r.accept)
        return null;
      return typeof r.promptText === 'string' ? r.promptText : def;
    },
  });
}
