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
export = {
  Chromium: {
    Accessibility: require('./chromium/features/accessibility').Accessibility,
    Browser: require('./chromium/Browser').Browser,
    BrowserContext: require('./chromium/BrowserContext').BrowserContext,
    BrowserFetcher: require('./chromium/BrowserFetcher').BrowserFetcher,
    CDPSession: require('./chromium/Connection').CDPSession,
    ConsoleMessage: require('./chromium/Page').ConsoleMessage,
    Coverage: require('./chromium/features/coverage').Coverage,
    Dialog: require('./chromium/Dialog').Dialog,
    ElementHandle: require('./chromium/JSHandle').ElementHandle,
    ExecutionContext: require('./chromium/ExecutionContext').ExecutionContext,
    FileChooser: require('./chromium/Page').FileChooser,
    Frame: require('./chromium/Frame').Frame,
    JSHandle: require('./chromium/JSHandle').JSHandle,
    Keyboard: require('./chromium/Input').Keyboard,
    Mouse: require('./chromium/Input').Mouse,
    PDF: require('./chromium/features/pdf').PDF,
    Page: require('./chromium/Page').Page,
    Permissions: require('./chromium/features/permissions').Permissions,
    Playwright: require('./chromium/Playwright').Playwright,
    Request: require('./chromium/NetworkManager').Request,
    Response: require('./chromium/NetworkManager').Response,
    Target: require('./chromium/Target').Target,
    TimeoutError: require('./Errors').TimeoutError,
    Touchscreen: require('./chromium/Input').Touchscreen,
    Tracing: require('./chromium/features/tracing').Tracing,
    Worker: require('./chromium/features/workers').Worker,
    Workers: require('./chromium/features/workers').Workers,
  },
  Firefox: {
    Accessibility: require('./firefox/features/accessibility').Accessibility,
    Browser: require('./firefox/Browser').Browser,
    BrowserContext: require('./firefox/Browser').BrowserContext,
    BrowserFetcher: require('./firefox/BrowserFetcher').BrowserFetcher,
    CDPSession: require('./firefox/Connection').CDPSession,
    ConsoleMessage: require('./firefox/Page').ConsoleMessage,
    Dialog: require('./firefox/Dialog').Dialog,
    ElementHandle: require('./firefox/JSHandle').ElementHandle,
    ExecutionContext: require('./firefox/ExecutionContext').ExecutionContext,
    FileChooser: require('./firefox/Page').FileChooser,
    Frame: require('./firefox/FrameManager').Frame,
    JSHandle: require('./firefox/JSHandle').JSHandle,
    Keyboard: require('./firefox/Input').Keyboard,
    Mouse: require('./firefox/Input').Mouse,
    Page: require('./firefox/Page').Page,
    Permissions: require('./firefox/features/permissions').Permissions,
    Playwright: require('./firefox/Playwright').Playwright,
    Request: require('./firefox/NetworkManager').Request,
    Response: require('./firefox/NetworkManager').Response,
    Target: require('./firefox/Browser').Target,
    TimeoutError: require('./Errors').TimeoutError,
    Touchscreen: require('./firefox/Input').Touchscreen,
  },
  WebKit: {
    Browser: require('./webkit/Browser').Browser,
    BrowserContext: require('./webkit/Browser').BrowserContext,
    BrowserFetcher: require('./webkit/BrowserFetcher'),
    ConsoleMessage: require('./webkit/Page').ConsoleMessage,
    ElementHandle: require('./webkit/JSHandle').ElementHandle,
    ExecutionContext: require('./webkit/ExecutionContext').ExecutionContext,
    Frame: require('./webkit/FrameManager').Frame,
    JSHandle: require('./webkit/JSHandle').JSHandle,
    Keyboard: require('./webkit/Input').Keyboard,
    Mouse: require('./webkit/Input').Mouse,
    Page: require('./webkit/Page').Page,
    Playwright: require('./webkit/Playwright').Playwright,
    Request: require('./webkit/NetworkManager').Request,
    Response: require('./webkit/NetworkManager').Response,
    Target: require('./webkit/Browser').Target,
    TimeoutError: require('./Errors').TimeoutError,
    Touchscreen: require('./webkit/Input').Touchscreen,
  }
};
