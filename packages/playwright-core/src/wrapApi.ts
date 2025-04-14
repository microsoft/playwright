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

import { ChannelOwner } from './client/channelOwner';
import { wrapPromiseAPIResult } from './utils';
import * as api from './client/api';

type ChannelOwnerExtractor = (instance: any) => ChannelOwner | undefined;

const apiMethods = new Map<string, { members: string[], channelOwner?: ChannelOwnerExtractor }>([
  ['Accessibility', { channelOwner: (instance: api.Accessibility) => api.Page.from(instance['_channel']), members: ['snapshot'] }],
  ['Android', { members: ['connect', 'devices', 'launchServer'] }],
  ['AndroidDevice', { members: ['close', 'drag', 'fill', 'fling', 'info', 'installApk', 'launchBrowser', 'longTap', 'open', 'pinchClose', 'pinchOpen', 'press', 'push', 'screenshot', 'scroll', 'shell', 'swipe', 'tap', 'wait', 'waitForEvent', 'webView'] }],
  ['AndroidInput', { members: ['drag', 'press', 'swipe', 'tap', 'type'] }],
  ['AndroidSocket', { members: ['close', 'write'] }],
  ['AndroidWebView', { members: ['page'] }],
  ['ApiRequest', { members: ['newContext'] }],
  ['ApiRequestContext', { members: ['delete', 'dispose', 'fetch', 'get', 'head', 'patch', 'post', 'put', 'storageState'] }],
  ['ApiResponse', { members: ['body', 'dispose', 'json', 'text'] }],
  ['ApiResponseAssertions', { members: ['toBeOK'] }],
  ['Browser', { members: ['close', 'newBrowserCDPSession', 'newContext', 'newPage', 'removeAllListeners', 'startTracing', 'stopTracing'] }],
  ['BrowserContext', { members: ['addCookies', 'addInitScript', 'clearCookies', 'clearPermissions', 'close', 'cookies', 'exposeBinding', 'exposeFunction', 'grantPermissions', 'newCDPSession', 'newPage', 'removeAllListeners', 'route', 'routeFromHAR', 'routeWebSocket', 'setExtraHTTPHeaders', 'setGeolocation', 'setHTTPCredentials', 'setOffline', 'storageState', 'unrouteAll', 'unroute', 'waitForEvent'] }],
  ['BrowserServer', { members: ['close', 'kill'] }],
  ['BrowserType', { members: ['connect', 'connectOverCDP', 'launch', 'launchPersistentContext', 'launchServer'] }],
  ['CdpSession', { members: ['detach', 'send'] }],
  ['Clock', { channelOwner: (instance: api.Clock) => instance['_browserContext'], members: ['fastForward', 'install', 'runFor', 'pauseAt', 'resume', 'setFixedTime', 'setSystemTime'] }],
  ['Coverage', { channelOwner: (instance: api.Coverage) => api.Page.from(instance['_channel']), members: ['startCSSCoverage', 'startJSCoverage', 'stopCSSCoverage', 'stopJSCoverage'] }],
  ['Dialog', { members: ['accept', 'dismiss'] }],
  ['Download', { channelOwner: (instance: api.Download) => instance['_page'], members: ['cancel', 'createReadStream', 'delete', 'failure', 'path', 'saveAs'] }],
  ['Electron', { members: ['launch'] }],
  ['ElectronApplication', { members: ['browserWindow', 'close', 'evaluate', 'evaluateHandle', 'firstWindow', 'waitForEvent'] }],
  ['ElementHandle', { members: ['boundingBox', 'check', 'click', 'contentFrame', 'dblclick', 'dispatchEvent', '$eval', '$$eval', 'fill', 'focus', 'getAttribute', 'hover', 'innerHTML', 'innerText', 'inputValue', 'isChecked', 'isDisabled', 'isEditable', 'isEnabled', 'isHidden', 'isVisible', 'ownerFrame', 'press', '$', '$$', 'screenshot', 'scrollIntoViewIfNeeded', 'selectOption', 'selectText', 'setChecked', 'setInputFiles', 'tap', 'textContent', 'type', 'uncheck', 'waitForElementState', 'waitForSelector'] }],
  ['FileChooser', { channelOwner: (instance: api.FileChooser) => instance['_page'], members: ['setFiles'] }],
  ['Frame', { members: ['addScriptTag', 'addStyleTag', 'check', 'click', 'content', 'dblclick', 'dispatchEvent', 'dragAndDrop', '$eval', '$$eval', 'evaluate', 'evaluateHandle', 'fill', 'focus', 'frameElement', 'getAttribute', 'goto', 'hover', 'innerHTML', 'innerText', 'inputValue', 'isChecked', 'isDisabled', 'isEditable', 'isEnabled', 'isHidden', 'isVisible', 'press', '$', '$$', 'selectOption', 'setChecked', 'setContent', 'setInputFiles', 'tap', 'textContent', 'title', 'type', 'uncheck', 'waitForFunction', 'waitForLoadState', 'waitForNavigation', 'waitForSelector', 'waitForTimeout', 'waitForURL'] }],
  ['JsHandle', { members: ['dispose', 'evaluate', 'evaluateHandle', 'getProperties', 'getProperty', 'jsonValue'] }],
  ['Keyboard', { channelOwner: (instance: api.Keyboard) => instance['_page'], members: ['down', 'insertText', 'press', 'type', 'up'] }],
  ['Locator', { channelOwner: (instance: api.Locator) => instance._frame, members: ['all', 'allInnerTexts', 'allTextContents', 'ariaSnapshot', 'blur', 'boundingBox', 'check', 'clear', 'click', 'count', 'dblclick', 'dispatchEvent', 'dragTo', 'elementHandle', 'elementHandles', 'evaluate', 'evaluateAll', 'evaluateHandle', 'fill', 'focus', 'getAttribute', 'highlight', 'hover', 'innerHTML', 'innerText', 'inputValue', 'isChecked', 'isDisabled', 'isEditable', 'isEnabled', 'isHidden', 'isVisible', 'press', 'pressSequentially', 'screenshot', 'scrollIntoViewIfNeeded', 'selectOption', 'selectText', 'setChecked', 'setInputFiles', 'tap', 'textContent', 'type', 'uncheck', 'waitFor'] }],
  ['LocatorAssertions', { members: ['toBeAttached', 'toBeChecked', 'toBeDisabled', 'toBeEditable', 'toBeEmpty', 'toBeEnabled', 'toBeFocused', 'toBeHidden', 'toBeInViewport', 'toBeVisible', 'toContainClass', 'toContainText', 'toHaveAccessibleDescription', 'toHaveAccessibleErrorMessage', 'toHaveAccessibleName', 'toHaveAttribute', 'toHaveAttribute', 'toHaveClass', 'toHaveCount', 'toHaveCSS', 'toHaveId', 'toHaveJSProperty', 'toHaveRole', 'toHaveScreenshot', 'toHaveScreenshot', 'toHaveText', 'toHaveValue', 'toHaveValues', 'toMatchAriaSnapshot', 'toMatchAriaSnapshot'] }],
  ['Mouse', { channelOwner: (instance: api.Mouse) => instance['_page'], members: ['click', 'dblclick', 'down', 'move', 'up', 'wheel'] }],
  ['Page', { members: ['addInitScript', 'addScriptTag', 'addStyleTag', 'bringToFront', 'check', 'click', 'close', 'content', 'dblclick', 'dispatchEvent', 'dragAndDrop', 'emulateMedia', '$eval', '$$eval', 'evaluate', 'evaluateHandle', 'exposeBinding', 'exposeFunction', 'fill', 'focus', 'getAttribute', 'goBack', 'goForward', 'requestGC', 'goto', 'hover', 'innerHTML', 'innerText', 'inputValue', 'isChecked', 'isDisabled', 'isEditable', 'isEnabled', 'isHidden', 'isVisible', 'opener', 'pause', 'pdf', 'press', '$', '$$', 'addLocatorHandler', 'removeAllListeners', 'removeLocatorHandler', 'reload', 'route', 'routeFromHAR', 'routeWebSocket', 'screenshot', 'selectOption', 'setChecked', 'setContent', 'setExtraHTTPHeaders', 'setInputFiles', 'setViewportSize', 'tap', 'textContent', 'title', 'type', 'uncheck', 'unrouteAll', 'unroute', 'waitForEvent', 'waitForFunction', 'waitForLoadState', 'waitForNavigation', 'waitForRequest', 'waitForResponse', 'waitForSelector', 'waitForTimeout', 'waitForURL'] }],
  ['PageAssertions', { members: ['toHaveScreenshot', 'toHaveScreenshot', 'toHaveTitle', 'toHaveURL'] }],
  ['Request', { members: ['allHeaders', 'headersArray', 'headerValue', 'response', 'sizes'] }],
  ['Response', { members: ['allHeaders', 'body', 'finished', 'headersArray', 'headerValue', 'headerValues', 'json', 'securityDetails', 'serverAddr', 'text'] }],
  ['Route', { members: ['abort', 'continue', 'fallback', 'fetch', 'fulfill'] }],
  ['Selectors', { channelOwner: (instance: api.Selectors) => instance['_channels'].size > 0 ? [...instance['_channels']][0] : undefined, members: ['register'] }],
  ['Touchscreen', { channelOwner: (instance: api.Touchscreen) => instance['_page'], members: ['tap'] }],
  ['Tracing', { members: ['start', 'startChunk', 'group', 'groupEnd', 'stop', 'stopChunk'] }],
  ['Video', { channelOwner: (instance: api.Video) => instance['_artifact'], members: ['delete', 'path', 'saveAs'] }],
  ['WebSocket', { members: ['waitForEvent'] }],
  ['WebSocketRoute', { members: ['close'] }],
  ['Worker', { members: ['evaluate', 'evaluateHandle'] }],
]);

type WrapPromiseAPIPrototype = {
  <T extends new (...args: any[]) => ChannelOwner>(Class: T, members: string[]): void;
  <T extends new (...args: any[]) => unknown>(Class: T, members: string[], getChannelOwnerFromInstance: (instance: InstanceType<T>) => ChannelOwner | undefined): void;
};

const wrapPromiseAPIPrototype: WrapPromiseAPIPrototype = (Class: new (...args: any[]) => unknown, members: string[], getChannelOwnerFromInstance?: (instance: unknown) => ChannelOwner | undefined) => {
  if (Class.prototype.__wrappedPromiseAPI)
    throw new Error('Attempted to wrap a class promise API multiple times');
  Class.prototype.__wrappedPromiseAPI = true;

  for (const prop of members) {
    const original = Class.prototype[prop];
    // Preserve the original function's `this`
    const wrapper = function(this: unknown, ...args: any[]) {
      const channelOwner = getChannelOwnerFromInstance ? getChannelOwnerFromInstance(this) : this as ChannelOwner;
      if (!channelOwner)
        return original.apply(this, args);
      if (!channelOwner._wrapApiCall)
        throw new Error(`Cannot wrap API call for ${channelOwner.constructor.name} (source ${(this as any).constructor.name}): _wrapApiCall is not defined`);
      // Create a new apiZone (if necessary) no matter what
      return channelOwner._wrapApiCall(_apiZone => original.apply(this, args), undefined, (apiZone, result) =>
        wrapPromiseAPIResult(result as any, apiZone.frames[0], channelOwner._instrumentation.onRegisterApiPromise, channelOwner._instrumentation.onUnregisterApiPromise)
      );
    };
    wrapper.__wrappedPromiseAPI = true;
    Object.defineProperty(Class.prototype, prop, {
      value: wrapper,
      writable: true,
      configurable: true,
      enumerable: Object.getOwnPropertyDescriptor(Class.prototype, prop)?.enumerable ?? false
    });
  }
};

export const wrapAllApis = () => {
  for (const [className, { members, channelOwner }] of apiMethods) {
    const apiClass = api[className as keyof typeof api];
    if (!apiClass)
      continue;
    wrapPromiseAPIPrototype(apiClass, members, channelOwner as ChannelOwnerExtractor);
  }
};
