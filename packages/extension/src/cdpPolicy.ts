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


const BROWSER_STATE_METHODS = new Set([
  'Storage.setCookies',
  'Storage.clearCookies',
  'Network.clearBrowserCookies',
  'Network.clearBrowserCache',
  'Browser.grantPermissions',
  'Browser.resetPermissions',
  'Browser.setPermission',
  'Browser.setDownloadBehavior',
  'Target.createTarget',
  'Target.closeTarget',
  'Target.attachToTarget',
  'Target.activateTarget',
]);

export function checkCdpMethod(method: string): void {
  if (BROWSER_STATE_METHODS.has(method))
    throw new Error(`${method} is not allowed: it changes the state of the browser, not of the tab`);
}
