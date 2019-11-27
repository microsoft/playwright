// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as frames from './frames';
import * as types from './types';
import * as injectedSource from './generated/injectedSource';
import * as cssSelectorEngineSource from './generated/cssSelectorEngineSource';
import * as xpathSelectorEngineSource from './generated/xpathSelectorEngineSource';

export interface ExecutionContextDelegate<ElementHandle extends types.ElementHandle<ElementHandle>> {
  evaluate(context: ExecutionContext<ElementHandle>, returnByValue: boolean, pageFunction: string | Function, ...args: any[]): Promise<any>;
  getProperties(handle: JSHandle<ElementHandle>): Promise<Map<string, JSHandle<ElementHandle>>>;
  releaseHandle(handle: JSHandle<ElementHandle>): Promise<void>;
  handleToString(handle: JSHandle<ElementHandle>): string;
  handleJSONValue(handle: JSHandle<ElementHandle>): Promise<any>;
}

export class ExecutionContext<ElementHandle extends types.ElementHandle<ElementHandle>> {
  _delegate: ExecutionContextDelegate<ElementHandle>;
  private _frame: frames.Frame<ElementHandle>;
  private _injectedPromise: Promise<JSHandle<ElementHandle>> | null = null;
  private _documentPromise: Promise<ElementHandle> | null = null;

  constructor(delegate: ExecutionContextDelegate<ElementHandle>, frame: frames.Frame<ElementHandle> | null) {
    this._delegate = delegate;
    this._frame = frame;
  }

  frame(): frames.Frame<ElementHandle> | null {
    return this._frame;
  }

  evaluate: types.Evaluate<JSHandle<ElementHandle>> = (pageFunction, ...args) => {
    return this._delegate.evaluate(this, true /* returnByValue */, pageFunction, ...args);
  }

  evaluateHandle: types.EvaluateHandle<JSHandle<ElementHandle>> = (pageFunction, ...args) => {
    return this._delegate.evaluate(this, false /* returnByValue */, pageFunction, ...args);
  }

  _injected(): Promise<JSHandle<ElementHandle>> {
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

export class JSHandle<ElementHandle extends types.ElementHandle<ElementHandle>> {
  _context: ExecutionContext<ElementHandle>;
  _disposed = false;

  constructor(context: ExecutionContext<ElementHandle>) {
    this._context = context;
  }

  executionContext(): ExecutionContext<ElementHandle> {
    return this._context;
  }

  evaluate: types.EvaluateOn<JSHandle<ElementHandle>> = (pageFunction, ...args) => {
    return this._context.evaluate(pageFunction, this, ...args);
  }

  evaluateHandle: types.EvaluateHandleOn<JSHandle<ElementHandle>> = (pageFunction, ...args) => {
    return this._context.evaluateHandle(pageFunction, this, ...args);
  }

  async getProperty(propertyName: string): Promise<JSHandle<ElementHandle> | null> {
    const objectHandle = await this.evaluateHandle((object, propertyName) => {
      const result = {__proto__: null};
      result[propertyName] = object[propertyName];
      return result;
    }, propertyName);
    const properties = await objectHandle.getProperties();
    const result = properties.get(propertyName) || null;
    await objectHandle.dispose();
    return result;
  }

  getProperties(): Promise<Map<string, JSHandle<ElementHandle>>> {
    return this._context._delegate.getProperties(this);
  }

  jsonValue(): Promise<any> {
    return this._context._delegate.handleJSONValue(this);
  }

  asElement(): ElementHandle | null {
    return null;
  }

  async dispose() {
    if (this._disposed)
      return;
    this._disposed = true;
    await this._context._delegate.releaseHandle(this);
  }

  toString(): string {
    return this._context._delegate.handleToString(this);
  }
}
