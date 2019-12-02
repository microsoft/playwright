// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as frames from './frames';
import * as types from './types';
import * as dom from './dom';

export interface ExecutionContextDelegate {
  evaluate(context: ExecutionContext, returnByValue: boolean, pageFunction: string | Function, ...args: any[]): Promise<any>;
  getProperties(handle: JSHandle): Promise<Map<string, JSHandle>>;
  releaseHandle(handle: JSHandle): Promise<void>;
  handleToString(handle: JSHandle, includeType: boolean): string;
  handleJSONValue(handle: JSHandle): Promise<any>;
}

export class ExecutionContext {
  readonly _delegate: ExecutionContextDelegate;
  _domWorld?: dom.DOMWorld;

  constructor(delegate: ExecutionContextDelegate) {
    this._delegate = delegate;
  }

  frame(): frames.Frame | null {
    return this._domWorld ? this._domWorld.delegate.frame : null;
  }

  evaluate: types.Evaluate = (pageFunction, ...args) => {
    return this._delegate.evaluate(this, true /* returnByValue */, pageFunction, ...args);
  }

  evaluateHandle: types.EvaluateHandle = (pageFunction, ...args) => {
    return this._delegate.evaluate(this, false /* returnByValue */, pageFunction, ...args);
  }

  _createHandle(remoteObject: any): JSHandle {
    return (this._domWorld && this._domWorld._createHandle(remoteObject)) || new JSHandle(this, remoteObject);
  }
}

export class JSHandle {
  readonly _context: ExecutionContext;
  readonly _remoteObject: any;
  _disposed = false;

  constructor(context: ExecutionContext, remoteObject: any) {
    this._context = context;
    this._remoteObject = remoteObject;
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
    return this._context._delegate.handleToString(this, true /* includeType */);
  }
}
