/**
 * Copyright 2019 Google Inc. All rights reserved.
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

export const Events = {
  AndroidDevice: {
    WebView: 'webview',
    Close: 'close'
  },

  AndroidSocket: {
    Data: 'data',
    Close: 'close'
  },

  AndroidWebView: {
    Close: 'close'
  },

  Browser: {
    Disconnected: 'disconnected'
  },

  BrowserContext: {
    Console: 'console',
    Close: 'close',
    Dialog: 'dialog',
    Page: 'page',
    // Can't use just 'error' due to node.js special treatment of error events.
    // @see https://nodejs.org/api/events.html#events_error_events
    WebError: 'weberror',
    BackgroundPage: 'backgroundpage',
    ServiceWorker: 'serviceworker',
    Request: 'request',
    Response: 'response',
    RequestFailed: 'requestfailed',
    RequestFinished: 'requestfinished',
  },

  BrowserServer: {
    Close: 'close',
  },

  Page: {
    Close: 'close',
    Crash: 'crash',
    Console: 'console',
    Dialog: 'dialog',
    Download: 'download',
    FileChooser: 'filechooser',
    DOMContentLoaded: 'domcontentloaded',
    // Can't use just 'error' due to node.js special treatment of error events.
    // @see https://nodejs.org/api/events.html#events_error_events
    PageError: 'pageerror',
    Request: 'request',
    Response: 'response',
    RequestFailed: 'requestfailed',
    RequestFinished: 'requestfinished',
    FrameAttached: 'frameattached',
    FrameDetached: 'framedetached',
    FrameNavigated: 'framenavigated',
    Load: 'load',
    Popup: 'popup',
    WebSocket: 'websocket',
    Worker: 'worker',
  },

  WebSocket: {
    Close: 'close',
    Error: 'socketerror',
    FrameReceived: 'framereceived',
    FrameSent: 'framesent',
  },

  Worker: {
    Close: 'close',
  },

  ElectronApplication: {
    Close: 'close',
    Console: 'console',
    Window: 'window',
  },
};
