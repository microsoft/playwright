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
import { Protocol } from './protocol';
import { ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { Readable } from 'stream';

/**
 * Can be converted to JSON
 */
type Serializable = {};

type NoHandles<Arg> = Arg extends JSHandle ? never : (Arg extends object ? { [Key in keyof Arg]: NoHandles<Arg[Key]> } : Arg);
type Unboxed<Arg> =
  Arg extends ElementHandle<infer T> ? T :
  Arg extends JSHandle<infer T> ? T :
  Arg extends NoHandles<Arg> ? Arg :
  Arg extends Array<infer T> ? Array<Unboxed<T>> :
  Arg extends object ? { [Key in keyof Arg]: Unboxed<Arg[Key]> } :
  Arg;
type PageFunction<Arg, R> = string | ((arg: Unboxed<Arg>) => R | Promise<R>);
type PageFunctionOn<On, Arg2, R> = string | ((on: On, arg2: Unboxed<Arg2>) => R | Promise<R>);
type SmartHandle<T> = T extends Node ? ElementHandle<T> : JSHandle<T>;
type ElementHandleForTag<K extends keyof HTMLElementTagNameMap> = ElementHandle<HTMLElementTagNameMap[K]>;
type HTMLOrSVGElement = SVGElement | HTMLElement;
type HTMLOrSVGElementHandle = ElementHandle<HTMLOrSVGElement>;

type WaitForSelectorOptionsNotHidden = PageWaitForSelectorOptions & {
  waitFor: 'visible'|'attached';
}

export interface Page {
  evaluate<R, Arg>(pageFunction: PageFunction<Arg, R>, arg: Arg): Promise<R>;
  evaluate<R>(pageFunction: PageFunction<void, R>, arg?: any): Promise<R>;

  evaluateHandle<R, Arg>(pageFunction: PageFunction<Arg, R>, arg: Arg): Promise<SmartHandle<R>>;
  evaluateHandle<R>(pageFunction: PageFunction<void, R>, arg?: any): Promise<SmartHandle<R>>;

  $<K extends keyof HTMLElementTagNameMap>(selector: K): Promise<ElementHandleForTag<K> | null>;
  $(selector: string): Promise<HTMLOrSVGElementHandle | null>;

  $$<K extends keyof HTMLElementTagNameMap>(selector: K): Promise<ElementHandleForTag<K>[]>;
  $$(selector: string): Promise<HTMLOrSVGElementHandle[]>;

  $eval<K extends keyof HTMLElementTagNameMap, R, Arg>(selector: K, pageFunction: PageFunctionOn<HTMLElementTagNameMap[K], Arg, R>, arg: Arg): Promise<R>;
  $eval<R, Arg, E extends HTMLOrSVGElement = HTMLOrSVGElement>(selector: string, pageFunction: PageFunctionOn<E, Arg, R>, arg: Arg): Promise<R>;
  $eval<K extends keyof HTMLElementTagNameMap, R>(selector: K, pageFunction: PageFunctionOn<HTMLElementTagNameMap[K], void, R>, arg?: any): Promise<R>;
  $eval<R, E extends HTMLOrSVGElement = HTMLOrSVGElement>(selector: string, pageFunction: PageFunctionOn<E, void, R>, arg?: any): Promise<R>;

  $$eval<K extends keyof HTMLElementTagNameMap, R, Arg>(selector: K, pageFunction: PageFunctionOn<HTMLElementTagNameMap[K][], Arg, R>, arg: Arg): Promise<R>;
  $$eval<R, Arg, E extends HTMLOrSVGElement = HTMLOrSVGElement>(selector: string, pageFunction: PageFunctionOn<E[], Arg, R>, arg: Arg): Promise<R>;
  $$eval<K extends keyof HTMLElementTagNameMap, R>(selector: K, pageFunction: PageFunctionOn<HTMLElementTagNameMap[K][], void, R>, arg?: any): Promise<R>;
  $$eval<R, E extends HTMLOrSVGElement = HTMLOrSVGElement>(selector: string, pageFunction: PageFunctionOn<E[], void, R>, arg?: any): Promise<R>;

  waitForFunction<R, Arg>(pageFunction: PageFunction<Arg, R>, arg: Arg, options?: PageWaitForFunctionOptions): Promise<SmartHandle<R>>;
  waitForFunction<R>(pageFunction: PageFunction<void, R>, arg?: any, options?: PageWaitForFunctionOptions): Promise<SmartHandle<R>>;

  waitForSelector<K extends keyof HTMLElementTagNameMap>(selector: K, options?: WaitForSelectorOptionsNotHidden): Promise<ElementHandleForTag<K>>;
  waitForSelector(selector: string, options?: WaitForSelectorOptionsNotHidden): Promise<HTMLOrSVGElementHandle>;
  waitForSelector<K extends keyof HTMLElementTagNameMap>(selector: K, options: PageWaitForSelectorOptions): Promise<ElementHandleForTag<K> | null>;
  waitForSelector(selector: string, options: PageWaitForSelectorOptions): Promise<null|HTMLOrSVGElementHandle>;
}

export interface Frame {
  evaluate<R, Arg>(pageFunction: PageFunction<Arg, R>, arg: Arg): Promise<R>;
  evaluate<R>(pageFunction: PageFunction<void, R>, arg?: any): Promise<R>;

  evaluateHandle<R, Arg>(pageFunction: PageFunction<Arg, R>, arg: Arg): Promise<SmartHandle<R>>;
  evaluateHandle<R>(pageFunction: PageFunction<void, R>, arg?: any): Promise<SmartHandle<R>>;

  $<K extends keyof HTMLElementTagNameMap>(selector: K): Promise<ElementHandleForTag<K> | null>;
  $(selector: string): Promise<HTMLOrSVGElementHandle | null>;

  $$<K extends keyof HTMLElementTagNameMap>(selector: K): Promise<ElementHandleForTag<K>[]>;
  $$(selector: string): Promise<HTMLOrSVGElementHandle[]>;

  $eval<K extends keyof HTMLElementTagNameMap, R, Arg>(selector: K, pageFunction: PageFunctionOn<HTMLElementTagNameMap[K], Arg, R>, arg: Arg): Promise<R>;
  $eval<R, Arg, E extends HTMLOrSVGElement = HTMLOrSVGElement>(selector: string, pageFunction: PageFunctionOn<E, Arg, R>, arg: Arg): Promise<R>;
  $eval<K extends keyof HTMLElementTagNameMap, R>(selector: K, pageFunction: PageFunctionOn<HTMLElementTagNameMap[K], void, R>, arg?: any): Promise<R>;
  $eval<R, E extends HTMLOrSVGElement = HTMLOrSVGElement>(selector: string, pageFunction: PageFunctionOn<E, void, R>, arg?: any): Promise<R>;

  $$eval<K extends keyof HTMLElementTagNameMap, R, Arg>(selector: K, pageFunction: PageFunctionOn<HTMLElementTagNameMap[K][], Arg, R>, arg: Arg): Promise<R>;
  $$eval<R, Arg, E extends HTMLOrSVGElement = HTMLOrSVGElement>(selector: string, pageFunction: PageFunctionOn<E[], Arg, R>, arg: Arg): Promise<R>;
  $$eval<K extends keyof HTMLElementTagNameMap, R>(selector: K, pageFunction: PageFunctionOn<HTMLElementTagNameMap[K][], void, R>, arg?: any): Promise<R>;
  $$eval<R, E extends HTMLOrSVGElement = HTMLOrSVGElement>(selector: string, pageFunction: PageFunctionOn<E[], void, R>, arg?: any): Promise<R>;

  waitForFunction<R, Arg>(pageFunction: PageFunction<Arg, R>, arg: Arg, options?: PageWaitForFunctionOptions): Promise<SmartHandle<R>>;
  waitForFunction<R>(pageFunction: PageFunction<void, R>, arg?: any, options?: PageWaitForFunctionOptions): Promise<SmartHandle<R>>;

  waitForSelector<K extends keyof HTMLElementTagNameMap>(selector: K, options?: WaitForSelectorOptionsNotHidden): Promise<ElementHandleForTag<K>>;
  waitForSelector(selector: string, options?: WaitForSelectorOptionsNotHidden): Promise<HTMLOrSVGElementHandle>;
  waitForSelector<K extends keyof HTMLElementTagNameMap>(selector: K, options: PageWaitForSelectorOptions): Promise<ElementHandleForTag<K> | null>;
  waitForSelector(selector: string, options: PageWaitForSelectorOptions): Promise<null|HTMLOrSVGElementHandle>;
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
  $<K extends keyof HTMLElementTagNameMap>(selector: K): Promise<ElementHandleForTag<K> | null>;
  $(selector: string): Promise<HTMLOrSVGElementHandle | null>;

  $$<K extends keyof HTMLElementTagNameMap>(selector: K): Promise<ElementHandleForTag<K>[]>;
  $$(selector: string): Promise<HTMLOrSVGElementHandle[]>;

  $eval<K extends keyof HTMLElementTagNameMap, R, Arg>(selector: K, pageFunction: PageFunctionOn<HTMLElementTagNameMap[K], Arg, R>, arg: Arg): Promise<R>;
  $eval<R, Arg, E extends HTMLOrSVGElement = HTMLOrSVGElement>(selector: string, pageFunction: PageFunctionOn<E, Arg, R>, arg: Arg): Promise<R>;
  $eval<K extends keyof HTMLElementTagNameMap, R>(selector: K, pageFunction: PageFunctionOn<HTMLElementTagNameMap[K], void, R>, arg?: any): Promise<R>;
  $eval<R, E extends HTMLOrSVGElement = HTMLOrSVGElement>(selector: string, pageFunction: PageFunctionOn<E, void, R>, arg?: any): Promise<R>;

  $$eval<K extends keyof HTMLElementTagNameMap, R, Arg>(selector: K, pageFunction: PageFunctionOn<HTMLElementTagNameMap[K][], Arg, R>, arg: Arg): Promise<R>;
  $$eval<R, Arg, E extends HTMLOrSVGElement = HTMLOrSVGElement>(selector: string, pageFunction: PageFunctionOn<E[], Arg, R>, arg: Arg): Promise<R>;
  $$eval<K extends keyof HTMLElementTagNameMap, R>(selector: K, pageFunction: PageFunctionOn<HTMLElementTagNameMap[K][], void, R>, arg?: any): Promise<R>;
  $$eval<R, E extends HTMLOrSVGElement = HTMLOrSVGElement>(selector: string, pageFunction: PageFunctionOn<E[], void, R>, arg?: any): Promise<R>;
}

export interface BrowserType<Browser> {

}

export interface ChromiumBrowser extends Browser {
  contexts(): Array<ChromiumBrowserContext>;
  newContext(options?: BrowserNewContextOptions): Promise<ChromiumBrowserContext>;
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

type DeviceDescriptor = {viewport: BrowserNewContextOptionsViewport, userAgent: string};

export namespace errors {

class TimeoutError extends Error {}

}

export const selectors: Selectors;
export const devices: {[name: string]: DeviceDescriptor} & DeviceDescriptor[];

// This is required to not export everything by default. See https://github.com/Microsoft/TypeScript/issues/19545#issuecomment-340490459
export {};
