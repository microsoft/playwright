import {Protocol} from './protocol';

type Boxed<Args extends any[]> = { [Index in keyof Args]: Args[Index] | JSHandle<Args[Index]> };
type PageFunction<Args extends any[], R = any> = string | ((...args: Args) => R | Promise<R>);
type PageFunctionOn<On, Args extends any[], R = any> = string | ((on: On, ...args: Args) => R | Promise<R>);

type Handle<T> = T extends Node ? ElementHandle<T> : JSHandle<T>;
type ElementHandleForTag<K extends keyof HTMLElementTagNameMap> = ElementHandle<HTMLElementTagNameMap[K]>;

type WaitForSelectorOptionsNotHidden = PageWaitForSelectorOptions & {
  visibility: 'visible'|'any';
}

type HTMLOrSVGElement = SVGElement | HTMLElement;
type HTMLOrSVGElementHandle = ElementHandle<HTMLOrSVGElement>;

export interface Page {
  evaluate<Args extends any[], R>(pageFunction: PageFunction<Args, R>, ...args: Boxed<Args>): Promise<R>;
  evaluateHandle<Args extends any[], R>(pageFunction: PageFunction<Args,  R>, ...args: Boxed<Args>): Promise<Handle<R>>;

  $<K extends keyof HTMLElementTagNameMap>(selector: K): Promise<ElementHandleForTag<K> | null>;
  $(selector: string): Promise<HTMLOrSVGElementHandle | null>;

  $$<K extends keyof HTMLElementTagNameMap>(selector: K): Promise<ElementHandleForTag<K>[]>;
  $$(selector: string): Promise<HTMLOrSVGElementHandle[]>;

  $eval<K extends keyof HTMLElementTagNameMap, Args extends any[], R>(selector: K, pageFunction: PageFunctionOn<HTMLElementTagNameMap[K], Args, R>, ...args: Boxed<Args>): Promise<R>;
  $eval<Args extends any[], R>(selector: string, pageFunction: PageFunctionOn<HTMLOrSVGElement, Args, R>, ...args: Boxed<Args>): Promise<R>;

  $$eval<K extends keyof HTMLElementTagNameMap, Args extends any[], R>(selector: K, pageFunction: PageFunctionOn<HTMLElementTagNameMap[K][], Args, R>, ...args: Boxed<Args>): Promise<R>;
  $$eval<Args extends any[], R>(selector: string, pageFunction: PageFunctionOn<HTMLOrSVGElement[], Args, R>, ...args: Boxed<Args>): Promise<R>;

  waitForSelector<K extends keyof HTMLElementTagNameMap>(selector: K, options?: WaitForSelectorOptionsNotHidden): Promise<ElementHandleForTag<K>>;
  waitForSelector(selector: string, options?: WaitForSelectorOptionsNotHidden): Promise<HTMLOrSVGElementHandle>;
  waitForSelector<K extends keyof HTMLElementTagNameMap>(selector: K, options: PageWaitForSelectorOptions): Promise<ElementHandleForTag<K> | null>;
  waitForSelector(selector: string, options: PageWaitForSelectorOptions): Promise<null|HTMLOrSVGElementHandle>;
}

export interface Frame {
  evaluate<Args extends any[], R>(pageFunction: PageFunction<Args, R>, ...args: Boxed<Args>): Promise<R>;
  evaluateHandle<Args extends any[], R>(pageFunction: PageFunction<Args,  R>, ...args: Boxed<Args>): Promise<Handle<R>>;

  $<K extends keyof HTMLElementTagNameMap>(selector: K): Promise<ElementHandleForTag<K> | null>;
  $(selector: string): Promise<HTMLOrSVGElementHandle | null>;

  $$<K extends keyof HTMLElementTagNameMap>(selector: K): Promise<ElementHandleForTag<K>[]>;
  $$(selector: string): Promise<HTMLOrSVGElementHandle[]>;

  $eval<K extends keyof HTMLElementTagNameMap, Args extends any[], R>(selector: K, pageFunction: PageFunctionOn<HTMLElementTagNameMap[K], Args, R>, ...args: Boxed<Args>): Promise<R>;
  $eval<Args extends any[], R>(selector: string, pageFunction: PageFunctionOn<HTMLOrSVGElement, Args, R>, ...args: Boxed<Args>): Promise<R>;

  $$eval<K extends keyof HTMLElementTagNameMap, Args extends any[], R>(selector: K, pageFunction: PageFunctionOn<HTMLElementTagNameMap[K][], Args, R>, ...args: Boxed<Args>): Promise<R>;
  $$eval<Args extends any[], R>(selector: string, pageFunction: PageFunctionOn<HTMLOrSVGElement[], Args, R>, ...args: Boxed<Args>): Promise<R>;

  waitForSelector<K extends keyof HTMLElementTagNameMap>(selector: K, options?: WaitForSelectorOptionsNotHidden): Promise<ElementHandleForTag<K>>;
  waitForSelector(selector: string, options?: WaitForSelectorOptionsNotHidden): Promise<HTMLOrSVGElementHandle>;
  waitForSelector<K extends keyof HTMLElementTagNameMap>(selector: K, options: PageWaitForSelectorOptions): Promise<ElementHandleForTag<K> | null>;
  waitForSelector(selector: string, options: PageWaitForSelectorOptions): Promise<null|HTMLOrSVGElementHandle>;
}

export interface Worker {
  evaluate<Args extends any[], R>(pageFunction: PageFunction<Args, R>, ...args: Boxed<Args>): Promise<R>;
  evaluateHandle<Args extends any[], R>(pageFunction: PageFunction<Args,  R>, ...args: Boxed<Args>): Promise<Handle<R>>;
}

export interface JSHandle<T = any> {
  jsonValue(): Promise<T>;
  evaluate<Args extends any[], R>(pageFunction: PageFunctionOn<T, Args, R>, ...args: Boxed<Args>): Promise<R>;
  evaluateHandle<Args extends any[], R>(pageFunction: PageFunctionOn<T, Args, R>, ...args: Boxed<Args>): Promise<Handle<R>>;
  asElement(): T extends Node ? ElementHandle<T> : null;
}

export interface ElementHandle<T=Node> extends JSHandle<T> {
  $<K extends keyof HTMLElementTagNameMap>(selector: K): Promise<ElementHandleForTag<K> | null>;
  $(selector: string): Promise<HTMLOrSVGElementHandle | null>;

  $$<K extends keyof HTMLElementTagNameMap>(selector: K): Promise<ElementHandleForTag<K>[]>;
  $$(selector: string): Promise<HTMLOrSVGElementHandle[]>;

  $eval<K extends keyof HTMLElementTagNameMap, Args extends any[], R>(selector: K, pageFunction: PageFunctionOn<HTMLElementTagNameMap[K], Args, R>, ...args: Boxed<Args>): Promise<R>;
  $eval<Args extends any[], R>(selector: string, pageFunction: PageFunctionOn<HTMLOrSVGElement, Args, R>, ...args: Boxed<Args>): Promise<R>;

  $$eval<K extends keyof HTMLElementTagNameMap, Args extends any[], R>(selector: K, pageFunction: PageFunctionOn<HTMLElementTagNameMap[K][], Args, R>, ...args: Boxed<Args>): Promise<R>;
  $$eval<Args extends any[], R>(selector: string, pageFunction: PageFunctionOn<HTMLOrSVGElement[], Args, R>, ...args: Boxed<Args>): Promise<R>;
}

export interface BrowserType<Browser> {

}

export interface ChromiumBrowser extends Browser {
  contexts(): Array<ChromiumBrowserContext>;
  newContext(options?: BrowserNewContextOptions): Promise<ChromiumBrowserContext>;
}

export interface ChromiumSession {
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