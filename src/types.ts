// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as js from './javascript';
import { helper } from './helper';

type Boxed<Args extends any[]> = { [Index in keyof Args]: Args[Index] | js.JSHandle };
type PageFunction<Args extends any[], R = any> = string | ((...args: Args) => R | Promise<R>);
type PageFunctionOn<On, Args extends any[], R = any> = string | ((on: On, ...args: Args) => R | Promise<R>);

export type Evaluate = <Args extends any[], R>(pageFunction: PageFunction<Args, R>, ...args: Boxed<Args>) => Promise<R>;
export type EvaluateHandle = <Args extends any[]>(pageFunction: PageFunction<Args>, ...args: Boxed<Args>) => Promise<js.JSHandle>;
export type $Eval<S = string | Selector> = <Args extends any[], R>(selector: S, pageFunction: PageFunctionOn<Element, Args, R>, ...args: Boxed<Args>) => Promise<R>;
export type $$Eval<S = string | Selector> = <Args extends any[], R>(selector: S, pageFunction: PageFunctionOn<Element[], Args, R>, ...args: Boxed<Args>) => Promise<R>;
export type EvaluateOn = <Args extends any[], R>(pageFunction: PageFunctionOn<any, Args, R>, ...args: Boxed<Args>) => Promise<R>;
export type EvaluateHandleOn = <Args extends any[]>(pageFunction: PageFunctionOn<any, Args>, ...args: Boxed<Args>) => Promise<js.JSHandle>;

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
