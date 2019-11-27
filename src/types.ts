// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

type Boxed<Args extends any[], Handle> = { [Index in keyof Args]: Args[Index] | Handle };
type PageFunction<Args extends any[], R = any> = string | ((...args: Args) => R | Promise<R>);
type PageFunctionOn<On, Args extends any[], R = any> = string | ((on: On, ...args: Args) => R | Promise<R>);

export type Evaluate<Handle> = <Args extends any[], R>(pageFunction: PageFunction<Args, R>, ...args: Boxed<Args, Handle>) => Promise<R>;
export type EvaluateHandle<Handle> = <Args extends any[]>(pageFunction: PageFunction<Args>, ...args: Boxed<Args, Handle>) => Promise<Handle>;
export type $Eval<Handle> = <Args extends any[], R>(selector: string, pageFunction: PageFunctionOn<Element, Args, R>, ...args: Boxed<Args, Handle>) => Promise<R>;
export type $$Eval<Handle> = <Args extends any[], R>(selector: string, pageFunction: PageFunctionOn<Element[], Args, R>, ...args: Boxed<Args, Handle>) => Promise<R>;
export type EvaluateOn<Handle> = <Args extends any[], R>(pageFunction: PageFunctionOn<any, Args, R>, ...args: Boxed<Args, Handle>) => Promise<R>;
export type EvaluateHandleOn<Handle> = <Args extends any[]>(pageFunction: PageFunctionOn<any, Args>, ...args: Boxed<Args, Handle>) => Promise<Handle>;
