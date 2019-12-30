// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { CRNetworkManager } from '../crNetworkManager';

export class CRInterception {
  private _networkManager: CRNetworkManager;

  constructor(networkManager: CRNetworkManager) {
    this._networkManager = networkManager;
  }

  setOfflineMode(enabled: boolean) {
    return this._networkManager.setOfflineMode(enabled);
  }

  async authenticate(credentials: { username: string; password: string; } | null) {
    return this._networkManager.authenticate(credentials);
  }
}
