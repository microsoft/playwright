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

// Whenever the commands/events change, the version must be updated. The latest
// extension version should be compatible with the old MCP clients.
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

// Protocol v2: command params/results mirror chrome.* positional arguments,
// so the extension can spread them straight into chrome.<api>.<method>(...).
export type ExtensionCommandV2 = {
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
  // Playwright-specific: ask the user to pick a tab via the connect UI.
  'extension.selectTab': {
    params: [];
    result: { tabId: number };
  };
};

// Protocol v2 events mirror chrome.<api>.<event>.addListener callback signatures.
export type ExtensionEventsV2 = {
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
};

// Protocol v1: legacy single-tab interface.
export type ExtensionCommandV1 = {
  'attachToTab': {
    params: {};
    result: { targetInfo: any };
  };
  'forwardCDPCommand': {
    params: {
      method: string,
      sessionId?: string
      params?: any,
    };
    result: any;
  };
};

export type ExtensionEventsV1 = {
  'forwardCDPEvent': {
    params: {
      method: string,
      sessionId?: string
      params?: any,
    };
  };
};

// Combined types for the relay which supports both protocol versions.
export type ExtensionCommand = ExtensionCommandV1 & ExtensionCommandV2;
export type ExtensionEvents = ExtensionEventsV1 & ExtensionEventsV2;
