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

import type { EventEmitter } from 'events';

import type * as api from '../../../types/types';
import type { BrowserDescriptor } from '../../serverRegistry';

export type ContextEntry = {
  browser: api.Browser;
  context: api.BrowserContext;
  descriptor: BrowserDescriptor;
};

export const SessionProviderEvent = {
  SessionsChanged: 'sessionsChanged',
  TabsChanged: 'tabsChanged',
  ContextClosed: 'contextClosed',
  AttachRequested: 'attachRequested',
} as const;

export type SessionProviderEventMap = {
  [SessionProviderEvent.SessionsChanged]: [];
  [SessionProviderEvent.TabsChanged]: [];
  [SessionProviderEvent.ContextClosed]: [context: api.BrowserContext];
  [SessionProviderEvent.AttachRequested]: [page: api.Page];
};

export interface SessionProvider extends EventEmitter<SessionProviderEventMap> {
  start(): void;
  sessions(): Promise<BrowserDescriptor[]>;
  closeSession(browserId: string): Promise<void>;
  contextEntries(): ContextEntry[];
  findContext(params: { browser: string; context: string }): api.BrowserContext | undefined;
  findPage(params: { browser: string; context: string; page: string }): api.Page | undefined;
  dispose(): void;
}
