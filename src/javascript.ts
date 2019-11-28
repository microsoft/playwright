// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as frames from './frames';
import * as types from './types';
import * as dom from './dom';
import * as injectedSource from './generated/injectedSource';
import * as cssSelectorEngineSource from './generated/cssSelectorEngineSource';
import * as xpathSelectorEngineSource from './generated/xpathSelectorEngineSource';

export interface ExecutionContextDelegate {
  evaluate(context: ExecutionContext, returnByValue: boolean, pageFunction: string | Function, ...args: any[]): Promise<any>;
  getProperties(handle: JSHandle): Promise<Map<string, JSHandle>>;
  releaseHandle(handle: JSHandle): Promise<void>;
  handleToString(handle: JSHandle): string;
  handleJSONValue(handle: JSHandle): Promise<any>;
}

export class ExecutionContext {
  _delegate: ExecutionContextDelegate;
  private _frame: frames.Frame;
  private _injectedPromise: Promise<JSHandle> | null = null;
  private _documentPromise: Promise<dom.ElementHandle> | null = null;

  constructor(delegate: ExecutionContextDelegate, frame: frames.Frame | null) {
    this._delegate = delegate;
    this._frame = frame;
  }

  frame(): frames.Frame | null {
    return this._frame;
  }

  evaluate: types.Evaluate = (pageFunction, ...args) => {
    return this._delegate.evaluate(this, true /* returnByValue */, pageFunction, ...args);
  }

  evaluateHandle: types.EvaluateHandle = (pageFunction, ...args) => {
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

  _document(): Promise<dom.ElementHandle> {
    if (!this._documentPromise)
      this._documentPromise = this.evaluateHandle('document').then(handle => handle.asElement()!);
    return this._documentPromise;
  }
}

export class JSHandle {
  _context: ExecutionContext;
  _disposed = false;

  constructor(context: ExecutionContext) {
    this._context = context;
  }

  executionContext(): ExecutionContext {
    return this._context;
  }

  evaluate: types.EvaluateOn = (pageFunction, ...args) => {
    return this._context.evaluate(pageFunction, this, ...args);
  }

  evaluateHandle: types.EvaluateHandleOn = (pageFunction, ...args) => {
    return this._context.evaluateHandle(pageFunction, this, ...args);
  }

  async getProperty(propertyName: string): Promise<JSHandle | null> {
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

  getProperties(): Promise<Map<string, JSHandle>> {
    return this._context._delegate.getProperties(this);
  }

  jsonValue(): Promise<any> {
    return this._context._delegate.handleJSONValue(this);
  }

  asElement(): dom.ElementHandle | null {
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
