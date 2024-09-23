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
import { ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { Readable } from 'stream';
import { ReadStream } from 'fs';
import { Protocol } from './protocol';
import { Serializable, EvaluationArgument, PageFunction, PageFunctionOn, SmartHandle, ElementHandleForTag, BindingSource } from './structs';

type PageWaitForSelectorOptionsNotHidden = PageWaitForSelectorOptions & {
  state?: 'visible'|'attached';
};
type ElementHandleWaitForSelectorOptionsNotHidden = ElementHandleWaitForSelectorOptions & {
  state?: 'visible'|'attached';
};

export interface Page {
  evaluate<R, Arg>(pageFunction: PageFunction<Arg, R>, arg: Arg): Promise<R>;
  evaluate<R>(pageFunction: PageFunction<void, R>, arg?: any): Promise<R>;

  evaluateHandle<R, Arg>(pageFunction: PageFunction<Arg, R>, arg: Arg): Promise<SmartHandle<R>>;
  evaluateHandle<R>(pageFunction: PageFunction<void, R>, arg?: any): Promise<SmartHandle<R>>;

  addInitScript<Arg>(script: PageFunction<Arg, any> | { path?: string, content?: string }, arg?: Arg): Promise<void>;

  $<K extends keyof HTMLElementTagNameMap>(selector: K, options?: { strict: boolean }): Promise<ElementHandleForTag<K> | null>;
  $(selector: string, options?: { strict: boolean }): Promise<ElementHandle<SVGElement | HTMLElement> | null>;

  $$<K extends keyof HTMLElementTagNameMap>(selector: K): Promise<ElementHandleForTag<K>[]>;
  $$(selector: string): Promise<ElementHandle<SVGElement | HTMLElement>[]>;

  $eval<K extends keyof HTMLElementTagNameMap, R, Arg>(selector: K, pageFunction: PageFunctionOn<HTMLElementTagNameMap[K], Arg, R>, arg: Arg): Promise<R>;
  $eval<R, Arg, E extends SVGElement | HTMLElement = SVGElement | HTMLElement>(selector: string, pageFunction: PageFunctionOn<E, Arg, R>, arg: Arg): Promise<R>;
  $eval<K extends keyof HTMLElementTagNameMap, R>(selector: K, pageFunction: PageFunctionOn<HTMLElementTagNameMap[K], void, R>, arg?: any): Promise<R>;
  $eval<R, E extends SVGElement | HTMLElement = SVGElement | HTMLElement>(selector: string, pageFunction: PageFunctionOn<E, void, R>, arg?: any): Promise<R>;

  $$eval<K extends keyof HTMLElementTagNameMap, R, Arg>(selector: K, pageFunction: PageFunctionOn<HTMLElementTagNameMap[K][], Arg, R>, arg: Arg): Promise<R>;
  $$eval<R, Arg, E extends SVGElement | HTMLElement = SVGElement | HTMLElement>(selector: string, pageFunction: PageFunctionOn<E[], Arg, R>, arg: Arg): Promise<R>;
  $$eval<K extends keyof HTMLElementTagNameMap, R>(selector: K, pageFunction: PageFunctionOn<HTMLElementTagNameMap[K][], void, R>, arg?: any): Promise<R>;
  $$eval<R, E extends SVGElement | HTMLElement = SVGElement | HTMLElement>(selector: string, pageFunction: PageFunctionOn<E[], void, R>, arg?: any): Promise<R>;

  waitForFunction<R, Arg>(pageFunction: PageFunction<Arg, R>, arg: Arg, options?: PageWaitForFunctionOptions): Promise<SmartHandle<R>>;
  waitForFunction<R>(pageFunction: PageFunction<void, R>, arg?: any, options?: PageWaitForFunctionOptions): Promise<SmartHandle<R>>;

  waitForSelector<K extends keyof HTMLElementTagNameMap>(selector: K, options?: PageWaitForSelectorOptionsNotHidden): Promise<ElementHandleForTag<K>>;
  waitForSelector(selector: string, options?: PageWaitForSelectorOptionsNotHidden): Promise<ElementHandle<SVGElement | HTMLElement>>;
  waitForSelector<K extends keyof HTMLElementTagNameMap>(selector: K, options: PageWaitForSelectorOptions): Promise<ElementHandleForTag<K> | null>;
  waitForSelector(selector: string, options: PageWaitForSelectorOptions): Promise<null|ElementHandle<SVGElement | HTMLElement>>;

  exposeBinding(name: string, playwrightBinding: (source: BindingSource, arg: JSHandle) => any, options: { handle: true }): Promise<void>;
  exposeBinding(name: string, playwrightBinding: (source: BindingSource, ...args: any[]) => any, options?: { handle?: boolean }): Promise<void>;

  removeAllListeners(type?: string): this;
  removeAllListeners(type: string | undefined, options: {
    /**
     * Specifies whether to wait for already running listeners and what to do if they throw errors:
     * - `'default'` - do not wait for current listener calls (if any) to finish, if the listener throws, it may result in unhandled error
     * - `'wait'` - wait for current listener calls (if any) to finish
     * - `'ignoreErrors'` - do not wait for current listener calls (if any) to finish, all errors thrown by the listeners after removal are silently caught
     */
    behavior?: 'wait'|'ignoreErrors'|'default'
  }): Promise<void>;
}

export interface Frame {
  evaluate<R, Arg>(pageFunction: PageFunction<Arg, R>, arg: Arg): Promise<R>;
  evaluate<R>(pageFunction: PageFunction<void, R>, arg?: any): Promise<R>;

  evaluateHandle<R, Arg>(pageFunction: PageFunction<Arg, R>, arg: Arg): Promise<SmartHandle<R>>;
  evaluateHandle<R>(pageFunction: PageFunction<void, R>, arg?: any): Promise<SmartHandle<R>>;

  $<K extends keyof HTMLElementTagNameMap>(selector: K, options?: { strict: boolean }): Promise<ElementHandleForTag<K> | null>;
  $(selector: string, options?: { strict: boolean }): Promise<ElementHandle<SVGElement | HTMLElement> | null>;

  $$<K extends keyof HTMLElementTagNameMap>(selector: K): Promise<ElementHandleForTag<K>[]>;
  $$(selector: string): Promise<ElementHandle<SVGElement | HTMLElement>[]>;

  $eval<K extends keyof HTMLElementTagNameMap, R, Arg>(selector: K, pageFunction: PageFunctionOn<HTMLElementTagNameMap[K], Arg, R>, arg: Arg): Promise<R>;
  $eval<R, Arg, E extends SVGElement | HTMLElement = SVGElement | HTMLElement>(selector: string, pageFunction: PageFunctionOn<E, Arg, R>, arg: Arg): Promise<R>;
  $eval<K extends keyof HTMLElementTagNameMap, R>(selector: K, pageFunction: PageFunctionOn<HTMLElementTagNameMap[K], void, R>, arg?: any): Promise<R>;
  $eval<R, E extends SVGElement | HTMLElement = SVGElement | HTMLElement>(selector: string, pageFunction: PageFunctionOn<E, void, R>, arg?: any): Promise<R>;

  $$eval<K extends keyof HTMLElementTagNameMap, R, Arg>(selector: K, pageFunction: PageFunctionOn<HTMLElementTagNameMap[K][], Arg, R>, arg: Arg): Promise<R>;
  $$eval<R, Arg, E extends SVGElement | HTMLElement = SVGElement | HTMLElement>(selector: string, pageFunction: PageFunctionOn<E[], Arg, R>, arg: Arg): Promise<R>;
  $$eval<K extends keyof HTMLElementTagNameMap, R>(selector: K, pageFunction: PageFunctionOn<HTMLElementTagNameMap[K][], void, R>, arg?: any): Promise<R>;
  $$eval<R, E extends SVGElement | HTMLElement = SVGElement | HTMLElement>(selector: string, pageFunction: PageFunctionOn<E[], void, R>, arg?: any): Promise<R>;

  waitForFunction<R, Arg>(pageFunction: PageFunction<Arg, R>, arg: Arg, options?: PageWaitForFunctionOptions): Promise<SmartHandle<R>>;
  waitForFunction<R>(pageFunction: PageFunction<void, R>, arg?: any, options?: PageWaitForFunctionOptions): Promise<SmartHandle<R>>;

  waitForSelector<K extends keyof HTMLElementTagNameMap>(selector: K, options?: PageWaitForSelectorOptionsNotHidden): Promise<ElementHandleForTag<K>>;
  waitForSelector(selector: string, options?: PageWaitForSelectorOptionsNotHidden): Promise<ElementHandle<SVGElement | HTMLElement>>;
  waitForSelector<K extends keyof HTMLElementTagNameMap>(selector: K, options: PageWaitForSelectorOptions): Promise<ElementHandleForTag<K> | null>;
  waitForSelector(selector: string, options: PageWaitForSelectorOptions): Promise<null|ElementHandle<SVGElement | HTMLElement>>;
}

export interface BrowserContext {
  exposeBinding(name: string, playwrightBinding: (source: BindingSource, arg: JSHandle) => any, options: { handle: true }): Promise<void>;
  exposeBinding(name: string, playwrightBinding: (source: BindingSource, ...args: any[]) => any, options?: { handle?: boolean }): Promise<void>;

  addInitScript<Arg>(script: PageFunction<Arg, any> | { path?: string, content?: string }, arg?: Arg): Promise<void>;

  removeAllListeners(type?: string): this;
  removeAllListeners(type: string | undefined, options: {
    /**
     * Specifies whether to wait for already running listeners and what to do if they throw errors:
     * - `'default'` - do not wait for current listener calls (if any) to finish, if the listener throws, it may result in unhandled error
     * - `'wait'` - wait for current listener calls (if any) to finish
     * - `'ignoreErrors'` - do not wait for current listener calls (if any) to finish, all errors thrown by the listeners after removal are silently caught
     */
    behavior?: 'wait'|'ignoreErrors'|'default'
  }): Promise<void>;
}

export interface Browser {
  removeAllListeners(type?: string): this;
  removeAllListeners(type: string | undefined, options: {
    /**
     * Specifies whether to wait for already running listeners and what to do if they throw errors:
     * - `'default'` - do not wait for current listener calls (if any) to finish, if the listener throws, it may result in unhandled error
     * - `'wait'` - wait for current listener calls (if any) to finish
     * - `'ignoreErrors'` - do not wait for current listener calls (if any) to finish, all errors thrown by the listeners after removal are silently caught
     */
    behavior?: 'wait'|'ignoreErrors'|'default'
  }): Promise<void>;
}

export interface Worker {
  evaluate<R, Arg>(pageFunction: PageFunction<Arg, R>, arg: Arg): Promise<R>;
  evaluate<R>(pageFunction: PageFunction<void, R>, arg?: any): Promise<R>;

  evaluateHandle<R, Arg>(pageFunction: PageFunction<Arg, R>, arg: Arg): Promise<SmartHandle<R>>;
  evaluateHandle<R>(pageFunction: PageFunction<void, R>, arg?: any): Promise<SmartHandle<R>>;
}

export interface JSHandle<T = any> {
  evaluate<R, Arg, O extends T = T>(pageFunction: PageFunctionOn<O, Arg, R>, arg: Arg): Promise<R>;
  evaluate<R, O extends T = T>(pageFunction: PageFunctionOn<O, void, R>, arg?: any): Promise<R>;

  evaluateHandle<R, Arg, O extends T = T>(pageFunction: PageFunctionOn<O, Arg, R>, arg: Arg): Promise<SmartHandle<R>>;
  evaluateHandle<R, O extends T = T>(pageFunction: PageFunctionOn<O, void, R>, arg?: any): Promise<SmartHandle<R>>;

  jsonValue(): Promise<T>;
  asElement(): T extends Node ? ElementHandle<T> : null;
}

export interface ElementHandle<T=Node> extends JSHandle<T> {
  $<K extends keyof HTMLElementTagNameMap>(selector: K, options?: { strict: boolean }): Promise<ElementHandleForTag<K> | null>;
  $(selector: string, options?: { strict: boolean }): Promise<ElementHandle<SVGElement | HTMLElement> | null>;

  $$<K extends keyof HTMLElementTagNameMap>(selector: K): Promise<ElementHandleForTag<K>[]>;
  $$(selector: string): Promise<ElementHandle<SVGElement | HTMLElement>[]>;

  $eval<K extends keyof HTMLElementTagNameMap, R, Arg>(selector: K, pageFunction: PageFunctionOn<HTMLElementTagNameMap[K], Arg, R>, arg: Arg): Promise<R>;
  $eval<R, Arg, E extends SVGElement | HTMLElement = SVGElement | HTMLElement>(selector: string, pageFunction: PageFunctionOn<E, Arg, R>, arg: Arg): Promise<R>;
  $eval<K extends keyof HTMLElementTagNameMap, R>(selector: K, pageFunction: PageFunctionOn<HTMLElementTagNameMap[K], void, R>, arg?: any): Promise<R>;
  $eval<R, E extends SVGElement | HTMLElement = SVGElement | HTMLElement>(selector: string, pageFunction: PageFunctionOn<E, void, R>, arg?: any): Promise<R>;

  $$eval<K extends keyof HTMLElementTagNameMap, R, Arg>(selector: K, pageFunction: PageFunctionOn<HTMLElementTagNameMap[K][], Arg, R>, arg: Arg): Promise<R>;
  $$eval<R, Arg, E extends SVGElement | HTMLElement = SVGElement | HTMLElement>(selector: string, pageFunction: PageFunctionOn<E[], Arg, R>, arg: Arg): Promise<R>;
  $$eval<K extends keyof HTMLElementTagNameMap, R>(selector: K, pageFunction: PageFunctionOn<HTMLElementTagNameMap[K][], void, R>, arg?: any): Promise<R>;
  $$eval<R, E extends SVGElement | HTMLElement = SVGElement | HTMLElement>(selector: string, pageFunction: PageFunctionOn<E[], void, R>, arg?: any): Promise<R>;

  waitForSelector<K extends keyof HTMLElementTagNameMap>(selector: K, options?: ElementHandleWaitForSelectorOptionsNotHidden): Promise<ElementHandleForTag<K>>;
  waitForSelector(selector: string, options?: ElementHandleWaitForSelectorOptionsNotHidden): Promise<ElementHandle<SVGElement | HTMLElement>>;
  waitForSelector<K extends keyof HTMLElementTagNameMap>(selector: K, options: ElementHandleWaitForSelectorOptions): Promise<ElementHandleForTag<K> | null>;
  waitForSelector(selector: string, options: ElementHandleWaitForSelectorOptions): Promise<null|ElementHandle<SVGElement | HTMLElement>>;
}

export interface Locator {
  evaluate<R, Arg, E extends SVGElement | HTMLElement = SVGElement | HTMLElement>(pageFunction: PageFunctionOn<E, Arg, R>, arg: Arg, options?: {
    timeout?: number;
  }): Promise<R>;
  evaluate<R, E extends SVGElement | HTMLElement = SVGElement | HTMLElement>(pageFunction: PageFunctionOn<E, void, R>, options?: {
    timeout?: number;
  }): Promise<R>;
  evaluateHandle<R, Arg, E extends SVGElement | HTMLElement = SVGElement | HTMLElement>(pageFunction: PageFunctionOn<E, Arg, R>, arg: Arg): Promise<SmartHandle<R>>;
  evaluateHandle<R, E extends SVGElement | HTMLElement = SVGElement | HTMLElement>(pageFunction: PageFunctionOn<E, void, R>): Promise<SmartHandle<R>>;
  evaluateAll<R, Arg, E extends SVGElement | HTMLElement = SVGElement | HTMLElement>(pageFunction: PageFunctionOn<E[], Arg, R>, arg: Arg): Promise<R>;
  evaluateAll<R, E extends SVGElement | HTMLElement = SVGElement | HTMLElement>(pageFunction: PageFunctionOn<E[], void, R>): Promise<R>;
  elementHandle(options?: {
    timeout?: number;
  }): Promise<null|ElementHandle<SVGElement | HTMLElement>>;
}

export interface BrowserType<Unused = {}> {
  connectOverCDP(endpointURL: string, options?: ConnectOverCDPOptions): Promise<Browser>;
  /**
   * Option `wsEndpoint` is deprecated. Instead use `endpointURL`.
   * @deprecated
   */
  connectOverCDP(options: ConnectOverCDPOptions & { wsEndpoint?: string }): Promise<Browser>;
  connect(wsEndpoint: string, options?: ConnectOptions): Promise<Browser>;
  /**
   * wsEndpoint in options is deprecated. Instead use `wsEndpoint`.
   * @param wsEndpoint A browser websocket endpoint to connect to.
   * @param options
   * @deprecated
   */
  connect(options: ConnectOptions & { wsEndpoint?: string }): Promise<Browser>;
}

export interface CDPSession {
  on: <T extends keyof Protocol.Events | symbol>(event: T, listener: (payload: T extends symbol ? any : Protocol.Events[T extends keyof Protocol.Events ? T : never]) => void) => this;
  addListener: <T extends keyof Protocol.Events | symbol>(event: T, listener: (payload: T extends symbol ? any : Protocol.Events[T extends keyof Protocol.Events ? T : never]) => void) => this;
  off: <T extends keyof Protocol.Events | symbol>(event: T, listener: (payload: T extends symbol ? any : Protocol.Events[T extends keyof Protocol.Events ? T : never]) => void) => this;
  removeListener: <T extends keyof Protocol.Events | symbol>(event: T, listener: (payload: T extends symbol ? any : Protocol.Events[T extends keyof Protocol.Events ? T : never]) => void) => this;
  once: <T extends keyof Protocol.Events | symbol>(event: T, listener: (payload: T extends symbol ? any : Protocol.Events[T extends keyof Protocol.Events ? T : never]) => void) => this;
  send<T extends keyof Protocol.CommandParameters>(
    method: T,
    params?: Protocol.CommandParameters[T]
  ): Promise<Protocol.CommandReturnValues[T]>;
}

export interface WebSocketRoute {
  routeSend(handler: (message: string | Buffer) => any): void;
  routeReceive(handler: (message: string | Buffer) => any): void;
}

type DeviceDescriptor = {
  viewport: ViewportSize;
  userAgent: string;
  deviceScaleFactor: number;
  isMobile: boolean;
  hasTouch: boolean;
  defaultBrowserType: 'chromium' | 'firefox' | 'webkit';
};

export namespace errors {

class TimeoutError extends Error {}

}

export interface Accessibility {
  snapshot(options?: AccessibilitySnapshotOptions): Promise<null|AccessibilityNode>;
}

type AccessibilityNode = {
  role: string;
  name: string;
  value?: string|number;
  description?: string;
  keyshortcuts?: string;
  roledescription?: string;
  valuetext?: string;
  disabled?: boolean;
  expanded?: boolean;
  focused?: boolean;
  modal?: boolean;
  multiline?: boolean;
  multiselectable?: boolean;
  readonly?: boolean;
  required?: boolean;
  selected?: boolean;
  checked?: boolean|"mixed";
  pressed?: boolean|"mixed";
  level?: number;
  valuemin?: number;
  valuemax?: number;
  autocomplete?: string;
  haspopup?: string;
  invalid?: string;
  orientation?: string;
  children?: AccessibilityNode[];
}

export const devices: Devices;

//@ts-ignore this will be any if electron is not installed
type ElectronType = typeof import('electron');

export interface ElectronApplication {
  evaluate<R, Arg>(pageFunction: PageFunctionOn<ElectronType, Arg, R>, arg: Arg): Promise<R>;
  evaluate<R>(pageFunction: PageFunctionOn<ElectronType, void, R>, arg?: any): Promise<R>;

  evaluateHandle<R, Arg>(pageFunction: PageFunctionOn<ElectronType, Arg, R>, arg: Arg): Promise<SmartHandle<R>>;
  evaluateHandle<R>(pageFunction: PageFunctionOn<ElectronType, void, R>, arg?: any): Promise<SmartHandle<R>>;
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
  'ChannelUp' | 'ChannelDown' |
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
  'At' | '@' |
  'Num' |
  'HeadsetHook' |
  'Focus' |
  'Plus' | '+' |
  'Menu' |
  'Notification' |
  'Search' |
  'RecentApps' |
  'AppSwitch' |
  'Assist' |
  'Cut' |
  'Copy' |
  'Paste';

export const _electron: Electron;
export const _android: Android;
export const _bidiChromium: BrowserType;
export const _bidiFirefox: BrowserType;

// This is required to not export everything by default. See https://github.com/Microsoft/TypeScript/issues/19545#issuecomment-340490459
export {};
