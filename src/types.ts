// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as js from './javascript';
import * as dom from './dom';
import * as kurl from 'url';

type Boxed<Args extends any[]> = { [Index in keyof Args]: Args[Index] | js.JSHandle<Args[Index]> };
type PageFunction<Args extends any[], R = any> = string | ((...args: Args) => R | Promise<R>);
type PageFunctionOn<On, Args extends any[], R = any> = string | ((on: On, ...args: Args) => R | Promise<R>);

type Handle<T> = T extends Node ? dom.ElementHandle<T> : js.JSHandle<T>;
type ElementForSelector<T> = T extends keyof HTMLElementTagNameMap ? HTMLElementTagNameMap[T] : Element;

export type Evaluate = <Args extends any[], R>(pageFunction: PageFunction<Args, R>, ...args: Boxed<Args>) => Promise<R>;
export type EvaluateHandle = <Args extends any[], R>(pageFunction: PageFunction<Args,  R>, ...args: Boxed<Args>) => Promise<Handle<R>>;
export type $Eval = <Args extends any[], R, S extends string>(selector: S, pageFunction: PageFunctionOn<ElementForSelector<S>, Args, R>, ...args: Boxed<Args>) => Promise<R>;
export type $$Eval = <Args extends any[], R, S extends string>(selector: S, pageFunction: PageFunctionOn<ElementForSelector<S>[], Args, R>, ...args: Boxed<Args>) => Promise<R>;
export type EvaluateOn<T> = <Args extends any[], R>(pageFunction: PageFunctionOn<T, Args, R>, ...args: Boxed<Args>) => Promise<R>;
export type EvaluateHandleOn<T> = <Args extends any[], R>(pageFunction: PageFunctionOn<T, Args, R>, ...args: Boxed<Args>) => Promise<Handle<R>>;

export type Size = { width: number, height: number };
export type Point = { x: number, y: number };
export type Rect = Size & Point;
export type Quad = [ Point, Point, Point, Point ];

export type TimeoutOptions = { timeout?: number };
export type Visibility = 'visible' | 'hidden' | 'any';

export type Polling = 'raf' | 'mutation' | number;
export type WaitForFunctionOptions = TimeoutOptions & { polling?: Polling };

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

export type URLMatch = string | RegExp | ((url: kurl.URL) => boolean);
