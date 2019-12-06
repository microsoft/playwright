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

export type Rect = { x: number, y: number, width: number, height: number };
export type Point = { x: number, y: number };
export type Quad = [ Point, Point, Point, Point ];

export type TimeoutOptions = { timeout?: number };

export type Selector = { selector: string, visible?: boolean };

export type Polling = 'raf' | 'mutation' | number;
export type WaitForFunctionOptions = TimeoutOptions & { polling?: Polling };

export function selectorToString(selector: string | Selector): string {
  if (typeof selector === 'string')
    return selector;
  return `${selector.visible ? '[visible] ' : selector.visible === false ? '[hidden] ' : ''}${selector.selector}`;
}

// Ensures that we don't use accidental properties in selector, e.g. scope.
export function clearSelector(selector: string | Selector): string | Selector {
  if (helper.isString(selector))
    return selector;
  return { selector: selector.selector, visible: selector.visible };
}

export type ScreenshotOptions = {
  type?: 'png' | 'jpeg',
  path?: string,
  fullPage?: boolean,
  clip?: Rect,
  quality?: number,
  omitBackground?: boolean,
  encoding?: string,
};
