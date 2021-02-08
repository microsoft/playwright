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
import type * as dom from './dom';
import type * as types from './types';
import type { BrowserContext } from './browserContext';
import type { ProgressResult } from './progress';
import type { Page } from './page';

export interface ContextListener {
  onContextCreated?(context: BrowserContext): Promise<void>;
  onContextWillDestroy?(context: BrowserContext): Promise<void>;
  onContextDidDestroy?(context: BrowserContext): Promise<void>;
}

export type ActionMetadata = {
  type: 'click' | 'fill' | 'dblclick' | 'hover' | 'selectOption' | 'setInputFiles' | 'type' | 'press' | 'check' | 'uncheck' | 'goto' | 'setContent' | 'goBack' | 'goForward' | 'reload' | 'tap',
  page: Page,
  target?: dom.ElementHandle | string,
  value?: string,
  stack?: string,
};

export interface ActionListener {
  onActionCheckpoint(name: string, metadata: ActionMetadata): Promise<void>;
  onAfterAction(result: ProgressResult, metadata: ActionMetadata): Promise<void>;
}

export type InputEvent = {
  type: 'mouse.down',
  x: number,
  y: number,
  buttons: Set<types.MouseButton>,
} | {
  type: 'mouse.up',
  x: number,
  y: number,
  buttons: Set<types.MouseButton>,
} | {
  type: 'mouse.move',
  x: number,
  y: number,
  buttons: Set<types.MouseButton>,
} | {
  type: 'keyboard.down',
  key: string,
  code: string,
  modifiers: Set<types.KeyboardModifier>,
} | {
  type: 'keyboard.up',
} | {
  type: 'keyboard.insertText',
  text: string,
} | {
  type: 'touchscreen.tap',
  x: number,
  y: number,
} | {
  type: 'screenshot'
};
