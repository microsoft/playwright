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

import type { BrowserContextOptions } from '../../..';
import type * as actions from '../recorder/recorderActions';
import type * as types from '../types';
import type { ActionInContext, LanguageGenerator, LanguageGeneratorOptions } from './types';

export function generateCode(actions: ActionInContext[], languageGenerator: LanguageGenerator, options: LanguageGeneratorOptions) {
  const header = languageGenerator.generateHeader(options);
  const footer = languageGenerator.generateFooter(options.saveStorage);
  const actionTexts = actions.map(a => languageGenerator.generateAction(a)).filter(Boolean);
  const text = [header, ...actionTexts, footer].join('\n');
  return { header, footer, actionTexts, text };
}

export function sanitizeDeviceOptions(device: any, options: BrowserContextOptions): BrowserContextOptions {
  // Filter out all the properties from the device descriptor.
  const cleanedOptions: Record<string, any> = {};
  for (const property in options) {
    if (JSON.stringify(device[property]) !== JSON.stringify((options as any)[property]))
      cleanedOptions[property] = (options as any)[property];
  }
  return cleanedOptions;
}

export function toSignalMap(action: actions.Action) {
  let popup: actions.PopupSignal | undefined;
  let download: actions.DownloadSignal | undefined;
  let dialog: actions.DialogSignal | undefined;
  for (const signal of action.signals) {
    if (signal.name === 'popup')
      popup = signal;
    else if (signal.name === 'download')
      download = signal;
    else if (signal.name === 'dialog')
      dialog = signal;
  }
  return {
    popup,
    download,
    dialog,
  };
}

export function toKeyboardModifiers(modifiers: number): types.SmartKeyboardModifier[] {
  const result: types.SmartKeyboardModifier[] = [];
  if (modifiers & 1)
    result.push('Alt');
  if (modifiers & 2)
    result.push('ControlOrMeta');
  if (modifiers & 4)
    result.push('ControlOrMeta');
  if (modifiers & 8)
    result.push('Shift');
  return result;
}

export function toClickOptions(action: actions.ClickAction): types.MouseClickOptions {
  const modifiers = toKeyboardModifiers(action.modifiers);
  const options: types.MouseClickOptions = {};
  if (action.button !== 'left')
    options.button = action.button;
  if (modifiers.length)
    options.modifiers = modifiers;
  if (action.clickCount > 2)
    options.clickCount = action.clickCount;
  if (action.position)
    options.position = action.position;
  return options;
}
