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

import { ChannelOwner } from './channelOwner';
import * as api from './api';

export type ChannelOwnerExtractor = (instance: any) => ChannelOwner | undefined;

type ApiMethods = {
  [key in keyof typeof api]?: string[];
};

export const apiMethods: ApiMethods = {
  'Accessibility': ['snapshot'],
  'Android': ['connect', 'devices', 'launchServer'],
  'AndroidDevice': ['close', 'drag', 'fill', 'fling', 'info', 'installApk', 'launchBrowser', 'longTap', 'open', 'pinchClose', 'pinchOpen', 'press', 'push', 'screenshot', 'scroll', 'shell', 'swipe', 'tap', 'wait', 'waitForEvent', 'webView'],
  'AndroidInput': ['drag', 'press', 'swipe', 'tap', 'type'],
  'AndroidSocket': ['close', 'write'],
  'AndroidWebView': ['page'],
  'APIRequest': ['newContext'],
  'APIRequestContext': ['delete', 'dispose', 'fetch', 'get', 'head', 'patch', 'post', 'put', 'storageState'],
  'APIResponse': ['body', 'dispose', 'json', 'text'],
  // 'APIResponseAssertions': ['toBeOK'],
  'Browser': ['close', 'newBrowserCDPSession', 'newContext', 'newPage', 'removeAllListeners', 'startTracing', 'stopTracing'],
  'BrowserContext': ['addCookies', 'addInitScript', 'clearCookies', 'clearPermissions', 'close', 'cookies', 'exposeBinding', 'exposeFunction', 'grantPermissions', 'newCDPSession', 'newPage', 'removeAllListeners', 'route', 'routeFromHAR', 'routeWebSocket', 'setExtraHTTPHeaders', 'setGeolocation', 'setHTTPCredentials', 'setOffline', 'storageState', 'unrouteAll', 'unroute', 'waitForEvent'],
  // 'BrowserServer': ['close', 'kill'],
  'BrowserType': ['connect', 'connectOverCDP', 'launch', 'launchPersistentContext', 'launchServer'],
  'CDPSession': ['detach', 'send'],
  'Clock': ['fastForward', 'install', 'runFor', 'pauseAt', 'resume', 'setFixedTime', 'setSystemTime'],
  'Coverage': ['startCSSCoverage', 'startJSCoverage', 'stopCSSCoverage', 'stopJSCoverage'],
  'Dialog': ['accept', 'dismiss'],
  'Download': ['cancel', 'createReadStream', 'delete', 'failure', 'path', 'saveAs'],
  'Electron': ['launch'],
  'ElectronApplication': ['browserWindow', 'close', 'evaluate', 'evaluateHandle', 'firstWindow', 'waitForEvent'],
  'ElementHandle': ['boundingBox', 'check', 'click', 'contentFrame', 'dblclick', 'dispatchEvent', '$eval', '$$eval', 'fill', 'focus', 'getAttribute', 'hover', 'innerHTML', 'innerText', 'inputValue', 'isChecked', 'isDisabled', 'isEditable', 'isEnabled', 'isHidden', 'isVisible', 'ownerFrame', 'press', '$', '$$', 'screenshot', 'scrollIntoViewIfNeeded', 'selectOption', 'selectText', 'setChecked', 'setInputFiles', 'tap', 'textContent', 'type', 'uncheck', 'waitForElementState', 'waitForSelector'],
  'FileChooser': ['setFiles'],
  'Frame': ['addScriptTag', 'addStyleTag', 'check', 'click', 'content', 'dblclick', 'dispatchEvent', 'dragAndDrop', '$eval', '$$eval', 'evaluate', 'evaluateHandle', 'fill', 'focus', 'frameElement', 'getAttribute', 'goto', 'hover', 'innerHTML', 'innerText', 'inputValue', 'isChecked', 'isDisabled', 'isEditable', 'isEnabled', 'isHidden', 'isVisible', 'press', '$', '$$', 'selectOption', 'setChecked', 'setContent', 'setInputFiles', 'tap', 'textContent', 'title', 'type', 'uncheck', 'waitForFunction', 'waitForLoadState', 'waitForNavigation', 'waitForSelector', 'waitForTimeout', 'waitForURL'],
  'JSHandle': ['dispose', 'evaluate', 'evaluateHandle', 'getProperties', 'getProperty', 'jsonValue'],
  'Keyboard': ['down', 'insertText', 'press', 'type', 'up'],
  'Locator': ['all', 'allInnerTexts', 'allTextContents', 'ariaSnapshot', 'blur', 'boundingBox', 'check', 'clear', 'click', 'count', 'dblclick', 'dispatchEvent', 'dragTo', 'elementHandle', 'elementHandles', 'evaluate', 'evaluateAll', 'evaluateHandle', 'fill', 'focus', 'getAttribute', 'highlight', 'hover', 'innerHTML', 'innerText', 'inputValue', 'isChecked', 'isDisabled', 'isEditable', 'isEnabled', 'isHidden', 'isVisible', 'press', 'pressSequentially', 'screenshot', 'scrollIntoViewIfNeeded', 'selectOption', 'selectText', 'setChecked', 'setInputFiles', 'tap', 'textContent', 'type', 'uncheck', 'waitFor'],
  // 'LocatorAssertions': ['toBeAttached', 'toBeChecked', 'toBeDisabled', 'toBeEditable', 'toBeEmpty', 'toBeEnabled', 'toBeFocused', 'toBeHidden', 'toBeInViewport', 'toBeVisible', 'toContainClass', 'toContainText', 'toHaveAccessibleDescription', 'toHaveAccessibleErrorMessage', 'toHaveAccessibleName', 'toHaveAttribute', 'toHaveAttribute', 'toHaveClass', 'toHaveCount', 'toHaveCSS', 'toHaveId', 'toHaveJSProperty', 'toHaveRole', 'toHaveScreenshot', 'toHaveScreenshot', 'toHaveText', 'toHaveValue', 'toHaveValues', 'toMatchAriaSnapshot', 'toMatchAriaSnapshot'],
  'Mouse': ['click', 'dblclick', 'down', 'move', 'up', 'wheel'],
  'Page': ['addInitScript', 'addScriptTag', 'addStyleTag', 'bringToFront', 'check', 'click', 'close', 'content', 'dblclick', 'dispatchEvent', 'dragAndDrop', 'emulateMedia', '$eval', '$$eval', 'evaluate', 'evaluateHandle', 'exposeBinding', 'exposeFunction', 'fill', 'focus', 'getAttribute', 'goBack', 'goForward', 'requestGC', 'goto', 'hover', 'innerHTML', 'innerText', 'inputValue', 'isChecked', 'isDisabled', 'isEditable', 'isEnabled', 'isHidden', 'isVisible', 'opener', 'pause', 'pdf', 'press', '$', '$$', 'addLocatorHandler', 'removeAllListeners', 'removeLocatorHandler', 'reload', 'route', 'routeFromHAR', 'routeWebSocket', 'screenshot', 'selectOption', 'setChecked', 'setContent', 'setExtraHTTPHeaders', 'setInputFiles', 'setViewportSize', 'tap', 'textContent', 'title', 'type', 'uncheck', 'unrouteAll', 'unroute', 'waitForEvent', 'waitForFunction', 'waitForLoadState', 'waitForNavigation', 'waitForRequest', 'waitForResponse', 'waitForSelector', 'waitForTimeout', 'waitForURL'],
  // 'PageAssertions': ['toHaveScreenshot', 'toHaveScreenshot', 'toHaveTitle', 'toHaveURL'],
  'Request': ['allHeaders', 'headersArray', 'headerValue', 'response', 'sizes'],
  'Response': ['allHeaders', 'body', 'finished', 'headersArray', 'headerValue', 'headerValues', 'json', 'securityDetails', 'serverAddr', 'text'],
  'Route': ['abort', 'continue', 'fallback', 'fetch', 'fulfill'],
  'Selectors': ['register'],
  'Touchscreen': ['tap'],
  'Tracing': ['start', 'startChunk', 'group', 'groupEnd', 'stop', 'stopChunk'],
  'Video': ['delete', 'path', 'saveAs'],
  'WebSocket': ['waitForEvent'],
  'WebSocketRoute': ['close'],
  'Worker': ['evaluate', 'evaluateHandle'],
};
