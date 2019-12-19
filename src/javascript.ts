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
  handleJSONValue<T>(handle: JSHandle<T>): Promise<T>;
}

export class ExecutionContext {
  readonly _delegate: ExecutionContextDelegate;

  constructor(delegate: ExecutionContextDelegate) {
    this._delegate = delegate;
  }

  frame(): frames.Frame | null {
    return null;
  }

  _evaluate(returnByValue: boolean, pageFunction: string | Function, ...args: any[]): Promise<any> {
    return this._delegate.evaluate(this, returnByValue, pageFunction, ...args);
  }

  evaluate: types.Evaluate = async (pageFunction, ...args) => {
    return this._evaluate(true /* returnByValue */, pageFunction, ...args);
  }

  evaluateHandle: types.EvaluateHandle = async (pageFunction, ...args) => {
    return this._evaluate(false /* returnByValue */, pageFunction, ...args);
  }

  _createHandle(remoteObject: any): JSHandle {
    return new JSHandle(this, remoteObject);
  }
}

export class JSHandle<T = any> {
  readonly _context: ExecutionContext;
  readonly _remoteObject: any;
  _disposed = false;

  constructor(context: ExecutionContext, remoteObject: any) {
    this._context = context;
    this._remoteObject = remoteObject;
  }

  evaluate: types.EvaluateOn<T> = (pageFunction, ...args) => {
    return this._context.evaluate(pageFunction, this, ...args);
  }

  evaluateHandle: types.EvaluateHandleOn<T> = (pageFunction, ...args) => {
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

  jsonValue(): Promise<T> {
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
