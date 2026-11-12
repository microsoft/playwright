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


export type GroupColor = `${chrome.tabGroups.Color}`;

export type SessionOptions = {
  clientName: string;
  tabGroup?: { title?: string, color?: string };
  background: boolean;
};

export type Selection = {
  groupId?: number;
  tabIds?: number[];
};

export type CandidateGroup = {
  id: number;
  title: string;
  color: GroupColor;
  tabs: chrome.tabs.Tab[];
};

export type Candidates = {
  groups: CandidateGroup[];
  tabs: chrome.tabs.Tab[];
};

export type SessionStatus = {
  id: number;
  clientName: string;
  tabIds: number[];
};

export type PageMessage =
  | { type: 'connectionRequested', mcpRelayUrl: string }
  | { type: 'getCandidates' }
  | { type: 'connect', options: SessionOptions, selection: Selection }
  | { type: 'keepalive' }
  | { type: 'getStatus' }
  | { type: 'disconnect', sessionId: number };
