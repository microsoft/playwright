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

import type { BrowserContextOptions, LaunchOptions } from '../../..';
import type { ActionInContext } from './codeGenerator';
import type { Action, DialogSignal, DownloadSignal, NavigationSignal, PopupSignal } from './recorderActions';

export type LanguageGeneratorOptions = {
  browserName: string;
  generateHeaders: boolean;
  launchOptions: LaunchOptions;
  contextOptions: BrowserContextOptions;
  deviceName?: string;
  saveStorage?: string;
};

export interface LanguageGenerator {
  id: string;
  fileName: string;
  highlighter: string;
  generateHeader(options: LanguageGeneratorOptions): string;
  generateAction(actionInContext: ActionInContext): string;
  generateFooter(saveStorage: string | undefined): string;
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

export function toSignalMap(action: Action) {
  let waitForNavigation: NavigationSignal | undefined;
  let assertNavigation: NavigationSignal | undefined;
  let popup: PopupSignal | undefined;
  let download: DownloadSignal | undefined;
  let dialog: DialogSignal | undefined;
  for (const signal of action.signals) {
    if (signal.name === 'navigation' && signal.isAsync)
      waitForNavigation = signal;
    else if (signal.name === 'navigation' && !signal.isAsync)
      assertNavigation = signal;
    else if (signal.name === 'popup')
      popup = signal;
    else if (signal.name === 'download')
      download = signal;
    else if (signal.name === 'dialog')
      dialog = signal;
  }
  return {
    waitForNavigation,
    assertNavigation,
    popup,
    download,
    dialog,
  };
}
