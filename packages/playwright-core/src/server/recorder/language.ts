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
import type { CSSComplexSelectorList } from '../isomorphic/cssParser';
import { parseAttributeSelector, parseSelector, stringifySelector } from '../isomorphic/selectorParser';
import type { ParsedSelector } from '../isomorphic/selectorParser';
import type { ActionInContext } from './codeGenerator';
import type { Action, DialogSignal, DownloadSignal, NavigationSignal, PopupSignal } from './recorderActions';

export type LanguageGeneratorOptions = {
  browserName: string;
  launchOptions: LaunchOptions;
  contextOptions: BrowserContextOptions;
  deviceName?: string;
  saveStorage?: string;
};

export type LocatorType = 'default' | 'role' | 'text' | 'label' | 'placeholder' | 'alt' | 'title' | 'test-id' | 'nth' | 'first' | 'last' | 'has-text';
export type LocatorBase = 'page' | 'locator' | 'frame-locator';

export interface LanguageGenerator {
  id: string;
  groupName: string;
  name: string;
  highlighter: string;
  generateHeader(options: LanguageGeneratorOptions): string;
  generateAction(actionInContext: ActionInContext): string;
  generateFooter(saveStorage: string | undefined): string;
  generateLocator(base: LocatorBase, kind: LocatorType, body: string, options?: { attrs?: Record<string, string | boolean>, hasText?: string, exact?: boolean }): string;
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
  let assertNavigation: NavigationSignal | undefined;
  let popup: PopupSignal | undefined;
  let download: DownloadSignal | undefined;
  let dialog: DialogSignal | undefined;
  for (const signal of action.signals) {
    if (signal.name === 'navigation')
      assertNavigation = signal;
    else if (signal.name === 'popup')
      popup = signal;
    else if (signal.name === 'download')
      download = signal;
    else if (signal.name === 'dialog')
      dialog = signal;
  }
  return {
    assertNavigation,
    popup,
    download,
    dialog,
  };
}

function detectExact(text: string): { exact: boolean, text: string } {
  let exact = false;
  if (text.startsWith('"') && text.endsWith('"')) {
    text = JSON.parse(text);
    exact = true;
  }
  return { exact, text };
}

export function asLocator(generator: LanguageGenerator, selector: string, isFrameLocator: boolean = false): string {
  const parsed = parseSelector(selector);
  const tokens: string[] = [];
  for (const part of parsed.parts) {
    const base = part === parsed.parts[0] ? (isFrameLocator ? 'frame-locator' : 'page') : 'locator';
    if (part.name === 'nth') {
      if (part.body === '0')
        tokens.push(generator.generateLocator(base, 'first', ''));
      else if (part.body === '-1')
        tokens.push(generator.generateLocator(base, 'last', ''));
      else
        tokens.push(generator.generateLocator(base, 'nth', part.body as string));
      continue;
    }
    if (part.name === 'text') {
      const { exact, text } = detectExact(part.body as string);
      tokens.push(generator.generateLocator(base, 'text', text, { exact }));
      continue;
    }
    if (part.name === 'role') {
      const attrSelector = parseAttributeSelector(part.body as string, true);
      const attrs: Record<string, boolean | string> = {};
      for (const attr of attrSelector.attributes!)
        attrs[attr.name === 'include-hidden' ? 'includeHidden' : attr.name] = attr.value;
      tokens.push(generator.generateLocator(base, 'role', attrSelector.name, { attrs }));
      continue;
    }
    if (part.name === 'css') {
      const parsed = part.body as CSSComplexSelectorList;
      if (parsed[0].simples.length === 1 && parsed[0].simples[0].selector.functions.length === 1 && parsed[0].simples[0].selector.functions[0].name === 'hasText') {
        const hasText = parsed[0].simples[0].selector.functions[0].args[0] as string;
        tokens.push(generator.generateLocator(base, 'has-text', parsed[0].simples[0].selector.css!, { hasText }));
        continue;
      }
    }

    if (part.name === 'attr') {
      const attrSelector = parseAttributeSelector(part.body as string, true);
      const { name, value } = attrSelector.attributes[0];
      if (name === 'data-testid') {
        tokens.push(generator.generateLocator(base, 'test-id', value));
        continue;
      }

      const { exact, text } = detectExact(value);
      if (name === 'placeholder') {
        tokens.push(generator.generateLocator(base, 'placeholder', text, { exact }));
        continue;
      }
      if (name === 'alt') {
        tokens.push(generator.generateLocator(base, 'alt', text, { exact }));
        continue;
      }
      if (name === 'title') {
        tokens.push(generator.generateLocator(base, 'title', text, { exact }));
        continue;
      }
      if (name === 'label') {
        tokens.push(generator.generateLocator(base, 'label', text, { exact }));
        continue;
      }
    }
    const p: ParsedSelector = { parts: [part] };
    tokens.push(generator.generateLocator(base, 'default', stringifySelector(p)));
  }
  return tokens.join('.');
}
