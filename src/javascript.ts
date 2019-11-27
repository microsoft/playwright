// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as frames from './frames';
import * as types from './types';
import * as injectedSource from './generated/injectedSource';
import * as cssSelectorEngineSource from './generated/cssSelectorEngineSource';
import * as xpathSelectorEngineSource from './generated/xpathSelectorEngineSource';

export interface ExecutionContextDelegate<JSHandle extends types.JSHandle<JSHandle, ElementHandle, Response>, ElementHandle extends types.ElementHandle<JSHandle, ElementHandle, Response>, Response> {
  evaluate(context: ExecutionContext<JSHandle, ElementHandle, Response>, returnByValue: boolean, pageFunction: string | Function, ...args: any[]): Promise<any>;
}

export class ExecutionContext<JSHandle extends types.JSHandle<JSHandle, ElementHandle, Response>, ElementHandle extends types.ElementHandle<JSHandle, ElementHandle, Response>, Response> {
  _delegate: ExecutionContextDelegate<JSHandle, ElementHandle, Response>;
  private _frame: frames.Frame<JSHandle, ElementHandle, Response>;
  private _injectedPromise: Promise<JSHandle> | null = null;
  private _documentPromise: Promise<ElementHandle> | null = null;

  constructor(delegate: ExecutionContextDelegate<JSHandle, ElementHandle, Response>, frame: frames.Frame<JSHandle, ElementHandle, Response> | null) {
    this._delegate = delegate;
    this._frame = frame;
  }

  frame(): frames.Frame<JSHandle, ElementHandle, Response> | null {
    return this._frame;
  }

  evaluate: types.Evaluate<JSHandle> = (pageFunction, ...args) => {
    return this._delegate.evaluate(this, true /* returnByValue */, pageFunction, ...args);
  }

  evaluateHandle: types.EvaluateHandle<JSHandle> = (pageFunction, ...args) => {
    return this._delegate.evaluate(this, false /* returnByValue */, pageFunction, ...args);
  }

  _injected(): Promise<JSHandle> {
    if (!this._injectedPromise) {
      const engineSources = [cssSelectorEngineSource.source, xpathSelectorEngineSource.source];
      const source = `
        new (${injectedSource.source})([
          ${engineSources.join(',\n')}
        ])
      `;
      this._injectedPromise = this.evaluateHandle(source);
    }
    return this._injectedPromise;
  }

  _document(): Promise<ElementHandle> {
    if (!this._documentPromise)
      this._documentPromise = this.evaluateHandle('document').then(handle => handle.asElement()!);
    return this._documentPromise;
  }
}

