import {Protocol} from './protocol';

type Boxed<Args extends any[]> = { [Index in keyof Args]: Args[Index] | JSHandle<Args[Index]> };
type PageFunction<Args extends any[], R = any> = string | ((...args: Args) => R | Promise<R>);
type PageFunctionOn<On, Args extends any[], R = any> = string | ((on: On, ...args: Args) => R | Promise<R>);

type Handle<T> = T extends Node ? ElementHandle<T> : JSHandle<T>;
type ElementHandleForTag<K extends keyof HTMLElementTagNameMap> = ElementHandle<HTMLElementTagNameMap[K]>;

type WaitForSelectorOptionsNotHidden = PageWaitForSelectorOptions & {
  visibility: 'visible'|'any';
}

export interface Page<C=BrowserContext> {
  context(): C;

  evaluate<Args extends any[], R>(pageFunction: PageFunction<Args, R>, ...args: Boxed<Args>): Promise<R>;
  evaluateHandle<Args extends any[], R>(pageFunction: PageFunction<Args,  R>, ...args: Boxed<Args>): Promise<Handle<R>>;

  $<K extends keyof HTMLElementTagNameMap>(selector: K): Promise<ElementHandleForTag<K> | null>;
  $(selector: string): Promise<ElementHandle<Element> | null>;

  $eval<K extends keyof HTMLElementTagNameMap, Args extends any[], R>(selector: K, pageFunction: PageFunctionOn<HTMLElementTagNameMap[K], Args, R>, ...args: Boxed<Args>): Promise<R>;
  $eval<Args extends any[], R>(selector: string, pageFunction: PageFunctionOn<Element, Args, R>, ...args: Boxed<Args>): Promise<R>;

  $$eval<K extends keyof HTMLElementTagNameMap, Args extends any[], R>(selector: K, pageFunction: PageFunctionOn<HTMLElementTagNameMap[K][], Args, R>, ...args: Boxed<Args>): Promise<R>;
  $$eval<Args extends any[], R>(selector: string, pageFunction: PageFunctionOn<Element[], Args, R>, ...args: Boxed<Args>): Promise<R>;

  waitForSelector(selector: string, options?: WaitForSelectorOptionsNotHidden): Promise<ElementHandle>;
  waitForSelector(selector: string, options: PageWaitForSelectorOptions): Promise<null|ElementHandle>;
}

export interface Frame {
  evaluate<Args extends any[], R>(pageFunction: PageFunction<Args, R>, ...args: Boxed<Args>): Promise<R>;
  evaluateHandle<Args extends any[], R>(pageFunction: PageFunction<Args,  R>, ...args: Boxed<Args>): Promise<Handle<R>>;

  $<K extends keyof HTMLElementTagNameMap>(selector: K): Promise<ElementHandleForTag<K> | null>;
  $(selector: string): Promise<ElementHandle<Element> | null>;

  $eval<K extends keyof HTMLElementTagNameMap, Args extends any[], R>(selector: K, pageFunction: PageFunctionOn<HTMLElementTagNameMap[K], Args, R>, ...args: Boxed<Args>): Promise<R>;
  $eval<Args extends any[], R>(selector: string, pageFunction: PageFunctionOn<Element, Args, R>, ...args: Boxed<Args>): Promise<R>;

  $$eval<K extends keyof HTMLElementTagNameMap, Args extends any[], R>(selector: K, pageFunction: PageFunctionOn<HTMLElementTagNameMap[K][], Args, R>, ...args: Boxed<Args>): Promise<R>;
  $$eval<Args extends any[], R>(selector: string, pageFunction: PageFunctionOn<Element[], Args, R>, ...args: Boxed<Args>): Promise<R>;
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
  $(selector: string): Promise<ElementHandle<Element> | null>;

  $eval<K extends keyof HTMLElementTagNameMap, Args extends any[], R>(selector: K, pageFunction: PageFunctionOn<HTMLElementTagNameMap[K], Args, R>, ...args: Boxed<Args>): Promise<R>;
  $eval<Args extends any[], R>(selector: string, pageFunction: PageFunctionOn<Element, Args, R>, ...args: Boxed<Args>): Promise<R>;

  $$eval<K extends keyof HTMLElementTagNameMap, Args extends any[], R>(selector: K, pageFunction: PageFunctionOn<HTMLElementTagNameMap[K][], Args, R>, ...args: Boxed<Args>): Promise<R>;
  $$eval<Args extends any[], R>(selector: string, pageFunction: PageFunctionOn<Element[], Args, R>, ...args: Boxed<Args>): Promise<R>;
}

export interface ChromiumBrowser extends Browser {
  newPage(options?: BrowserNewPageOptions): Promise<Page<ChromiumBrowserContext>>;
}

export interface BrowserType<Browser> {
  
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