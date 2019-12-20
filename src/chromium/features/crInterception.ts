// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { CRNetworkManager, toInterceptableRequest } from '../crNetworkManager';
import * as network from '../../network';

export class CRInterception {
  private _networkManager: CRNetworkManager;

  constructor(networkManager: CRNetworkManager) {
    this._networkManager = networkManager;
  }

  async enable() {
    await this._networkManager.setRequestInterception(true);
  }

  async disable() {
    await this._networkManager.setRequestInterception(false);
  }

  async continue(request: network.Request, overrides: { url?: string; method?: string; postData?: string; headers?: {[key: string]: string}; } = {}) {
    return toInterceptableRequest(request).continue(overrides);
  }

  async fulfill(request: network.Request, response: { status: number; headers: {[key: string]: string}; contentType: string; body: (string | Buffer); }) {
    return toInterceptableRequest(request).fulfill(response);
  }

  async abort(request: network.Request, errorCode: string = 'failed') {
    return toInterceptableRequest(request).abort(errorCode);
  }

  setOfflineMode(enabled: boolean) {
    return this._networkManager.setOfflineMode(enabled);
  }

  async authenticate(credentials: { username: string; password: string; } | null) {
    return this._networkManager.authenticate(credentials);
  }
}
