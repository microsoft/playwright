/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import type { BrowserContext } from './browserContext';
import type { ElementHandle } from './dom';
import type { Page } from './page';

export type ActionMetadata = {
  type: 'click' | 'fill' | 'dblclick' | 'hover' | 'selectOption' | 'setInputFiles' | 'type' | 'press' | 'check' | 'uncheck' | 'goto' | 'setContent' | 'goBack' | 'goForward' | 'reload',
  page: Page,
  target?: ElementHandle | string,
  value?: string,
  stack?: string,
};

export type ActionResult = {
  logs: string[],
  startTime: number,
  endTime: number,
  error?: Error,
};

export interface InstrumentingAgent {
  onContextCreated(context: BrowserContext): Promise<void>;
  onContextDestroyed(context: BrowserContext): Promise<void>;
  onAfterAction(result: ActionResult, metadata?: ActionMetadata): Promise<void>;
}

export const instrumentingAgents = new Set<InstrumentingAgent>();
