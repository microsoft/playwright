// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { NetworkManager, Request } from '../NetworkManager';

export class Interception {
  private _networkManager: NetworkManager;

  constructor(networkManager: NetworkManager) {
    this._networkManager = networkManager;
  }

  enable() {
    this._networkManager.setRequestInterception(true);
  }

  disable() {
    this._networkManager.setRequestInterception(false);
  }

  async continue(request: Request, overrides: { url?: string; method?: string; postData?: string; headers?: {[key: string]: string}; } = {}) {
    return request._continue(overrides);
  }

  async fulfill(request: Request, response: { status: number; headers: {[key: string]: string}; contentType: string; body: (string | Buffer); }) {
    throw new Error('Not implemented');
  }

  async abort(request: Request, errorCode: string = 'failed') {
    return request._abort();
  }
}
