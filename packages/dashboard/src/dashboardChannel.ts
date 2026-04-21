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

export type AnnotationData = { x: number; y: number; width: number; height: number; text: string };

export type DashboardChannelEvents = {
  sessions: { sessions: SessionStatus[]; clientInfo: ClientInfo };
  tabs: { tabs: Tab[] };
  frame: { data: string; viewportWidth: number; viewportHeight: number };
  elementPicked: { selector: string; ariaSnapshot?: string };
  pickLocator: {};
  annotate: {};
};

export type MouseButton = 'left' | 'middle' | 'right';

export interface DashboardChannel {
  selectTab(params: { browser: string; page: string }): Promise<void>;
  closeTab(params: { browser: string; page: string }): Promise<void>;
  newTab(params: { browser: string }): Promise<void>;
  closeSession(params: { browser: string }): Promise<void>;
  deleteSessionData(params: { browser: string }): Promise<void>;
  setVisible(params: { visible: boolean }): Promise<void>;
  reveal(params: { path: string }): Promise<void>;

  navigate(params: { url: string }): Promise<void>;
  back(): Promise<void>;
  forward(): Promise<void>;
  reload(): Promise<void>;
  mousemove(params: { x: number; y: number }): Promise<void>;
  mousedown(params: { x: number; y: number; button?: MouseButton }): Promise<void>;
  mouseup(params: { x: number; y: number; button?: MouseButton }): Promise<void>;
  wheel(params: { deltaX: number; deltaY: number }): Promise<void>;
  keydown(params: { key: string }): Promise<void>;
  keyup(params: { key: string }): Promise<void>;
  pickLocator(): Promise<void>;
  cancelPickLocator(): Promise<void>;
  startRecording(): Promise<void>;
  stopRecording(): Promise<{ streamId: string }>;
  readStream(params: { streamId: string }): Promise<{ data: string; eof: boolean }>;
  screenshot(): Promise<string>;
  submitAnnotation(params: { data: string; annotations: AnnotationData[] }): Promise<void>;

  on<K extends keyof DashboardChannelEvents>(event: K, listener: (params: DashboardChannelEvents[K]) => void): void;
  off<K extends keyof DashboardChannelEvents>(event: K, listener: (params: DashboardChannelEvents[K]) => void): void;
}
