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

// Wire protocol between the CDP relay (this package) and the Playwright
// extension (packages/extension). BrowserModel sends the commands and handles
// the events. The extension side lives in packages/extension/src/clientSession.ts:
// it runs a command only for a tab that the client owns.

// The protocol version defined in this file. Bumped whenever the
// commands/events change. Sent to the extension, which rejects clients
// requesting a version it does not support.
export const VERSION = 2;

// Structural mirrors of @types/chrome shapes used over the wire. The extension
// imports the real chrome.* types and they are structurally compatible.
export type Debuggee = { tabId?: number; extensionId?: string; targetId?: string };
export type DebuggerSession = Debuggee & { sessionId?: string };
export type TabCreateProperties = {
  active?: boolean;
  index?: number;
  openerTabId?: number;
  pinned?: boolean;
  url?: string;
  windowId?: number;
};
export type Tab = {
  id?: number;
  index: number;
  windowId: number;
  openerTabId?: number;
  url?: string;
  title?: string;
  active: boolean;
  pinned: boolean;
};
export type TabRemoveInfo = { windowId: number; isWindowClosing: boolean };

// Command params/results mirror chrome.* positional arguments, so the
// extension can spread them straight into chrome.<api>.<method>(...).
export type ExtensionCommands = {
  // chrome.debugger.attach(target, requiredVersion)
  'chrome.debugger.attach': {
    params: [target: Debuggee, requiredVersion: string];
    result: void;
  };
  // chrome.debugger.detach(target)
  'chrome.debugger.detach': {
    params: [target: Debuggee];
    result: void;
  };
  // chrome.debugger.sendCommand(target, method, commandParams?)
  'chrome.debugger.sendCommand': {
    params: [target: DebuggerSession, method: string, commandParams?: object];
    result: any;
  };
  // chrome.tabs.create(createProperties)
  'chrome.tabs.create': {
    params: [createProperties: TabCreateProperties];
    result: Tab;
  };
  // chrome.tabs.remove(tabIds)
  'chrome.tabs.remove': {
    params: [tabIds: number | number[]];
    result: void;
  };
};

// Events mirror chrome.<api>.<event>.addListener callback signatures.
export type ExtensionEvents = {
  // chrome.debugger.onEvent: (source, method, params?) => void
  'chrome.debugger.onEvent': {
    params: [source: DebuggerSession, method: string, eventParams?: object];
  };
  // chrome.debugger.onDetach: (source, reason) => void
  'chrome.debugger.onDetach': {
    params: [source: Debuggee, reason: string];
  };
  // chrome.tabs.onCreated: (tab) => void
  'chrome.tabs.onCreated': {
    params: [tab: Tab];
  };
  // chrome.tabs.onRemoved: (tabId, removeInfo) => void
  'chrome.tabs.onRemoved': {
    params: [tabId: number, removeInfo: TabRemoveInfo];
  };
  // Playwright-specific: signals end of the initial tab handshake, see cdpRelay.ts.
  'extension.initialized': {
    params: [];
  };
};

export type ExtensionEvent = { [M in keyof ExtensionEvents]: { method: M, params: ExtensionEvents[M]['params'] } }[keyof ExtensionEvents];
