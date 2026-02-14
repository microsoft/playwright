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

export type Tab = { pageId: string; title: string; url: string; selected: boolean; inspectorUrl?: string };

export type DevToolsChannelEvents = {
  frame: { data: string; viewportWidth: number; viewportHeight: number };
  tabs: { tabs: Tab[] };
  elementPicked: { selector: string };
};

export interface DevToolsChannel {
  version: 1;
  tabs(): Promise<{ tabs: Tab[] }>;
  selectTab(params: { pageId: string }): Promise<void>;
  closeTab(params: { pageId: string }): Promise<void>;
  newTab(): Promise<void>;
  navigate(params: { url: string }): Promise<void>;
  back(): Promise<void>;
  forward(): Promise<void>;
  reload(): Promise<void>;
  mousemove(params: { x: number; y: number }): Promise<void>;
  mousedown(params: { x: number; y: number; button?: 'left' | 'right' | 'middle' }): Promise<void>;
  mouseup(params: { x: number; y: number; button?: 'left' | 'right' | 'middle' }): Promise<void>;
  wheel(params: { deltaX: number; deltaY: number }): Promise<void>;
  keydown(params: { key: string }): Promise<void>;
  keyup(params: { key: string }): Promise<void>;
  pickLocator(): Promise<void>;
  cancelPickLocator(): Promise<void>;

  on<K extends keyof DevToolsChannelEvents>(event: K, listener: (params: DevToolsChannelEvents[K]) => void): void;
  off<K extends keyof DevToolsChannelEvents>(event: K, listener: (params: DevToolsChannelEvents[K]) => void): void;
}
