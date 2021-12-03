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

import { Frame } from '../../frames';
import * as actions from './recorderActions';

export type MouseClickOptions = Parameters<Frame['click']>[2];

export function toClickOptions(action: actions.ClickAction): { method: 'click' | 'dblclick', options: MouseClickOptions } {
  let method: 'click' | 'dblclick' = 'click';
  if (action.clickCount === 2)
    method = 'dblclick';
  const modifiers = toModifiers(action.modifiers);
  const options: MouseClickOptions = {};
  if (action.button !== 'left')
    options.button = action.button;
  if (modifiers.length)
    options.modifiers = modifiers;
  if (action.clickCount > 2)
    options.clickCount = action.clickCount;
  if (action.position)
    options.position = action.position;
  return { method, options };
}

export function toModifiers(modifiers: number): ('Alt' | 'Control' | 'Meta' | 'Shift')[] {
  const result: ('Alt' | 'Control' | 'Meta' | 'Shift')[] = [];
  if (modifiers & 1)
    result.push('Alt');
  if (modifiers & 2)
    result.push('Control');
  if (modifiers & 4)
    result.push('Meta');
  if (modifiers & 8)
    result.push('Shift');
  return result;
}

export function describeFrame(frame: Frame): { frameName?: string, frameUrl: string, isMainFrame: boolean } {
  const page = frame._page;
  if (page.mainFrame() === frame)
    return { isMainFrame: true, frameUrl: frame.url() };
  const frames = page.frames().filter(f => f.name() === frame.name());
  if (frames.length === 1 && frames[0] === frame)
    return { isMainFrame: false, frameUrl: frame.url(), frameName: frame.name() };
  return { isMainFrame: false, frameUrl: frame.url() };
}
