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

import type { ClientInfo } from '../../playwright-core/src/tools/cli-client/registry';
import type { SessionStatus } from './sessionModel';
import type { ContextEntry } from '@isomorphic/trace/entries';

export type BrowserTarget = { browser: string };
export type ContextTarget = { browser: string; context: string };
export type PageTarget = { browser: string; context: string; page: string };

export type Tab = {
  browser: string;
  context: string;
  page: string;
  title: string;
  url: string;
  selected: boolean;
  faviconUrl?: string;
  inspectorUrl?: string;
};

export type DashboardChannelEvents = {
  sessions: { sessions: SessionStatus[]; clientInfo: ClientInfo };
  tabs: { target: ContextTarget; tabs: Tab[] };
  frame: { target: PageTarget; data: string; viewportWidth: number; viewportHeight: number };
  elementPicked: { target: PageTarget; selector: string; ariaSnapshot?: string };
  pickLocator: { target: PageTarget };
};

export type MouseButton = 'left' | 'middle' | 'right';

export interface DashboardChannel {
  attach(params: BrowserTarget): Promise<{ context: string }>;
  detach(params: BrowserTarget): Promise<void>;
  closeSession(params: BrowserTarget): Promise<void>;
  deleteSessionData(params: BrowserTarget): Promise<void>;
  setVisible(params: { browser?: string }): Promise<void>;

  tabs(params: ContextTarget): Promise<{ tabs: Tab[] }>;
  newTab(params: ContextTarget): Promise<{ page: string }>;

  selectTab(params: PageTarget): Promise<void>;
  closeTab(params: PageTarget): Promise<void>;
  navigate(params: PageTarget & { url: string }): Promise<void>;
  back(params: PageTarget): Promise<void>;
  forward(params: PageTarget): Promise<void>;
  reload(params: PageTarget): Promise<void>;
  mousemove(params: PageTarget & { x: number; y: number }): Promise<void>;
  mousedown(params: PageTarget & { x: number; y: number; button?: MouseButton }): Promise<void>;
  mouseup(params: PageTarget & { x: number; y: number; button?: MouseButton }): Promise<void>;
  wheel(params: PageTarget & { deltaX: number; deltaY: number }): Promise<void>;
  keydown(params: PageTarget & { key: string }): Promise<void>;
  keyup(params: PageTarget & { key: string }): Promise<void>;
  pickLocator(params: PageTarget): Promise<void>;
  cancelPickLocator(params: PageTarget): Promise<void>;
  startTracing(params: BrowserTarget): Promise<void>;
  traceContextEntries(params: BrowserTarget): Promise<{ contextEntries: ContextEntry[], tracesDir: string }>;
  startRecording(params: PageTarget): Promise<void>;
  stopRecording(params: PageTarget): Promise<{ path: string }>;
  screenshot(params: PageTarget): Promise<string>;
  reveal(params: { path: string }): Promise<void>;

  on<K extends keyof DashboardChannelEvents>(event: K, listener: (params: DashboardChannelEvents[K]) => void): void;
  off<K extends keyof DashboardChannelEvents>(event: K, listener: (params: DashboardChannelEvents[K]) => void): void;
}
