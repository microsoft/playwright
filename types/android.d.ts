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

import { EventEmitter } from 'events';
import { BrowserContextOptions, Page, ChromiumBrowserContext } from './types';

export interface Android extends EventEmitter {
  setDefaultTimeout(timeout: number): void;
  devices(): Promise<AndroidDevice[]>;
}

export interface AndroidDevice extends EventEmitter {
  input: AndroidInput;

  setDefaultTimeout(timeout: number): void;
  on(event: 'webview', handler: (webView: AndroidWebView) => void): this;
  waitForEvent(event: string, optionsOrPredicate?: (data: any) => boolean | { timeout?: number, predicate?: (data: any) => boolean }): Promise<any>;

  serial(): string;
  model(): string;
  webViews(): AndroidWebView[];
  webView(selector: { pkg: string }, options?: { timeout?: number }): Promise<AndroidWebView>;
  shell(command: string): Promise<Buffer>;
  open(command: string): Promise<AndroidSocket>;
  installApk(file: string | Buffer, options?: { args?: string[] }): Promise<void>;
  push(file: string | Buffer, path: string, options?: { mode?: number }): Promise<void>;
  launchBrowser(options?: BrowserContextOptions & { pkg?: string  }): Promise<ChromiumBrowserContext>;
  close(): Promise<void>;

  wait(selector: AndroidSelector, options?: { state?: 'gone' } & { timeout?: number }): Promise<void>;
  fill(selector: AndroidSelector, text: string, options?: { timeout?: number }): Promise<void>;
  press(selector: AndroidSelector, key: AndroidKey, options?: { duration?: number } & { timeout?: number }): Promise<void>;
  tap(selector: AndroidSelector, options?: { duration?: number } & { timeout?: number }): Promise<void>;
  drag(selector: AndroidSelector, dest: { x: number, y: number }, options?: { speed?: number } & { timeout?: number }): Promise<void>;
  fling(selector: AndroidSelector, direction: 'down' | 'up' | 'left' | 'right', options?: { speed?: number } & { timeout?: number }): Promise<void>;
  longTap(selector: AndroidSelector, options?: { timeout?: number }): Promise<void>;
  pinchClose(selector: AndroidSelector, percent: number, options?: { speed?: number } & { timeout?: number }): Promise<void>;
  pinchOpen(selector: AndroidSelector, percent: number, options?: { speed?: number } & { timeout?: number }): Promise<void>;
  scroll(selector: AndroidSelector,  direction: 'down' | 'up' | 'left' | 'right', percent: number, options?: { speed?: number } & { timeout?: number }): Promise<void>;
  swipe(selector: AndroidSelector, direction: 'down' | 'up' | 'left' | 'right', percent: number, options?: { speed?: number } & { timeout?: number }): Promise<void>;

  info(selector: AndroidSelector): Promise<AndroidElementInfo>;
  screenshot(options?: { path?: string }): Promise<Buffer>;
}

export interface AndroidSocket extends EventEmitter {
  on(event: 'data', handler: (data: Buffer) => void): this;
  on(event: 'close', handler: () => void): this;
  write(data: Buffer): Promise<void>;
  close(): Promise<void>;
}

export interface AndroidInput {
  type(text: string): Promise<void>;
  press(key: AndroidKey): Promise<void>;
  tap(point: { x: number, y: number }): Promise<void>;
  swipe(from: { x: number, y: number }, segments: { x: number, y: number }[], steps: number): Promise<void>;
  drag(from: { x: number, y: number }, to: { x: number, y: number }, steps: number): Promise<void>;
}

export interface AndroidWebView extends EventEmitter {
  on(event: 'close', handler: () => void): this;
  pid(): number;
  pkg(): string;
  page(): Promise<Page>;
}

export type AndroidElementInfo = {
  clazz: string;
  desc: string;
  res: string;
  pkg: string;
  text: string;
  bounds: { x: number, y: number, width: number, height: number };
  checkable: boolean;
  checked: boolean;
  clickable: boolean;
  enabled: boolean;
  focusable: boolean;
  focused: boolean;
  longClickable: boolean;
  scrollable: boolean;
  selected: boolean;
};

export type AndroidSelector = {
  checkable?: boolean,
  checked?: boolean,
  clazz?: string | RegExp,
  clickable?: boolean,
  depth?: number,
  desc?: string | RegExp,
  enabled?: boolean,
  focusable?: boolean,
  focused?: boolean,
  hasChild?: { selector: AndroidSelector },
  hasDescendant?: { selector: AndroidSelector, maxDepth?: number },
  longClickable?: boolean,
  pkg?: string | RegExp,
  res?: string | RegExp,
  scrollable?: boolean,
  selected?: boolean,
  text?: string | RegExp,
};

export type AndroidKey =
  'Unknown' |
  'SoftLeft' | 'SoftRight' |
  'Home' |
  'Back' |
  'Call' | 'EndCall' |
  '0' |  '1' |  '2' |  '3' |  '4' |  '5' |  '6' |  '7' |  '8' |  '9' |
  'Star' | 'Pound' | '*' | '#' |
  'DialUp' | 'DialDown' | 'DialLeft' | 'DialRight' | 'DialCenter' |
  'VolumeUp' | 'VolumeDown' |
  'Power' |
  'Camera' |
  'Clear' |
  'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J' | 'K' | 'L' | 'M' |
  'N' | 'O' | 'P' | 'Q' | 'R' | 'S' | 'T' | 'U' | 'V' | 'W' | 'X' | 'Y' | 'Z' |
  'Comma' | ',' |
  'Period' | '.' |
  'AltLeft' | 'AltRight' |
  'ShiftLeft' | 'ShiftRight' |
  'Tab' | '\t' |
  'Space' | ' ' |
  'Sym' |
  'Explorer' |
  'Envelop' |
  'Enter' | '\n' |
  'Del' |
  'Grave' |
  'Minus' | '-' |
  'Equals' | '=' |
  'LeftBracket' | '(' |
  'RightBracket' | ')' |
  'Backslash' | '\\' |
  'Semicolon' | ';' |
  'Apostrophe' | '`' |
  'Slash' | '/' |
  'At' |
  'Num' |
  'HeadsetHook' |
  'Focus' |
  'Plus' | '+' |
  'Menu' |
  'Notification' |
  'Search';
