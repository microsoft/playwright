// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { NetworkManager, toInterceptableRequest } from '../NetworkManager';
import * as network from '../../network';

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

  async continue(request: network.Request, overrides: { url?: string; method?: string; postData?: string; headers?: {[key: string]: string}; } = {}) {
    return toInterceptableRequest(request).continue(overrides);
  }

  async fulfill(request: network.Request, response: { status: number; headers: {[key: string]: string}; contentType: string; body: (string | Buffer); }) {
    throw new Error('Not implemented');
  }

  async abort(request: network.Request, errorCode: string = 'failed') {
    return toInterceptableRequest(request).abort();
  }
}
