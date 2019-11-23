// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

export type Boxed<Args extends any[], Handle> = { [Index in keyof Args]: Args[Index] | Handle };
export type Func<Args extends any[], R = any> = string | ((...args: Args) => R | Promise<R>);
export type FuncOn<On, Args extends any[], R = any> = string | ((on: On, ...args: Args) => R | Promise<R>);

export interface EvaluationContext<Handle> {
  evaluate<Args extends any[], R>(fn: Func<Args, R>, ...args: Boxed<Args, Handle>): Promise<R>;
  evaluateHandle<Args extends any[]>(fn: Func<Args>, ...args: Boxed<Args, Handle>): Promise<Handle>;
}

export interface DOMEvaluationContext<Handle> extends EvaluationContext<Handle> {
  $eval<Args extends any[], R>(selector: string, fn: FuncOn<Element, Args, R>, ...args: Boxed<Args, Handle>): Promise<R>;
  $$eval<Args extends any[], R>(selector: string, fn: FuncOn<Element[], Args, R>, ...args: Boxed<Args, Handle>): Promise<R>;
}

export interface HandleEvaluationContext<Handle> {
  evaluate<Args extends any[], R>(fn: FuncOn<any, Args, R>, ...args: Boxed<Args, Handle>): Promise<R>;
  evaluateHandle<Args extends any[]>(fn: FuncOn<any, Args>, ...args: Boxed<Args, Handle>): Promise<Handle>;
}
