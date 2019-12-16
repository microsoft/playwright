// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as js from './javascript';
import { helper } from './helper';
import * as dom from './dom';

type Boxed<Args extends any[]> = { [Index in keyof Args]: Args[Index] | js.JSHandle<Args[Index]> };
type PageFunction<Args extends any[], R = any> = string | ((...args: Args) => R | Promise<R>);
type PageFunctionOn<On, Args extends any[], R = any> = string | ((on: On, ...args: Args) => R | Promise<R>);

type Handle<T> = T extends Node ? dom.ElementHandle<T> : js.JSHandle<T>;
type ElementForSelector<T> = T extends keyof HTMLElementTagNameMap ? HTMLElementTagNameMap[T] : Element;

export type Evaluate = <Args extends any[], R>(pageFunction: PageFunction<Args, R>, ...args: Boxed<Args>) => Promise<R>;
export type EvaluateHandle = <Args extends any[], R>(pageFunction: PageFunction<Args,  R>, ...args: Boxed<Args>) => Promise<Handle<R>>;
export type $Eval<O = string | Selector> = <Args extends any[], R, S extends O>(selector: S, pageFunction: PageFunctionOn<ElementForSelector<S>, Args, R>, ...args: Boxed<Args>) => Promise<R>;
export type $$Eval<O = string | Selector> = <Args extends any[], R, S extends O>(selector: S, pageFunction: PageFunctionOn<ElementForSelector<S>[], Args, R>, ...args: Boxed<Args>) => Promise<R>;
export type EvaluateOn<T> = <Args extends any[], R>(pageFunction: PageFunctionOn<T, Args, R>, ...args: Boxed<Args>) => Promise<R>;
export type EvaluateHandleOn<T> = <Args extends any[], R>(pageFunction: PageFunctionOn<T, Args, R>, ...args: Boxed<Args>) => Promise<Handle<R>>;

export type Size = { width: number, height: number };
export type Point = { x: number, y: number };
export type Rect = Size & Point;
export type Quad = [ Point, Point, Point, Point ];

export type TimeoutOptions = { timeout?: number };
export type Visibility = 'visible' | 'hidden' | 'any';
export type Selector = { selector: string, visibility?: Visibility };

export type Polling = 'raf' | 'mutation' | number;
export type WaitForFunctionOptions = TimeoutOptions & { polling?: Polling };

export function selectorToString(selector: string | Selector): string {
  if (typeof selector === 'string')
    return selector;
  let label;
  switch (selector.visibility) {
    case 'visible': label = '[visible] '; break;
    case 'hidden': label = '[hidden] '; break;
    case 'any':
    case undefined:
      label = ''; break;
  }
  return `${label}${selector.selector}`;
}

// Ensures that we don't use accidental properties in selector, e.g. scope.
export function clearSelector(selector: string | Selector): string | Selector {
  if (helper.isString(selector))
    return selector;
  return { selector: selector.selector, visibility: selector.visibility };
}

export type ElementScreenshotOptions = {
  type?: 'png' | 'jpeg',
  path?: string,
  quality?: number,
  omitBackground?: boolean,
};

export type ScreenshotOptions = ElementScreenshotOptions & {
  fullPage?: boolean,
  clip?: Rect,
};

export type Viewport = {
  width: number;
  height: number;
  deviceScaleFactor?: number;
  isMobile?: boolean;
  isLandscape?: boolean;
  hasTouch?: boolean;
};

export type Multiple<T> = T | T[];
export function multipleContains<T>(multiple: Multiple<T> | undefined, t: T): boolean {
  return multiple === t || (Array.isArray(multiple) && multiple.includes(t));
}

export type WaitForOptions<T> = TimeoutOptions & { waitFor?: Multiple<T> };
export function toWaitFor<A, B>(o: WaitForOptions<A>): A extends B ? WaitForOptions<B> : never {
  return o as any as (A extends B ? WaitForOptions<B> : never);
}
