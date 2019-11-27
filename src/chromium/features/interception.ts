// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { NetworkManager, Request, toInterceptableRequest } from '../NetworkManager';

export class Interception {
  private _networkManager: NetworkManager;

  constructor(networkManager: NetworkManager) {
    this._networkManager = networkManager;
  }

  async enable() {
    await this._networkManager.setRequestInterception(true);
  }

  async disable() {
    await this._networkManager.setRequestInterception(false);
  }

  async continue(request: Request, overrides: { url?: string; method?: string; postData?: string; headers?: {[key: string]: string}; } = {}) {
    return toInterceptableRequest(request).continue(overrides);
  }

  async fulfill(request: Request, response: { status: number; headers: {[key: string]: string}; contentType: string; body: (string | Buffer); }) {
    return toInterceptableRequest(request).fulfill(response);
  }

  async abort(request: Request, errorCode: string = 'failed') {
    return toInterceptableRequest(request).abort(errorCode);
  }

  setOfflineMode(enabled: boolean) {
    return this._networkManager.setOfflineMode(enabled);
  }

  async authenticate(credentials: { username: string; password: string; } | null) {
    return this._networkManager.authenticate(credentials);
  }
}
