// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

type Boxed<Args extends any[], Handle> = { [Index in keyof Args]: Args[Index] | Handle };
type PageFunction<Args extends any[], R = any> = string | ((...args: Args) => R | Promise<R>);
type PageFunctionOn<On, Args extends any[], R = any> = string | ((on: On, ...args: Args) => R | Promise<R>);

export type Evaluate<Handle> = <Args extends any[], R>(fn: PageFunction<Args, R>, ...args: Boxed<Args, Handle>) => Promise<R>;
export type EvaluateHandle<Handle> = <Args extends any[]>(fn: PageFunction<Args>, ...args: Boxed<Args, Handle>) => Promise<Handle>;
export type $Eval<Handle> = <Args extends any[], R>(selector: string, fn: PageFunctionOn<Element, Args, R>, ...args: Boxed<Args, Handle>) => Promise<R>;
export type $$Eval<Handle> = <Args extends any[], R>(selector: string, fn: PageFunctionOn<Element[], Args, R>, ...args: Boxed<Args, Handle>) => Promise<R>;
export type EvaluateOn<Handle> = <Args extends any[], R>(fn: PageFunctionOn<any, Args, R>, ...args: Boxed<Args, Handle>) => Promise<R>;
export type EvaluateHandleOn<Handle> = <Args extends any[]>(fn: PageFunctionOn<any, Args>, ...args: Boxed<Args, Handle>) => Promise<Handle>;

export interface EvaluationContext<Handle> {
  evaluate: Evaluate<Handle>;
  evaluateHandle: EvaluateHandle<Handle>;
}

export interface Handle {
  dispose(): Promise<void>;
}
